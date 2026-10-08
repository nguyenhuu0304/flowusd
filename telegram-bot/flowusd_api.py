"""

FlowUSD Telegram Bridge API



FlowUSD Web <-> wallet signature auth <-> Telegram member directory

<-> confirmed Batch bill sync.



This version also sends the first-stage Telegram notification:

    Bill created / synced -> registered member receives PAYMENT DUE.



The existing Telegram bot remains responsible for the second-stage

notification:

    Member pays -> Telegram receives PAID confirmation.



No private keys or seed phrases are requested or stored.

"""



from __future__ import annotations



import json

import os

import secrets

import sqlite3

import time

import urllib.error

import urllib.parse

import urllib.request

from contextlib import contextmanager

from decimal import Decimal

from pathlib import Path

from typing import Any



from eth_account import Account

from eth_account.messages import encode_defunct

from fastapi import Depends, FastAPI, Header, HTTPException

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field





# ============================================================

# Configuration

# ============================================================



BASE_DIR = Path(__file__).resolve().parent

DB_PATH = BASE_DIR / "telegram_state.db"

BOT_ENV_PATH = BASE_DIR / ".env.bot.local"





def load_local_env(path: Path) -> None:

    """

    Load simple KEY=VALUE lines from .env.bot.local.



    Existing process environment variables win.

    """

    if not path.exists():

        return



    try:

        for raw_line in path.read_text(

            encoding="utf-8"

        ).splitlines():

            line = raw_line.strip()



            if (

                not line

                or line.startswith("#")

                or "=" not in line

            ):

                continue



            key, value = line.split("=", 1)



            key = key.strip()

            value = value.strip()



            if key:

                os.environ.setdefault(

                    key,

                    value,

                )

    except OSError:

        pass





load_local_env(BOT_ENV_PATH)





ARC_RPC_URL = os.getenv(

    "ARC_RPC_URL",

    "https://rpc.testnet.arc.network",

).strip()



BATCH_CONTRACT_ADDRESS = os.getenv(

    "BATCH_PAYMENT_LINKS_CONTRACT_ADDRESS",

    "0x9F96951eF27BadE6dCeee185341994a80A411d02",

).strip().lower()



TELEGRAM_BOT_TOKEN = os.getenv(

    "TELEGRAM_BOT_TOKEN",

    "",

).strip()



FLOWUSD_APP_URL = os.getenv(

    "FLOWUSD_APP_URL",

    "http://localhost:3000",

).strip().rstrip("/")



ACCESS_TOKEN_TTL = 0  # 0 = no automatic expiry

CHALLENGE_TTL = 300



GET_LINK_SELECTOR = "0xf7291121"



DEFAULT_CORS = [

    "http://localhost:3000",

    "http://127.0.0.1:3000",

    "https://flowusd.vercel.app",

]



cors_env = os.getenv(

    "FLOWUSD_CORS_ORIGINS",

    "",

).strip()



CORS_ORIGINS = (

    [

        item.strip()

        for item in cors_env.split(",")

        if item.strip()

    ]

    if cors_env

    else DEFAULT_CORS

)





# ============================================================

# FastAPI

# ============================================================



app = FastAPI(

    title="FlowUSD Telegram Bridge API",

    version="1.1.3",

)



app.add_middleware(

    CORSMiddleware,

    allow_origins=CORS_ORIGINS,

    allow_credentials=False,

    allow_methods=[

        "GET",

        "POST",

        "PATCH",

        "OPTIONS",

    ],

    allow_headers=[

        "Authorization",

        "Content-Type",

    ],

)





# ============================================================

# Validation helpers

# ============================================================



def normalize_wallet(value: str) -> str:

    wallet = value.strip().lower()



    if (

        len(wallet) != 42

        or not wallet.startswith("0x")

        or any(

            char not in "0123456789abcdef"

            for char in wallet[2:]

        )

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid wallet address.",

        )



    return wallet





def normalize_tx_hash(value: str) -> str:

    tx_hash = value.strip().lower()



    if (

        len(tx_hash) != 66

        or not tx_hash.startswith("0x")

        or any(

            char not in "0123456789abcdef"

            for char in tx_hash[2:]

        )

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid transaction hash.",

        )



    return tx_hash





def valid_bytes32(value: str) -> bool:

    text = value.strip().lower()



    return (

        len(text) == 66

        and text.startswith("0x")

        and all(

            char in "0123456789abcdef"

            for char in text[2:]

        )

    )





def now_ts() -> int:

    return int(time.time())





def random_token(size: int = 32) -> str:

    return secrets.token_urlsafe(size)





def raw_usdc_to_text(raw: str) -> str:

    try:

        value = Decimal(int(raw)) / Decimal(

            1_000_000

        )



        text = format(

            value,

            "f",

        )



        if "." in text:

            text = text.rstrip("0").rstrip(".")



        return text or "0"



    except Exception:

        return raw





# ============================================================

# Database

# ============================================================



@contextmanager

def db():

    connection = sqlite3.connect(

        DB_PATH,

        timeout=15,

    )



    connection.row_factory = sqlite3.Row



    try:

        connection.execute(

            "PRAGMA journal_mode=WAL"

        )



        connection.execute(

            "PRAGMA foreign_keys=ON"

        )



        yield connection

        connection.commit()



    finally:

        connection.close()





def init_db() -> None:

    with db() as con:

        con.executescript(

            """

            CREATE TABLE IF NOT EXISTS telegram_codes (

                code TEXT PRIMARY KEY,

                kind TEXT NOT NULL,

                chat_id INTEGER NOT NULL,

                username TEXT,

                expires_at INTEGER NOT NULL,

                created_at INTEGER NOT NULL

            );



            CREATE TABLE IF NOT EXISTS challenges (

                nonce TEXT PRIMARY KEY,

                wallet TEXT NOT NULL,

                kind TEXT NOT NULL,

                code TEXT,

                message TEXT NOT NULL,

                expires_at INTEGER NOT NULL,

                created_at INTEGER NOT NULL

            );



            CREATE TABLE IF NOT EXISTS owners (

                wallet TEXT PRIMARY KEY,

                chat_id INTEGER NOT NULL,

                username TEXT,

                linked_at INTEGER NOT NULL

            );



            CREATE TABLE IF NOT EXISTS sessions (

                token TEXT PRIMARY KEY,

                wallet TEXT NOT NULL,

                expires_at INTEGER NOT NULL,

                created_at INTEGER NOT NULL

            );



            CREATE TABLE IF NOT EXISTS directory (

                id TEXT PRIMARY KEY,

                owner_wallet TEXT NOT NULL,

                telegram_chat_id INTEGER NOT NULL,

                username TEXT,

                display_name TEXT NOT NULL,

                full_name TEXT NOT NULL DEFAULT '',

                created_at INTEGER NOT NULL,

                updated_at INTEGER NOT NULL,

                UNIQUE(owner_wallet, telegram_chat_id)

            );



            CREATE TABLE IF NOT EXISTS bills (

                id TEXT NOT NULL,

                owner_wallet TEXT NOT NULL,

                creator TEXT NOT NULL,

                title TEXT NOT NULL,

                total_raw TEXT NOT NULL,

                tx_hash TEXT NOT NULL,

                payload_json TEXT NOT NULL,

                created_at INTEGER NOT NULL,

                updated_at INTEGER NOT NULL,

                PRIMARY KEY(id, owner_wallet)

            );



            CREATE TABLE IF NOT EXISTS due_notifications (

                owner_wallet TEXT NOT NULL,

                bill_id TEXT NOT NULL,

                link_id TEXT NOT NULL,

                directory_id TEXT NOT NULL,

                telegram_chat_id INTEGER NOT NULL,

                sent_at INTEGER NOT NULL,

                PRIMARY KEY(

                    owner_wallet,

                    bill_id,

                    link_id

                )

            );

            CREATE TABLE IF NOT EXISTS creator_notifications (

                owner_wallet TEXT NOT NULL,

                bill_id TEXT NOT NULL,

                telegram_chat_id INTEGER NOT NULL,

                sent_at INTEGER NOT NULL,

                PRIMARY KEY(

                    owner_wallet,

                    bill_id

                )

            );

            """

        )





init_db()





# ============================================================

# Arc RPC

# ============================================================



def rpc(

    method: str,

    params: list[Any] | None = None,

) -> Any:

    body = json.dumps(

        {

            "jsonrpc": "2.0",

            "id": 1,

            "method": method,

            "params": params or [],

        }

    ).encode("utf-8")



    request = urllib.request.Request(

        ARC_RPC_URL,

        data=body,

        headers={

            "Content-Type": "application/json",

            "Accept": "application/json",

            "User-Agent": "FlowUSD/1.0",

        },

        method="POST",

    )



    last_error: Exception | None = None



    for attempt in range(3):

        try:

            with urllib.request.urlopen(

                request,

                timeout=20,

            ) as response:

                result = json.load(response)



            if result.get("error"):

                raise RuntimeError(

                    str(

                        result["error"].get(

                            "message",

                            result["error"],

                        )

                    )

                )



            return result.get("result")



        except urllib.error.HTTPError as exc:

            last_error = exc



            if (

                exc.code != 429

                or attempt == 2

            ):

                break



            time.sleep(

                2 * (attempt + 1)

            )



        except Exception as exc:

            last_error = exc

            break



    raise HTTPException(

        status_code=503,

        detail=(

            "Arc RPC unavailable: "

            f"{last_error}"

        ),

    )





def verify_creation_transaction(

    tx_hash: str,

) -> dict[str, Any]:

    receipt = rpc(

        "eth_getTransactionReceipt",

        [tx_hash],

    )



    if not receipt:

        raise HTTPException(

            status_code=409,

            detail=(

                "Transaction receipt not found yet."

            ),

        )



    status = receipt.get("status")



    if status not in (

        "0x1",

        "0x01",

        1,

    ):

        raise HTTPException(

            status_code=409,

            detail=(

                "Creation transaction is not successful."

            ),

        )



    if BATCH_CONTRACT_ADDRESS:

        target = str(

            receipt.get("to") or ""

        ).lower()



        if (

            target

            != BATCH_CONTRACT_ADDRESS

        ):

            raise HTTPException(

                status_code=409,

                detail=(

                    "Transaction does not target "

                    "the configured Batch contract."

                ),

            )



    return receipt





def read_batch_link(

    link_id: str,

) -> dict[str, Any]:

    if not valid_bytes32(link_id):

        raise ValueError(

            "Invalid Batch Link ID."

        )



    result = rpc(

        "eth_call",

        [

            {

                "to": BATCH_CONTRACT_ADDRESS,

                "data": (

                    GET_LINK_SELECTOR

                    + link_id[2:]

                ),

            },

            "latest",

        ],

    )



    if not isinstance(

        result,

        str,

    ):

        raise ValueError(

            "Unexpected Batch contract response."

        )



    data = result.removeprefix("0x")



    if len(data) < 5 * 64:

        raise ValueError(

            "Malformed Batch link response."

        )



    words = [

        data[

            index * 64:

            (index + 1) * 64

        ]

        for index in range(5)

    ]



    creator = (

        "0x" +

        words[0][-40:]

    )



    amount_raw = int(

        words[1],

        16,

    )



    paid = (

        int(

            words[2],

            16,

        )

        > 0

    )



    payer = (

        "0x" +

        words[3][-40:]

    )



    return {

        "creator": creator.lower(),

        "amount_raw": amount_raw,

        "paid": paid,

        "payer": payer.lower(),

    }





# ============================================================

# Telegram send helper

# ============================================================



def send_telegram(
    chat_id: int,
    message: str,
    reply_markup: dict[str, Any] | None = None,
) -> None:
    if not TELEGRAM_BOT_TOKEN:
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN is not configured."
        )

    url = (
        "https://api.telegram.org/bot"
        f"{TELEGRAM_BOT_TOKEN}/sendMessage"
    )

    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": message[:4000],
        "disable_web_page_preview": True,
    }

    if reply_markup is not None:
        payload["reply_markup"] = reply_markup

    body = json.dumps(
        payload
    ).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "FlowUSD/1.0",
        },
        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=20,
    ) as response:
        result = json.load(response)

    if not result.get("ok"):
        raise RuntimeError(
            str(
                result.get(
                    "description",
                    "Telegram API error",
                )
            )
        )


# ============================================================

# Signature helpers

# ============================================================



def build_message(

    wallet: str,

    nonce: str,

    purpose: str,

) -> str:

    return (

        "FlowUSD Telegram authentication\n"

        f"Wallet: {wallet}\n"

        f"Purpose: {purpose}\n"

        f"Nonce: {nonce}\n\n"

        "Signing this message does not send a blockchain "

        "transaction and does not grant access to your funds."

    )





def verify_signature(

    wallet: str,

    message: str,

    signature: str,

) -> None:

    try:

        recovered = Account.recover_message(

            encode_defunct(

                text=message

            ),

            signature=signature,

        ).lower()



    except Exception as exc:

        raise HTTPException(

            status_code=401,

            detail=(

                "Invalid wallet signature: "

                f"{exc}"

            ),

        ) from exc



    if recovered != wallet:

        raise HTTPException(

            status_code=401,

            detail=(

                "Wallet signature does not match "

                "connected wallet."

            ),

        )





# ============================================================

# Authentication

# ============================================================



def issue_session(

    wallet: str,

) -> dict[str, Any]:

    """

    Issue a persistent owner session.



    expires_at = 0 means the session does not expire automatically.

    The token can still be removed/revoked manually later.

    """

    token = random_token()



    created = now_ts()

    expires = 0



    with db() as con:

        # Clean up only legacy sessions that had a real expiry.

        # Persistent sessions use expires_at = 0 and must not be deleted here.

        con.execute(

            """

            DELETE FROM sessions

            WHERE expires_at > 0

              AND expires_at <= ?

            """,

            (created,),

        )



        con.execute(

            """

            INSERT INTO sessions(

                token,

                wallet,

                expires_at,

                created_at

            )

            VALUES (?, ?, ?, ?)

            """,

            (

                token,

                wallet,

                expires,

                created,

            ),

        )



    return {

        "accessToken": token,

        "expiresIn": 0,

        "persistent": True,

    }





def current_wallet(

    authorization: str | None = Header(

        default=None

    ),

) -> str:

    if not authorization:

        raise HTTPException(

            status_code=401,

            detail=(

                "Missing Authorization header."

            ),

        )



    prefix = "Bearer "



    if not authorization.startswith(

        prefix

    ):

        raise HTTPException(

            status_code=401,

            detail=(

                "Invalid Authorization header."

            ),

        )



    token = authorization[

        len(prefix):

    ].strip()



    with db() as con:

        row = con.execute(

            """

            SELECT

                wallet,

                expires_at

            FROM sessions

            WHERE token = ?

            """,

            (token,),

        ).fetchone()



        if not row:

            raise HTTPException(

                status_code=401,

                detail="Invalid session.",

            )



        expires_at = int(

            row["expires_at"]

        )



        # expires_at = 0 is a persistent session with no automatic expiry.

        if (

            expires_at > 0

            and expires_at <= now_ts()

        ):

            con.execute(

                """

                DELETE FROM sessions

                WHERE token = ?

                """,

                (token,),

            )



            raise HTTPException(

                status_code=401,

                detail=(

                    "Telegram wallet session expired."

                ),

            )



        return str(

            row["wallet"]

        )





# ============================================================

# Request models

# ============================================================



class PairChallengeRequest(

    BaseModel

):

    wallet: str



    code: str = Field(

        min_length=1,

        max_length=100,

    )





class OwnerChallengeRequest(

    BaseModel

):

    wallet: str





class ConnectRequest(

    BaseModel

):

    wallet: str

    code: str | None = None

    nonce: str

    signature: str





class DirectoryCreateRequest(

    BaseModel

):

    code: str = Field(

        min_length=1,

        max_length=100,

    )



    displayName: str = Field(

        min_length=1,

        max_length=60,

    )



    fullName: str = Field(

        default="",

        max_length=120,

    )





class DirectoryUpdateRequest(

    BaseModel

):

    displayName: str = Field(

        min_length=1,

        max_length=60,

    )



    fullName: str = Field(

        default="",

        max_length=120,

    )





class BillMember(

    BaseModel

):

    id: str

    name: str

    raw: str

    directoryId: str | None = None





class BillSyncRequest(

    BaseModel

):

    id: str

    creator: str

    title: str

    totalRaw: str

    txHash: str

    members: list[BillMember]





# ============================================================

# Health

# ============================================================



@app.get("/")

def root() -> dict[str, Any]:

    return {

        "name": (

            "FlowUSD Telegram Bridge API"

        ),

        "status": "ok",

        "version": "1.1.3",

        "port": 8787,

    }





@app.get("/health")

def health() -> dict[str, Any]:

    return {

        "ok": True,

        "arcRpc": ARC_RPC_URL,

        "database": str(DB_PATH),

        "batchContract": (

            BATCH_CONTRACT_ADDRESS

        ),

        "telegramConfigured": bool(

            TELEGRAM_BOT_TOKEN

        ),

        "flowusdAppUrl": (

            FLOWUSD_APP_URL

        ),

    }





# ============================================================

# Telegram owner pairing

# ============================================================



@app.post("/api/challenge")

def create_pair_challenge(

    payload: PairChallengeRequest,

) -> dict[str, Any]:

    wallet = normalize_wallet(

        payload.wallet

    )



    code = payload.code.strip()



    with db() as con:

        row = con.execute(

            """

            SELECT

                code,

                kind,

                expires_at

            FROM telegram_codes

            WHERE code = ?

            """,

            (code,),

        ).fetchone()



        if not row:

            raise HTTPException(

                status_code=400,

                detail=(

                    "Invalid Telegram pairing code."

                ),

            )



        if (

            row["kind"]

            != "connect"

        ):

            raise HTTPException(

                status_code=400,

                detail=(

                    "This code is not a /connect code."

                ),

            )



        if (

            int(

                row["expires_at"]

            )

            <= now_ts()

        ):

            con.execute(

                """

                DELETE FROM telegram_codes

                WHERE code = ?

                """,

                (code,),

            )



            raise HTTPException(

                status_code=400,

                detail=(

                    "Telegram pairing code expired. "

                    "Generate a new /connect code."

                ),

            )



        nonce = random_token(

            24

        )



        message = build_message(

            wallet,

            nonce,

            "Link Telegram",

        )



        con.execute(

            """

            INSERT INTO challenges(

                nonce,

                wallet,

                kind,

                code,

                message,

                expires_at,

                created_at

            )

            VALUES (?, ?, ?, ?, ?, ?, ?)

            """,

            (

                nonce,

                wallet,

                "connect",

                code,

                message,

                (

                    now_ts()

                    + CHALLENGE_TTL

                ),

                now_ts(),

            ),

        )



    return {

        "nonce": nonce,

        "message": message,

    }





@app.post("/api/connect")

def connect_wallet(

    payload: ConnectRequest,

) -> dict[str, Any]:

    wallet = normalize_wallet(

        payload.wallet

    )



    if not payload.code:

        raise HTTPException(

            status_code=400,

            detail=(

                "Telegram pairing code required."

            ),

        )



    code = payload.code.strip()



    with db() as con:

        challenge = con.execute(

            """

            SELECT *

            FROM challenges

            WHERE nonce = ?

              AND wallet = ?

              AND kind = 'connect'

            """,

            (

                payload.nonce,

                wallet,

            ),

        ).fetchone()



        if not challenge:

            raise HTTPException(

                status_code=400,

                detail=(

                    "Invalid wallet challenge."

                ),

            )



        if (

            int(

                challenge["expires_at"]

            )

            <= now_ts()

        ):

            con.execute(

                """

                DELETE FROM challenges

                WHERE nonce = ?

                """,

                (

                    payload.nonce,

                ),

            )



            raise HTTPException(

                status_code=400,

                detail=(

                    "Wallet challenge expired."

                ),

            )



        if (

            challenge["code"]

            != code

        ):

            raise HTTPException(

                status_code=400,

                detail=(

                    "Pairing code mismatch."

                ),

            )



        code_row = con.execute(

            """

            SELECT *

            FROM telegram_codes

            WHERE code = ?

              AND kind = 'connect'

            """,

            (code,),

        ).fetchone()



        if not code_row:

            raise HTTPException(

                status_code=400,

                detail=(

                    "Telegram pairing code already "

                    "used or invalid."

                ),

            )



        if (

            int(

                code_row["expires_at"]

            )

            <= now_ts()

        ):

            raise HTTPException(

                status_code=400,

                detail=(

                    "Telegram pairing code expired."

                ),

            )



        verify_signature(

            wallet,

            str(

                challenge["message"]

            ),

            payload.signature,

        )



        con.execute(

            """

            INSERT INTO owners(

                wallet,

                chat_id,

                username,

                linked_at

            )

            VALUES (?, ?, ?, ?)

            ON CONFLICT(wallet)

            DO UPDATE SET

                chat_id =

                    excluded.chat_id,

                username =

                    excluded.username,

                linked_at =

                    excluded.linked_at

            """,

            (

                wallet,

                int(

                    code_row["chat_id"]

                ),

                code_row["username"],

                now_ts(),

            ),

        )



        con.execute(

            """

            DELETE FROM telegram_codes

            WHERE code = ?

            """,

            (code,),

        )



        con.execute(

            """

            DELETE FROM challenges

            WHERE nonce = ?

            """,

            (

                payload.nonce,

            ),

        )



    return issue_session(

        wallet

    )





# ============================================================

# Owner session renewal

# ============================================================



@app.post("/api/owner/challenge")

def owner_challenge(

    payload: OwnerChallengeRequest,

) -> dict[str, Any]:

    wallet = normalize_wallet(

        payload.wallet

    )



    with db() as con:

        owner = con.execute(

            """

            SELECT wallet

            FROM owners

            WHERE wallet = ?

            """,

            (wallet,),

        ).fetchone()



        if not owner:

            raise HTTPException(

                status_code=404,

                detail=(

                    "Wallet has not been linked "

                    "to Telegram yet."

                ),

            )



        nonce = random_token(

            24

        )



        message = build_message(

            wallet,

            nonce,

            (

                "Renew Telegram "

                "wallet session"

            ),

        )



        con.execute(

            """

            INSERT INTO challenges(

                nonce,

                wallet,

                kind,

                code,

                message,

                expires_at,

                created_at

            )

            VALUES (?, ?, 'owner', NULL, ?, ?, ?)

            """,

            (

                nonce,

                wallet,

                message,

                (

                    now_ts()

                    + CHALLENGE_TTL

                ),

                now_ts(),

            ),

        )



    return {

        "nonce": nonce,

        "message": message,

    }





@app.post("/api/owner/connect")

def owner_connect(

    payload: ConnectRequest,

) -> dict[str, Any]:

    wallet = normalize_wallet(

        payload.wallet

    )



    with db() as con:

        challenge = con.execute(

            """

            SELECT *

            FROM challenges

            WHERE nonce = ?

              AND wallet = ?

              AND kind = 'owner'

            """,

            (

                payload.nonce,

                wallet,

            ),

        ).fetchone()



        if not challenge:

            raise HTTPException(

                status_code=400,

                detail=(

                    "Invalid wallet renewal challenge."

                ),

            )



        if (

            int(

                challenge["expires_at"]

            )

            <= now_ts()

        ):

            con.execute(

                """

                DELETE FROM challenges

                WHERE nonce = ?

                """,

                (

                    payload.nonce,

                ),

            )



            raise HTTPException(

                status_code=400,

                detail=(

                    "Wallet challenge expired."

                ),

            )



        verify_signature(

            wallet,

            str(

                challenge["message"]

            ),

            payload.signature,

        )



        con.execute(

            """

            DELETE FROM challenges

            WHERE nonce = ?

            """,

            (

                payload.nonce,

            ),

        )



    return issue_session(

        wallet

    )





# ============================================================

# Member Directory

# ============================================================



@app.get("/api/directory")

def directory_list(

    wallet: str = Depends(

        current_wallet

    ),

) -> dict[str, Any]:

    with db() as con:

        rows = con.execute(

            """

            SELECT

                id,

                display_name,

                full_name,

                username

            FROM directory

            WHERE owner_wallet = ?

            ORDER BY

                lower(display_name),

                created_at

            """,

            (wallet,),

        ).fetchall()



    return {

        "members": [

            {

                "id": row["id"],

                "display_name": row[

                    "display_name"

                ],

                "full_name": row[

                    "full_name"

                ],

                "username": row[

                    "username"

                ],

            }

            for row in rows

        ]

    }





@app.post("/api/directory")

def directory_add(

    payload: DirectoryCreateRequest,

    wallet: str = Depends(

        current_wallet

    ),

) -> dict[str, Any]:

    code = payload.code.strip()



    display_name = (

        payload.displayName.strip()

    )



    full_name = (

        payload.fullName.strip()

    )



    with db() as con:

        code_row = con.execute(

            """

            SELECT *

            FROM telegram_codes

            WHERE code = ?

              AND kind = 'register'

            """,

            (code,),

        ).fetchone()



        if not code_row:

            raise HTTPException(

                status_code=400,

                detail=(

                    "Invalid member registration code."

                ),

            )



        if (

            int(

                code_row["expires_at"]

            )

            <= now_ts()

        ):

            con.execute(

                """

                DELETE FROM telegram_codes

                WHERE code = ?

                """,

                (code,),

            )



            raise HTTPException(

                status_code=400,

                detail=(

                    "Member registration code expired."

                ),

            )



        member_id = random_token(

            16

        )



        timestamp = now_ts()



        existing = con.execute(

            """

            SELECT id

            FROM directory

            WHERE owner_wallet = ?

              AND telegram_chat_id = ?

            """,

            (

                wallet,

                int(

                    code_row["chat_id"]

                ),

            ),

        ).fetchone()



        if existing:

            member_id = str(

                existing["id"]

            )



            con.execute(

                """

                UPDATE directory

                SET

                    display_name = ?,

                    full_name = ?,

                    username = ?,

                    updated_at = ?

                WHERE id = ?

                  AND owner_wallet = ?

                """,

                (

                    display_name,

                    full_name,

                    code_row["username"],

                    timestamp,

                    member_id,

                    wallet,

                ),

            )



        else:

            con.execute(

                """

                INSERT INTO directory(

                    id,

                    owner_wallet,

                    telegram_chat_id,

                    username,

                    display_name,

                    full_name,

                    created_at,

                    updated_at

                )

                VALUES (?, ?, ?, ?, ?, ?, ?, ?)

                """,

                (

                    member_id,

                    wallet,

                    int(

                        code_row["chat_id"]

                    ),

                    code_row["username"],

                    display_name,

                    full_name,

                    timestamp,

                    timestamp,

                ),

            )



        con.execute(

            """

            DELETE FROM telegram_codes

            WHERE code = ?

            """,

            (code,),

        )



    return {

        "ok": True,

        "member": {

            "id": member_id,

            "display_name": display_name,

            "full_name": full_name,

            "username": (

                code_row["username"]

            ),

        },

    }





@app.patch(

    "/api/directory/{member_id}"

)

def directory_update(

    member_id: str,

    payload: DirectoryUpdateRequest,

    wallet: str = Depends(

        current_wallet

    ),

) -> dict[str, Any]:

    display_name = (

        payload.displayName.strip()

    )



    full_name = (

        payload.fullName.strip()

    )



    with db() as con:

        row = con.execute(

            """

            SELECT id

            FROM directory

            WHERE id = ?

              AND owner_wallet = ?

            """,

            (

                member_id,

                wallet,

            ),

        ).fetchone()



        if not row:

            raise HTTPException(

                status_code=404,

                detail=(

                    "Directory member not found."

                ),

            )



        con.execute(

            """

            UPDATE directory

            SET

                display_name = ?,

                full_name = ?,

                updated_at = ?

            WHERE id = ?

              AND owner_wallet = ?

            """,

            (

                display_name,

                full_name,

                now_ts(),

                member_id,

                wallet,

            ),

        )



    return {

        "ok": True,

    }





# ============================================================

# Bill-creator notification

# ============================================================



def notify_creator_bill_created(

    con: sqlite3.Connection,

    wallet: str,

    bill: BillSyncRequest,

) -> bool:

    """
    Notify the Telegram account linked through /connect
    when its wallet creates and syncs a confirmed bill.

    Sent only once per bill.
    """

    if not TELEGRAM_BOT_TOKEN:

        print(
            "Creator notification skipped: TELEGRAM_BOT_TOKEN is not configured.",
            flush=True,
        )

        return False


    existing = con.execute(

        """
        SELECT 1
        FROM creator_notifications
        WHERE owner_wallet = ?
          AND bill_id = ?
        """,

        (
            wallet,
            bill.id,
        ),

    ).fetchone()


    if existing:

        return False


    owner_row = con.execute(

        """
        SELECT
            chat_id,
            username
        FROM owners
        WHERE wallet = ?
        """,

        (wallet,),

    ).fetchone()


    if not owner_row:

        print(
            (
                "Creator notification skipped: "
                f"wallet {wallet} has no /connect mapping."
            ),
            flush=True,
        )

        return False


    chat_id = int(
        owner_row["chat_id"]
    )

    total_text = raw_usdc_to_text(
        bill.totalRaw
    )

    member_count = len(
        bill.members
    )


    message = (

        "? FlowUSD bill created\n\n"

        f"Bill: {bill.title or 'Split bill'}\n"

        f"Total: {total_text} USDC\n"

        f"Members: {member_count}\n"

        f"Status: 0/{member_count} paid\n\n"

        "Confirmed on Arc Testnet.\n"

        f"TX: {bill.txHash}"

    )


    try:

        send_telegram(
            chat_id,
            message,
        )

    except Exception as exc:

        print(
            (
                "Creator notification send failed:"
                f" bill={bill.id}"
                f" chat={chat_id}"
                f" error={repr(exc)}"
            ),
            flush=True,
        )

        return False


    con.execute(

        """
        INSERT INTO creator_notifications(
            owner_wallet,
            bill_id,
            telegram_chat_id,
            sent_at
        )
        VALUES (?, ?, ?, ?)
        """,

        (
            wallet,
            bill.id,
            chat_id,
            now_ts(),
        ),

    )


    print(
        (
            "Creator notification sent:"
            f" bill={bill.title}"
            f" wallet={wallet}"
            f" chat={chat_id}"
        ),
        flush=True,
    )

    return True





# ============================================================

# Payment-due notification

# ============================================================



def notify_payment_due(

    con: sqlite3.Connection,

    wallet: str,

    bill: BillSyncRequest,

) -> tuple[int, int]:

    """

    Send PAYMENT DUE once per bill member.



    Old bills that are already paid do not receive a late due alert.

    """

    sent = 0

    skipped = 0



    if not TELEGRAM_BOT_TOKEN:

        print(

            (

                "Due notification skipped: "

                "TELEGRAM_BOT_TOKEN is not configured."

            ),

            flush=True,

        )



        return (

            sent,

            len(bill.members),

        )



    for member in bill.members:

        directory_id = (

            member.directoryId or ""

        ).strip()



        if not directory_id:

            skipped += 1

            continue



        link_id = (

            member.id.strip()

        )



        if not valid_bytes32(

            link_id

        ):

            skipped += 1

            continue



        existing = con.execute(

            """

            SELECT 1

            FROM due_notifications

            WHERE owner_wallet = ?

              AND bill_id = ?

              AND link_id = ?

            """,

            (

                wallet,

                bill.id,

                link_id.lower(),

            ),

        ).fetchone()



        if existing:

            skipped += 1

            continue



        directory_row = con.execute(

            """

            SELECT

                telegram_chat_id,

                display_name

            FROM directory

            WHERE owner_wallet = ?

              AND id = ?

            """,

            (

                wallet,

                directory_id,

            ),

        ).fetchone()



        if not directory_row:

            skipped += 1

            continue



        try:

            chain = read_batch_link(

                link_id

            )

        except Exception as exc:

            print(

                (

                    "Due notification chain check failed:"

                    f" bill={bill.id}"

                    f" link={link_id}"

                    f" error={repr(exc)}"

                ),

                flush=True,

            )



            skipped += 1

            continue



        # Never send a new "please pay" message for a member

        # who has already paid before this sync.

        if chain["paid"]:

            skipped += 1

            continue



        expected_amount = int(

            member.raw

        )



        if (

            chain["creator"]

            != wallet.lower()

            or chain["amount_raw"]

            != expected_amount

        ):

            print(

                (

                    "Due notification skipped due to "

                    "on-chain owner/amount mismatch:"

                    f" bill={bill.id}"

                    f" link={link_id}"

                ),

                flush=True,

            )



            skipped += 1

            continue



        chat_id = int(

            directory_row[

                "telegram_chat_id"

            ]

        )



        member_name = (

            member.name.strip()

            or directory_row[

                "display_name"

            ]

            or "Member"

        )



        amount_text = (

            raw_usdc_to_text(

                member.raw

            )

        )



        payment_url = (

            f"{FLOWUSD_APP_URL}"

            f"/pay/split/{link_id}"

        )



        is_local_payment_url = (
            payment_url.startswith("http://localhost")
            or payment_url.startswith("http://127.0.0.1")
        )

        if is_local_payment_url:
            message = (
                "💳 FlowUSD payment request\n\n"
                f"Bill: {bill.title or 'Split bill'}\n"
                f"Member: {member_name}\n"
                f"Amount due: {amount_text} USDC\n"
                "Status: Pending payment\n\n"
                "Open payment:\n"
                f"{payment_url}\n\n"
                "Link ID:\n"
                f"{link_id}"
            )
            pay_button = None
        else:
            message = (
                "💳 FlowUSD payment request\n\n"
                f"Bill: {bill.title or 'Split bill'}\n"
                f"Member: {member_name}\n"
                f"Amount due: {amount_text} USDC\n"
                "Status: Pending payment\n\n"
                "Tap the button below to open the payment page.\n\n"
                "Link ID:\n"
                f"{link_id}"
            )
            pay_button = {
                "inline_keyboard": [
                    [
                        {
                            "text": f"💳 Pay {amount_text} USDC",
                            "url": payment_url,
                        }
                    ]
                ]
            }

        try:
            send_telegram(
                chat_id,
                message,
                reply_markup=pay_button,
            )
        except Exception as exc:

            print(

                (

                    "Due notification send failed:"

                    f" bill={bill.id}"

                    f" member={member_name}"

                    f" chat={chat_id}"

                    f" error={repr(exc)}"

                ),

                flush=True,

            )



            skipped += 1

            continue



        con.execute(

            """

            INSERT INTO due_notifications(

                owner_wallet,

                bill_id,

                link_id,

                directory_id,

                telegram_chat_id,

                sent_at

            )

            VALUES (?, ?, ?, ?, ?, ?)

            """,

            (

                wallet,

                bill.id,

                link_id.lower(),

                directory_id,

                chat_id,

                now_ts(),

            ),

        )



        sent += 1



        print(

            (

                "Payment due notification sent:"

                f" bill={bill.title}"

                f" member={member_name}"

                f" chat={chat_id}"

            ),

            flush=True,

        )



    return sent, skipped





# ============================================================

# Bill Sync

# ============================================================



@app.post("/api/bills")

def sync_bill(

    payload: BillSyncRequest,

    wallet: str = Depends(

        current_wallet

    ),

) -> dict[str, Any]:

    creator = normalize_wallet(

        payload.creator

    )



    if creator != wallet:

        raise HTTPException(

            status_code=403,

            detail=(

                "Bill creator does not match "

                "authenticated wallet."

            ),

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



    receipt = (

        verify_creation_transaction(

            tx_hash

        )

    )



    with db() as con:

        for member in payload.members:

            if member.directoryId:

                directory_row = con.execute(

                    """

                    SELECT id

                    FROM directory

                    WHERE id = ?

                      AND owner_wallet = ?

                    """,

                    (

                        member.directoryId,

                        wallet,

                    ),

                ).fetchone()



                if not directory_row:

                    raise HTTPException(

                        status_code=400,

                        detail=(

                            "Unknown directory member for "

                            f"{member.name or 'member'}."

                        ),

                    )



        timestamp = now_ts()



        payload_json = json.dumps(

            payload.model_dump(),

            ensure_ascii=False,

            separators=(

                ",",

                ":",

            ),

        )



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

            ON CONFLICT(id, owner_wallet)

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

                payload.id.strip(),

                wallet,

                creator,

                (

                    payload.title.strip()

                    or "Untitled bill"

                ),

                payload.totalRaw,

                tx_hash,

                payload_json,

                timestamp,

                timestamp,

            ),

        )



        creator_notified = (

            notify_creator_bill_created(

                con,

                wallet,

                payload,

            )

        )



        due_sent, due_skipped = (

            notify_payment_due(

                con,

                wallet,

                payload,

            )

        )



    return {

        "ok": True,

        "creatorNotificationSent": creator_notified,

        "billId": payload.id,

        "txHash": tx_hash,

        "blockNumber": receipt.get(

            "blockNumber"

        ),

        "members": len(

            payload.members

        ),

        "dueNotificationsSent": (

            due_sent

        ),

        "dueNotificationsSkipped": (

            due_skipped

        ),

    }





# ============================================================

# Local development entry point

# ============================================================



if __name__ == "__main__":

    import uvicorn



    uvicorn.run(

        "flowusd_api:app",

        host="127.0.0.1",

        port=8787,

        reload=False,

    )
