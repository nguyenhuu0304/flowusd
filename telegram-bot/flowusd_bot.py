"""
FlowUSD Telegram bot
Arc Testnet monitor + FlowUSD pairing + Batch Split notifications.

Public private-chat commands:
    /start
    /help
    /connect
    /register

Privileged monitoring commands:
    /split <total> <people>
    /watch <wallet>
    /threshold <USDC>
    /link <bytes32>
    /links
    /status <bytes32>
    /unwatch

Batch notification flow:
    FlowUSD Sync All
    -> bill saved in telegram_state.db
    -> bot reads each Batch member link ID
    -> checks getLink(id) on Batch contract
    -> detects paid links
    -> resolves directoryId to Telegram chat_id
    -> sends Telegram payment notification

Never ask users for seed phrases or private keys.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import socket
import sqlite3
import time
import urllib.error
import urllib.request
from decimal import Decimal, InvalidOperation
from pathlib import Path


# ============================================================
# Configuration
# ============================================================

TOKEN = os.getenv(
    "TELEGRAM_BOT_TOKEN",
    "",
).strip()

ALLOWED = {
    int(s.strip())
    for s in os.getenv(
        "BOT_ALLOWED_CHAT_IDS",
        "",
    ).split(",")
    if s.strip().isdigit()
}

RPC_URL = os.getenv(
    "ARC_RPC_URL",
    "https://rpc.testnet.arc.network",
).strip()

# Legacy / standalone Payment Links contract.
PAYMENT_LINKS_CONTRACT = os.getenv(
    "PAYMENT_LINKS_CONTRACT_ADDRESS",
    "0xB09880B93fF0F45310fDC88aD7d2A7A4A02b5B85",
).strip()

# Current Batch Split contract used by FlowUSD.
BATCH_CONTRACT = os.getenv(
    "BATCH_PAYMENT_LINKS_CONTRACT_ADDRESS",
    "0x9F96951eF27BadE6dCeee185341994a80A411d02",
).strip()

USDC = (
    "0x3600000000000000000000000000000000000000"
)

TRANSFER_TOPIC = (
    "0xddf252ad1be2c89b69c2b068fc378daa"
    "952ba7f163c4a11628f55a4df523b3ef"
)

# getLink(bytes32)
GET_LINK_SELECTOR = "0xf7291121"

BASE_DIR = Path(__file__).resolve().parent

DATA_FILE = BASE_DIR / "bot_state.json"

# Shared with flowusd_api.py
DB_PATH = BASE_DIR / "telegram_state.db"

WALLET_RE = re.compile(
    r"^0x[a-fA-F0-9]{40}$"
)

LINK_RE = re.compile(
    r"^0x[a-fA-F0-9]{64}$"
)

SEEN_LIMIT = 1000

POLL_INTERVAL = 35

PAIR_CODE_TTL = 600
REGISTER_CODE_TTL = 600


# ============================================================
# HTTP helpers
# ============================================================

def http_json(
    url: str,
    payload: dict | None = None,
    timeout: int = 25,
) -> dict:
    data = (
        json.dumps(payload).encode("utf-8")
        if payload is not None
        else None
    )

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "FlowUSD/1.0",
        },
        method=(
            "POST"
            if data is not None
            else "GET"
        ),
    )

    last_error: Exception | None = None

    for attempt in range(3):
        try:
            with urllib.request.urlopen(
                req,
                timeout=timeout,
            ) as resp:
                return json.load(resp)

        except urllib.error.HTTPError as exc:
            last_error = exc

            if exc.code != 429 or attempt == 2:
                raise

            wait = min(
                30,
                3 * (attempt + 1),
            )

            print(
                "HTTP rate limited; sleeping",
                wait,
                "seconds",
                flush=True,
            )

            time.sleep(wait)

        except (
            urllib.error.URLError,
            TimeoutError,
            socket.timeout,
        ) as exc:
            last_error = exc

            if attempt == 2:
                raise

            wait = 2 * (attempt + 1)

            print(
                "Network timeout; retrying in",
                wait,
                "seconds",
                flush=True,
            )

            time.sleep(wait)

    raise RuntimeError(
        f"Request failed: {last_error}"
    )


# ============================================================
# Arc RPC
# ============================================================

def rpc(
    method: str,
    params: list | None = None,
):
    result = http_json(
        RPC_URL,
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params or [],
        },
        timeout=25,
    )

    if result.get("error"):
        raise RuntimeError(
            str(
                result["error"].get(
                    "message",
                    result["error"],
                )
            )
        )

    if "result" not in result:
        raise RuntimeError(
            "RPC response without result"
        )

    return result["result"]


# ============================================================
# Telegram API
# ============================================================

def telegram(
    method: str,
    data: dict,
):
    result = http_json(
        f"https://api.telegram.org/bot{TOKEN}/{method}",
        data,
        timeout=25,
    )

    if not result.get("ok"):
        raise RuntimeError(
            str(
                result.get(
                    "description",
                    "Telegram API error",
                )
            )
        )

    return result.get("result")


def send(
    chat_id: int,
    message: str,
):
    return telegram(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": message[:4000],
            "disable_web_page_preview": True,
        },
    )


# ============================================================
# Shared database
# ============================================================

def init_shared_db() -> None:
    with sqlite3.connect(
        DB_PATH,
        timeout=15,
    ) as con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS telegram_codes (
                code TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                chat_id INTEGER NOT NULL,
                username TEXT,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )

        con.execute(
            """
            CREATE TABLE IF NOT EXISTS batch_notifications (
                owner_wallet TEXT NOT NULL,
                bill_id TEXT NOT NULL,
                link_id TEXT NOT NULL,
                directory_id TEXT,
                telegram_chat_id INTEGER,
                paid INTEGER NOT NULL DEFAULT 0,
                notified INTEGER NOT NULL DEFAULT 0,
                payer TEXT,
                amount TEXT,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (
                    owner_wallet,
                    bill_id,
                    link_id
                )
            )
            """
        )


def cleanup_codes(
    con: sqlite3.Connection,
) -> None:
    con.execute(
        """
        DELETE FROM telegram_codes
        WHERE expires_at <= ?
        """,
        (
            int(time.time()),
        ),
    )


def make_code(
    length: int = 8,
) -> str:
    alphabet = (
        "ABCDEFGHJKLMNPQRSTUVWXYZ"
        "23456789"
    )

    return "".join(
        secrets.choice(alphabet)
        for _ in range(length)
    )


def create_one_time_code(
    kind: str,
    chat_id: int,
    username: str | None,
    ttl: int,
) -> str:
    created = int(time.time())
    expires = created + ttl

    with sqlite3.connect(
        DB_PATH,
        timeout=15,
    ) as con:
        cleanup_codes(con)

        con.execute(
            """
            DELETE FROM telegram_codes
            WHERE kind = ?
              AND chat_id = ?
            """,
            (
                kind,
                chat_id,
            ),
        )

        for _ in range(10):
            code = make_code()

            try:
                con.execute(
                    """
                    INSERT INTO telegram_codes(
                        code,
                        kind,
                        chat_id,
                        username,
                        expires_at,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        code,
                        kind,
                        chat_id,
                        username,
                        expires,
                        created,
                    ),
                )

                return code

            except sqlite3.IntegrityError:
                continue

    raise RuntimeError(
        "Could not create one-time code"
    )


# ============================================================
# Legacy local bot state
# ============================================================

def blank_state():
    return {
        "offset": 0,
        "chats": {},
    }


def load_state():
    try:
        content = json.loads(
            DATA_FILE.read_text(
                encoding="utf-8",
            )
        )

        return (
            content
            if isinstance(
                content.get("chats"),
                dict,
            )
            else blank_state()
        )

    except (
        FileNotFoundError,
        ValueError,
        TypeError,
    ):
        return blank_state()


def save(state):
    tmp = DATA_FILE.with_suffix(
        ".tmp"
    )

    tmp.write_text(
        json.dumps(
            state,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    tmp.replace(
        DATA_FILE
    )


def get_chat(
    state,
    chat_id: int,
):
    return state["chats"].setdefault(
        str(chat_id),
        {
            "wallet": "",
            "threshold": "1",
            "cursor": None,
            "links": {},
            "seen": [],
        },
    )


# ============================================================
# Link status decoding
# ============================================================

def read_link_status(
    contract: str,
    link_id: str,
):
    if not LINK_RE.fullmatch(
        link_id
    ):
        raise ValueError(
            "Invalid Link ID"
        )

    hex_result = rpc(
        "eth_call",
        [
            {
                "to": contract,
                "data": (
                    GET_LINK_SELECTOR
                    + link_id[2:]
                ),
            },
            "latest",
        ],
    )

    if not isinstance(
        hex_result,
        str,
    ):
        raise ValueError(
            "Malformed on-chain response"
        )

    data = hex_result.removeprefix(
        "0x"
    )

    if len(data) < 5 * 64:
        raise ValueError(
            "Malformed on-chain link response"
        )

    words = [
        data[
            i * 64:
            (i + 1) * 64
        ]
        for i in range(5)
    ]

    creator = (
        "0x"
        + words[0][-40:]
    )

    amount = (
        Decimal(
            int(
                words[1],
                16,
            )
        )
        / Decimal(
            10 ** 6
        )
    )

    paid = (
        int(
            words[2],
            16,
        )
        > 0
    )

    payer = (
        "0x"
        + words[3][-40:]
    )

    return {
        "creator": creator,
        "amount": amount,
        "paid": paid,
        "payer": payer,
    }


def legacy_link_status(
    link_id: str,
):
    return read_link_status(
        PAYMENT_LINKS_CONTRACT,
        link_id,
    )


def batch_link_status(
    link_id: str,
):
    return read_link_status(
        BATCH_CONTRACT,
        link_id,
    )


# ============================================================
# Public commands
# ============================================================

def help_text(
    privileged: bool,
) -> str:
    base = (
        "FlowUSD — Arc Testnet\n\n"
        "/connect — create a one-time code to link "
        "this Telegram account with your FlowUSD wallet\n"
        "/register — create a one-time member code "
        "for a FlowUSD owner to add you to their directory\n"
    )

    if not privileged:
        return (
            base
            + "\nNo wallet private keys or seed phrases "
            "are ever required."
        )

    return (
        base
        + "\nMonitoring commands:\n"
        "/split 10 3 — calculate shares\n"
        "/watch 0xWallet — watch USDC transfers\n"
        "/threshold 5 — minimum alert in USDC\n"
        "/link 0xLinkID — track a legacy payment link\n"
        "/links — tracked legacy link status\n"
        "/status 0xLinkID — check a legacy payment link\n"
        "/unwatch — stop wallet alerts\n\n"
        "Batch Split notifications are automatic after "
        "FlowUSD Sync All.\n\n"
        "Read-only monitoring. "
        "Never share seed phrases/private keys."
    )


def handle_public_command(
    chat_id: int,
    username: str | None,
    op: str,
) -> bool:
    if op in (
        "/start",
        "/help",
    ):
        send(
            chat_id,
            help_text(
                chat_id in ALLOWED
            ),
        )

        return True

    if op == "/connect":
        code = create_one_time_code(
            kind="connect",
            chat_id=chat_id,
            username=username,
            ttl=PAIR_CODE_TTL,
        )

        send(
            chat_id,
            (
                "🔗 FlowUSD wallet pairing code\n\n"
                f"{code}\n\n"
                "Open FlowUSD → Telegram Payment Monitor, "
                "paste this code into "
                "\"One-time /connect code\", then press "
                "\"Link Telegram\" and sign the message "
                "with your wallet.\n\n"
                "This code expires in 10 minutes and can "
                "only be used once.\n"
                "Signing does not send a transaction."
            ),
        )

        return True

    if op == "/register":
        code = create_one_time_code(
            kind="register",
            chat_id=chat_id,
            username=username,
            ttl=REGISTER_CODE_TTL,
        )

        send(
            chat_id,
            (
                "👤 FlowUSD member registration code\n\n"
                f"{code}\n\n"
                "Send this code privately to the FlowUSD "
                "bill owner who wants to add you to their "
                "Member Directory.\n\n"
                "They should paste it into "
                "\"Member /register code\" in FlowUSD.\n\n"
                "This code expires in 10 minutes and can "
                "only be used once."
            ),
        )

        return True

    return False


# ============================================================
# Privileged commands
# ============================================================

def handle_privileged(
    chat_id: int,
    command: str,
    state,
):
    chat = get_chat(
        state,
        chat_id,
    )

    parts = command.strip().split(
        maxsplit=1
    )

    op = (
        parts[0]
        .lower()
        .split("@", 1)[0]
        if parts
        else ""
    )

    arg = (
        parts[1].strip()
        if len(parts) > 1
        else ""
    )

    if op == "/split":
        tokens = arg.split()

        if len(tokens) != 2:
            return send(
                chat_id,
                "Usage: /split 10 3",
            )

        try:
            amount = Decimal(
                tokens[0]
            )

            people = int(
                tokens[1]
            )

            if (
                not amount.is_finite()
                or amount <= 0
                or people < 2
                or people > 20
                or amount.as_tuple().exponent < -6
            ):
                raise ValueError(
                    "Invalid split"
                )

            units = (
                amount
                * Decimal(
                    1000000
                )
            )

            if (
                units
                != units.to_integral_value()
                or units < people
            ):
                raise ValueError(
                    "Amount too small"
                )

            base, rem = divmod(
                int(units),
                people,
            )

            shares = [
                Decimal(
                    base
                    + (
                        1
                        if i < rem
                        else 0
                    )
                )
                / Decimal(
                    1000000
                )
                for i in range(
                    people
                )
            ]

            detail = "\n".join(
                (
                    f"Person {i + 1}: "
                    f"{share} USDC"
                )
                for i, share
                in enumerate(
                    shares
                )
            )

            return send(
                chat_id,
                (
                    f"Split {amount} USDC "
                    f"among {people}:\n"
                    f"{detail}"
                ),
            )

        except (
            InvalidOperation,
            ValueError,
        ):
            return send(
                chat_id,
                (
                    "Usage: /split 10 3 "
                    "(2–20 people, max 6 decimals)"
                ),
            )

    if op == "/watch":
        if not WALLET_RE.fullmatch(
            arg
        ):
            return send(
                chat_id,
                (
                    "Usage: /watch "
                    "0x40HexWalletAddress"
                ),
            )

        chat["wallet"] = (
            arg.lower()
        )

        chat["cursor"] = int(
            rpc(
                "eth_blockNumber"
            ),
            16,
        )

        chat["seen"] = []

        return send(
            chat_id,
            (
                f"✅ Watching {arg}\n"
                "Starts from current block; "
                "no old transactions will be spammed."
            ),
        )

    if op == "/unwatch":
        chat["wallet"] = ""

        return send(
            chat_id,
            (
                "Wallet alerts paused. "
                "Saved links stay in /links."
            ),
        )

    if op == "/threshold":
        try:
            val = Decimal(
                arg
            )

            if (
                not val.is_finite()
                or val < 0
            ):
                raise InvalidOperation()

            chat["threshold"] = str(
                val
            )

            return send(
                chat_id,
                f"Minimum alert: {val} USDC",
            )

        except (
            InvalidOperation,
            ValueError,
        ):
            return send(
                chat_id,
                "Usage: /threshold 5",
            )

    if op == "/link":
        if not LINK_RE.fullmatch(
            arg
        ):
            return send(
                chat_id,
                (
                    "Usage: "
                    "/link 0x64HexLinkId"
                ),
            )

        item = legacy_link_status(
            arg
        )

        chat["links"][
            arg.lower()
        ] = bool(
            item["paid"]
        )

        return send(
            chat_id,
            (
                f"Saved link {arg}\n"
                f"Amount: {item['amount']} USDC\n"
                f"Status: "
                f"{'Paid' if item['paid'] else 'Unpaid'}\n"
                f"Recipient: {item['creator']}"
            ),
        )

    if op == "/status":
        if not LINK_RE.fullmatch(
            arg
        ):
            return send(
                chat_id,
                (
                    "Usage: "
                    "/status 0x64HexLinkId"
                ),
            )

        item = legacy_link_status(
            arg
        )

        return send(
            chat_id,
            (
                f"Link: {arg}\n"
                f"Amount: {item['amount']} USDC\n"
                f"Status: "
                f"{'Paid' if item['paid'] else 'Unpaid'}\n"
                f"Recipient: {item['creator']}\n"
                f"Payer: "
                f"{item['payer'] if item['paid'] else '—'}"
            ),
        )

    if op == "/links":
        if not chat["links"]:
            return send(
                chat_id,
                (
                    "No tracked links. "
                    "Use /link 0x..."
                ),
            )

        lines = [
            "Tracked links:"
        ]

        for (
            link_id,
            was_paid,
        ) in list(
            chat["links"].items()
        )[:20]:
            item = legacy_link_status(
                link_id
            )

            lines.append(
                (
                    f"{link_id[:10]}…: "
                    f"{item['amount']} USDC • "
                    f"{'Paid' if item['paid'] else 'Unpaid'}"
                )
            )

        return send(
            chat_id,
            "\n".join(
                lines
            ),
        )

    return send(
        chat_id,
        "Unknown command. Use /help",
    )


# ============================================================
# Wallet monitoring
# ============================================================

def topic(
    address: str,
):
    return (
        "0x"
        + address[2:]
        .lower()
        .rjust(
            64,
            "0",
        )
    )


def scan_wallet(
    chat_id: int,
    chat: dict,
):
    wallet = chat.get(
        "wallet",
        "",
    )

    if not WALLET_RE.fullmatch(
        wallet
    ):
        return

    current = int(
        rpc(
            "eth_blockNumber"
        ),
        16,
    )

    start = chat.get(
        "cursor"
    )

    if start is None:
        chat["cursor"] = current
        return

    start = int(
        start
    ) + 1

    if start > current:
        return

    end = min(
        current,
        start + 199,
    )

    minimum = Decimal(
        chat.get(
            "threshold",
            "1",
        )
    )

    seen = chat.setdefault(
        "seen",
        [],
    )

    new_messages = []

    for outgoing in (
        True,
        False,
    ):
        topics = (
            [
                TRANSFER_TOPIC,
                topic(
                    wallet
                ),
            ]
            if outgoing
            else [
                TRANSFER_TOPIC,
                None,
                topic(
                    wallet
                ),
            ]
        )

        logs = rpc(
            "eth_getLogs",
            [
                {
                    "fromBlock": hex(
                        start
                    ),
                    "toBlock": hex(
                        end
                    ),
                    "address": USDC,
                    "topics": topics,
                }
            ],
        )

        for log in logs:
            if log.get(
                "removed"
            ):
                continue

            event_id = (
                f"{log['transactionHash'].lower()}:"
                f"{log.get('logIndex', '0x0')}"
            )

            if event_id in seen:
                continue

            seen.append(
                event_id
            )

            amount = (
                Decimal(
                    int(
                        log["data"],
                        16,
                    )
                )
                / Decimal(
                    1000000
                )
            )

            if amount < minimum:
                continue

            sender = (
                "0x"
                + log["topics"][1][-40:]
            )

            recipient = (
                "0x"
                + log["topics"][2][-40:]
            )

            direction = (
                "OUT"
                if outgoing
                else "IN"
            )

            new_messages.append(
                (
                    f"💸 {direction} {amount} USDC\n"
                    f"From: {sender}\n"
                    f"To: {recipient}\n"
                    "https://testnet.arcscan.app/tx/"
                    f"{log['transactionHash']}"
                )
            )

            time.sleep(
                0.35
            )

    chat["seen"] = seen[
        -SEEN_LIMIT:
    ]

    chat["cursor"] = end

    for message in new_messages[
        :15
    ]:
        send(
            chat_id,
            message,
        )


# ============================================================
# Legacy Payment Link monitoring
# ============================================================

def scan_links(
    chat_id: int,
    chat: dict,
):
    for (
        link_id,
        old,
    ) in list(
        chat.get(
            "links",
            {},
        ).items()
    )[:20]:
        item = legacy_link_status(
            link_id
        )

        if (
            not old
            and item["paid"]
        ):
            send(
                chat_id,
                (
                    "✅ Payment Link paid: "
                    f"{item['amount']} USDC\n"
                    f"Link: {link_id}\n"
                    f"Payer: {item['payer']}"
                ),
            )

        chat["links"][
            link_id
        ] = bool(
            item["paid"]
        )

        time.sleep(
            0.25
        )


# ============================================================
# Batch Split notifications
# ============================================================

def get_directory_chat(
    con: sqlite3.Connection,
    owner_wallet: str,
    directory_id: str,
) -> int | None:
    row = con.execute(
        """
        SELECT telegram_chat_id
        FROM directory
        WHERE owner_wallet = ?
          AND id = ?
        """,
        (
            owner_wallet,
            directory_id,
        ),
    ).fetchone()

    if not row:
        return None

    try:
        return int(
            row[0]
        )

    except (
        TypeError,
        ValueError,
    ):
        return None


def scan_batch_bills():
    if not DB_PATH.exists():
        return

    con = sqlite3.connect(
        DB_PATH,
        timeout=15,
    )

    con.row_factory = sqlite3.Row

    try:
        bills = con.execute(
            """
            SELECT
                id,
                owner_wallet,
                title,
                payload_json
            FROM bills
            ORDER BY updated_at DESC
            LIMIT 100
            """
        ).fetchall()

        for bill in bills:
            owner_wallet = str(
                bill["owner_wallet"]
            )

            bill_id = str(
                bill["id"]
            )

            title = (
                str(
                    bill["title"]
                ).strip()
                or "Untitled bill"
            )

            try:
                payload = json.loads(
                    bill["payload_json"]
                )
            except (
                TypeError,
                ValueError,
                json.JSONDecodeError,
            ):
                print(
                    "Batch notification: invalid payload",
                    bill_id,
                    flush=True,
                )
                continue

            members = payload.get(
                "members",
                [],
            )

            if not isinstance(
                members,
                list,
            ):
                continue

            for member in members:
                if not isinstance(
                    member,
                    dict,
                ):
                    continue

                link_id = str(
                    member.get(
                        "id",
                        "",
                    )
                ).strip()

                directory_id = str(
                    member.get(
                        "directoryId",
                        "",
                    )
                    or ""
                ).strip()

                member_name = (
                    str(
                        member.get(
                            "name",
                            "",
                        )
                    ).strip()
                    or "Member"
                )

                if not LINK_RE.fullmatch(
                    link_id
                ):
                    continue

                # Only Telegram-linked members can receive
                # automatic notifications.
                if not directory_id:
                    continue

                telegram_chat_id = (
                    get_directory_chat(
                        con,
                        owner_wallet,
                        directory_id,
                    )
                )

                if not telegram_chat_id:
                    continue

                try:
                    item = batch_link_status(
                        link_id
                    )

                except Exception as exc:
                    print(
                        (
                            "Batch link check error:"
                            f" bill={bill_id}"
                            f" link={link_id}"
                            f" error={repr(exc)}"
                        ),
                        flush=True,
                    )
                    continue

                existing = con.execute(
                    """
                    SELECT
                        paid,
                        notified
                    FROM batch_notifications
                    WHERE owner_wallet = ?
                      AND bill_id = ?
                      AND link_id = ?
                    """,
                    (
                        owner_wallet,
                        bill_id,
                        link_id.lower(),
                    ),
                ).fetchone()

                old_paid = (
                    bool(existing["paid"])
                    if existing
                    else False
                )

                notified = (
                    bool(existing["notified"])
                    if existing
                    else False
                )

                current_paid = bool(
                    item["paid"]
                )

                now = int(
                    time.time()
                )

                con.execute(
                    """
                    INSERT INTO batch_notifications(
                        owner_wallet,
                        bill_id,
                        link_id,
                        directory_id,
                        telegram_chat_id,
                        paid,
                        notified,
                        payer,
                        amount,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(
                        owner_wallet,
                        bill_id,
                        link_id
                    )
                    DO UPDATE SET
                        directory_id =
                            excluded.directory_id,
                        telegram_chat_id =
                            excluded.telegram_chat_id,
                        paid =
                            excluded.paid,
                        payer =
                            excluded.payer,
                        amount =
                            excluded.amount,
                        updated_at =
                            excluded.updated_at
                    """,
                    (
                        owner_wallet,
                        bill_id,
                        link_id.lower(),
                        directory_id,
                        telegram_chat_id,
                        1 if current_paid else 0,
                        1 if notified else 0,
                        item["payer"],
                        str(
                            item["amount"]
                        ),
                        now,
                    ),
                )

                con.commit()

                # Notify once.
                #
                # If a bill was already paid before this
                # upgraded bot starts, it will still send
                # one notification on its first scan.
                # This is useful for validating existing
                # synced test bills.
                should_notify = (
                    current_paid
                    and not notified
                )

                if should_notify:
                    try:
                        send(
                            telegram_chat_id,
                            (
                                "✅ FlowUSD Batch payment received\n\n"
                                f"Bill: {title}\n"
                                f"Member: {member_name}\n"
                                f"Amount: {item['amount']} USDC\n"
                                f"Status: Paid\n"
                                f"Payer: {item['payer']}\n\n"
                                f"Link ID: {link_id}"
                            ),
                        )

                        con.execute(
                            """
                            UPDATE batch_notifications
                            SET
                                notified = 1,
                                paid = 1,
                                payer = ?,
                                amount = ?,
                                updated_at = ?
                            WHERE owner_wallet = ?
                              AND bill_id = ?
                              AND link_id = ?
                            """,
                            (
                                item["payer"],
                                str(
                                    item["amount"]
                                ),
                                int(
                                    time.time()
                                ),
                                owner_wallet,
                                bill_id,
                                link_id.lower(),
                            ),
                        )

                        con.commit()

                        print(
                            (
                                "Batch notification sent:"
                                f" bill={title}"
                                f" member={member_name}"
                                f" chat={telegram_chat_id}"
                            ),
                            flush=True,
                        )

                    except Exception as exc:
                        print(
                            (
                                "Batch notification send error:"
                                f" bill={bill_id}"
                                f" link={link_id}"
                                f" error={repr(exc)}"
                            ),
                            flush=True,
                        )

                time.sleep(
                    0.20
                )

    finally:
        con.close()


# ============================================================
# Main loop
# ============================================================

def main():
    if not TOKEN:
        raise SystemExit(
            (
                "Set TELEGRAM_BOT_TOKEN in "
                "telegram-bot/.env.bot.local"
            )
        )

    init_shared_db()

    print(
        (
            "FlowUSD Telegram bot started "
            "(Arc Testnet + FlowUSD pairing "
            "+ Batch notifications)."
        ),
        flush=True,
    )

    print(
        (
            "Batch contract: "
            f"{BATCH_CONTRACT}"
        ),
        flush=True,
    )

    if ALLOWED:
        print(
            (
                "Privileged monitoring chat IDs: "
                + ", ".join(
                    str(x)
                    for x in sorted(
                        ALLOWED
                    )
                )
            ),
            flush=True,
        )

    else:
        print(
            (
                "BOT_ALLOWED_CHAT_IDS is empty. "
                "/connect and /register work, "
                "but privileged monitoring commands "
                "are disabled."
            ),
            flush=True,
        )

    state = load_state()

    last_scan = 0.0

    while True:
        try:
            params = {
                "offset": state.get(
                    "offset",
                    0,
                ),
                "timeout": 10,
                "allowed_updates": [
                    "message"
                ],
            }

            try:
                updates = telegram(
                    "getUpdates",
                    params,
                )

            except (
                TimeoutError,
                socket.timeout,
                urllib.error.URLError,
            ):
                # Telegram long polling can time out
                # occasionally. Continue normally.
                updates = []

            for update in updates:
                state["offset"] = max(
                    state.get(
                        "offset",
                        0,
                    ),
                    update["update_id"]
                    + 1,
                )

                message = update.get(
                    "message",
                    {},
                )

                chat = message.get(
                    "chat",
                    {},
                )

                chat_id = chat.get(
                    "id"
                )

                chat_type = chat.get(
                    "type",
                    "",
                )

                content = message.get(
                    "text",
                    "",
                )

                sender = message.get(
                    "from",
                    {},
                )

                username = sender.get(
                    "username"
                )

                if (
                    not isinstance(
                        chat_id,
                        int,
                    )
                    or chat_type != "private"
                    or not isinstance(
                        content,
                        str,
                    )
                    or not content.startswith(
                        "/"
                    )
                ):
                    continue

                parts = content.strip().split(
                    maxsplit=1
                )

                op = (
                    parts[0]
                    .lower()
                    .split(
                        "@",
                        1,
                    )[0]
                    if parts
                    else ""
                )

                try:
                    if handle_public_command(
                        chat_id,
                        username,
                        op,
                    ):
                        save(
                            state
                        )
                        continue

                    if chat_id not in ALLOWED:
                        send(
                            chat_id,
                            (
                                "This command is restricted. "
                                "Use /help for available commands."
                            ),
                        )

                        save(
                            state
                        )
                        continue

                    handle_privileged(
                        chat_id,
                        content,
                        state,
                    )

                except Exception as exc:
                    print(
                        "Command error:",
                        repr(
                            exc
                        ),
                        flush=True,
                    )

                    try:
                        send(
                            chat_id,
                            (
                                "Temporary error. "
                                "Please try again."
                            ),
                        )

                    except Exception:
                        pass

                save(
                    state
                )

            if (
                time.monotonic()
                - last_scan
                > POLL_INTERVAL
            ):
                # Existing privileged wallet / legacy
                # payment link monitoring.
                for (
                    cid,
                    chat_state,
                ) in state[
                    "chats"
                ].items():
                    numeric_cid = int(
                        cid
                    )

                    if (
                        numeric_cid
                        not in ALLOWED
                    ):
                        continue

                    try:
                        scan_wallet(
                            numeric_cid,
                            chat_state,
                        )

                        scan_links(
                            numeric_cid,
                            chat_state,
                        )

                        save(
                            state
                        )

                    except Exception as exc:
                        print(
                            "Legacy scan error:",
                            repr(
                                exc
                            ),
                            flush=True,
                        )

                # New automatic Batch Split monitoring.
                try:
                    scan_batch_bills()

                except Exception as exc:
                    print(
                        "Batch scan error:",
                        repr(
                            exc
                        ),
                        flush=True,
                    )

                last_scan = (
                    time.monotonic()
                )

        except KeyboardInterrupt:
            save(
                state
            )

            print(
                "Stopped.",
                flush=True,
            )

            break

        except Exception as exc:
            print(
                "Bot loop error:",
                repr(
                    exc
                ),
                flush=True,
            )

            time.sleep(
                5
            )


if __name__ == "__main__":
    main()