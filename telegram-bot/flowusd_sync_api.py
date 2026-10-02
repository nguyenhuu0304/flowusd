from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel

from flowusd_api import (
    app,
    db,
    normalize_tx_hash,
    normalize_wallet,
    now_ts,
    read_batch_link,
    verify_creation_transaction,
)


class CloudBillMember(BaseModel):
    id: str
    name: str
    raw: str
    status: str = "unpaid"
    payer: str | None = None
    directoryId: str | None = None


class CloudBillRequest(BaseModel):
    id: str
    creator: str
    title: str
    createdAt: str
    totalRaw: str
    members: list[CloudBillMember]
    txHash: str
    stage: str


def _payload_from_row(
    value: str,
) -> dict[str, Any] | None:
    try:
        payload = json.loads(
            value
        )
    except Exception:
        return None

    if not isinstance(
        payload,
        dict,
    ):
        return None

    return payload


@app.get(
    "/api/cloud-bills/health"
)
def cloud_bills_health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": (
            "FlowUSD cross-device bill sync"
        ),
        "version": "1.0.0",
    }


@app.get(
    "/api/cloud-bills/{owner_wallet}"
)
def cloud_bills_by_wallet(
    owner_wallet: str,
) -> dict[str, Any]:
    wallet = normalize_wallet(
        owner_wallet
    )

    with db() as con:
        rows = con.execute(
            """
            SELECT payload_json
            FROM bills
            WHERE owner_wallet = ?
            ORDER BY created_at DESC
            """,
            (wallet,),
        ).fetchall()

    bills: list[
        dict[str, Any]
    ] = []

    for row in rows:
        payload = (
            _payload_from_row(
                str(
                    row[
                        "payload_json"
                    ]
                )
            )
        )

        if payload is not None:
            bills.append(
                payload
            )

    return {
        "ok": True,
        "wallet": wallet,
        "bills": bills,
    }


@app.post(
    "/api/cloud-bills"
)
def cloud_bill_sync(
    payload: CloudBillRequest,
) -> dict[str, Any]:
    creator = normalize_wallet(
        payload.creator
    )

    tx_hash = normalize_tx_hash(
        payload.txHash
    )

    if not payload.id.strip():
        raise HTTPException(
            status_code=400,
            detail="Bill ID required.",
        )

    if not payload.members:
        raise HTTPException(
            status_code=400,
            detail=(
                "Bill must contain at least "
                "one member."
            ),
        )

    if payload.stage != "confirmed":
        raise HTTPException(
            status_code=409,
            detail=(
                "Only confirmed bills "
                "can be cloud-synced."
            ),
        )

    # The browser cannot invent a bill and write it
    # to another wallet: the creation transaction
    # must be successful on the configured Batch
    # contract.
    verify_creation_transaction(
        tx_hash
    )

    verified_members: list[
        dict[str, Any]
    ] = []

    total_raw = 0

    for member in payload.members:
        link_id = (
            member.id.strip()
        )

        try:
            expected_amount = int(
                member.raw
            )
        except Exception:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid member amount."
                ),
            )

        if expected_amount <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Member amount must "
                    "be positive."
                ),
            )

        try:
            chain = read_batch_link(
                link_id
            )
        except Exception as exc:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Could not verify "
                    f"Batch link: {exc}"
                ),
            )

        if (
            chain["creator"]
            != creator
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "On-chain bill owner "
                    "does not match."
                ),
            )

        if (
            int(
                chain[
                    "amount_raw"
                ]
            )
            != expected_amount
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "On-chain bill amount "
                    "does not match."
                ),
            )

        total_raw += (
            expected_amount
        )

        paid = bool(
            chain["paid"]
        )

        verified_members.append(
            {
                "id": link_id,
                "name": (
                    member.name.strip()
                    or "Member"
                )[:60],
                "raw": str(
                    expected_amount
                ),
                "status": (
                    "paid"
                    if paid
                    else "unpaid"
                ),
                "payer": (
                    chain["payer"]
                    if paid
                    else None
                ),
                "directoryId": (
                    member.directoryId
                ),
            }
        )

    try:
        requested_total = int(
            payload.totalRaw
        )
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid total amount."
            ),
        )

    if (
        requested_total
        != total_raw
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Bill total does not "
                "match member amounts."
            ),
        )

    cloud_payload = {
        "id": (
            payload.id.strip()
        ),
        "creator": creator,
        "title": (
            payload.title.strip()
            or "Split bill"
        )[:80],
        "createdAt": (
            payload.createdAt
        ),
        "totalRaw": str(
            requested_total
        ),
        "members": (
            verified_members
        ),
        "txHash": tx_hash,
        "stage": "confirmed",
    }

    timestamp = now_ts()

    with db() as con:
        con.execute(
            """
            INSERT INTO bills(
                id,
                owner_wallet,
                creator,
                title,
                total_raw,
                tx_hash,
                payload_json,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(
                id,
                owner_wallet
            )
            DO UPDATE SET
                creator =
                    excluded.creator,
                title =
                    excluded.title,
                total_raw =
                    excluded.total_raw,
                tx_hash =
                    excluded.tx_hash,
                payload_json =
                    excluded.payload_json,
                updated_at =
                    excluded.updated_at
            """,
            (
                cloud_payload[
                    "id"
                ],
                creator,
                creator,
                cloud_payload[
                    "title"
                ],
                cloud_payload[
                    "totalRaw"
                ],
                tx_hash,
                json.dumps(
                    cloud_payload,
                    ensure_ascii=False,
                    separators=(
                        ",",
                        ":",
                    ),
                ),
                timestamp,
                timestamp,
            ),
        )

    return {
        "ok": True,
        "bill": cloud_payload,
    }


# Running this file directly is useful for local
# testing. Render should use:
# uvicorn flowusd_sync_api:app --host 0.0.0.0 --port $PORT
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "flowusd_sync_api:app",
        host="127.0.0.1",
        port=8787,
        reload=False,
    )
