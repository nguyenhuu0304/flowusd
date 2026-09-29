"""FlowUSD Telegram watch bot -- standard library only, read-only Arc Testnet RPC.
Commands: /help /split <total> <people> /watch <wallet> /threshold <USDC> /link <bytes32> /links /status <bytes32> /unwatch.
Whitelist chat IDs in BOT_ALLOWED_CHAT_IDS. Never ask users for keys.
"""
from __future__ import annotations
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal, InvalidOperation
from pathlib import Path

TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '').strip()
ALLOWED = {int(s.strip()) for s in os.getenv('BOT_ALLOWED_CHAT_IDS', '').split(',') if s.strip().isdigit()}
RPC_URL = os.getenv('ARC_RPC_URL', 'https://rpc.testnet.arc.network')
CONTRACT = os.getenv('PAYMENT_LINKS_CONTRACT_ADDRESS', '0xB09880B93fF0F45310fDC88aD7d2A7A4A02b5B85')
USDC = '0x3600000000000000000000000000000000000000'
TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
GET_LINK_SELECTOR = '0xf7291121'
DATA_FILE = Path(__file__).resolve().parent / 'bot_state.json'
WALLET_RE = re.compile(r'^0x[a-fA-F0-9]{40}$')
LINK_RE = re.compile(r'^0x[a-fA-F0-9]{64}$')
SEEN_LIMIT = 1000
POLL_INTERVAL = 35


def http_json(url: str, payload: dict | None = None, timeout: int = 25) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST' if data else 'GET')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == 2:
                raise
            wait = min(30, 5 * (attempt + 1))
            print('Rate limited; sleeping', wait, 'seconds', flush=True)
            time.sleep(wait)
    raise RuntimeError('Request failed')


def rpc(method: str, params: list | None = None):
    result = http_json(RPC_URL, {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params or []})
    if result.get('error'):
        raise RuntimeError(str(result['error'].get('message', result['error'])))
    if 'result' not in result:
        raise RuntimeError('RPC response without result')
    return result['result']


def telegram(method: str, data: dict):
    result = http_json(f'https://api.telegram.org/bot{TOKEN}/{method}', data)
    if not result.get('ok'):
        raise RuntimeError(str(result.get('description', 'Telegram API error')))
    return result.get('result')


def send(chat_id: int, message: str):
    return telegram('sendMessage', {'chat_id': chat_id, 'text': message[:4000], 'disable_web_page_preview': True})


def blank_state():
    return {'offset': 0, 'chats': {}}


def load_state():
    try:
        content = json.loads(DATA_FILE.read_text(encoding='utf-8'))
        return content if isinstance(content.get('chats'), dict) else blank_state()
    except (FileNotFoundError, ValueError, TypeError):
        return blank_state()


def save(state):
    tmp = DATA_FILE.with_suffix('.tmp')
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(DATA_FILE)


def get_chat(state, chat_id: int):
    return state['chats'].setdefault(str(chat_id), {'wallet': '', 'threshold': '1', 'cursor': None, 'links': {}, 'seen': []})


def link_status(link_id: str):
    hex_result = rpc('eth_call', [{'to': CONTRACT, 'data': GET_LINK_SELECTOR + link_id[2:]}, 'latest'])
    data = hex_result.removeprefix('0x')
    if len(data) < 5 * 64:
        raise ValueError('Malformed on-chain link response')
    words = [data[i * 64:(i + 1) * 64] for i in range(5)]
    creator = '0x' + words[0][-40:]
    amount = Decimal(int(words[1], 16)) / Decimal(10 ** 6)
    paid = int(words[2], 16) > 0
    payer = '0x' + words[3][-40:]
    return {'creator': creator, 'amount': amount, 'paid': paid, 'payer': payer}


def handle(chat_id: int, command: str, state):
    chat = get_chat(state, chat_id)
    parts = command.strip().split(maxsplit=1)
    op = parts[0].lower().split('@', 1)[0] if parts else ''
    arg = parts[1].strip() if len(parts) > 1 else ''
    if op in ('/start', '/help'):
        return send(chat_id, 'FlowUSD Arc Testnet watcher\n/split 10 3 — calculate shares\n/watch 0xWallet — watch USDC transfers\n/threshold 5 — minimum alert in USDC\n/link 0xLinkID — track a payment link\n/links — tracked link status\n/status 0xLinkID — check any link\n/unwatch — stop wallet alerts\n\nRead-only. Never share seed phrases/private keys.')
    if op == '/split':
        tokens = arg.split()
        if len(tokens) != 2: return send(chat_id, 'Usage: /split 10 3')
        try:
            amount = Decimal(tokens[0])
            people = int(tokens[1])
            if not amount.is_finite() or amount <= 0 or people < 2 or people > 20 or amount.as_tuple().exponent < -6:
                raise ValueError('Invalid split')
            units = amount * Decimal(1000000)
            if units != units.to_integral_value() or units < people: raise ValueError('Amount too small')
            base, rem = divmod(int(units), people)
            shares = [Decimal(base + (1 if i < rem else 0)) / Decimal(1000000) for i in range(people)]
            detail = '\n'.join(f'Person {i+1}: {share} USDC' for i, share in enumerate(shares))
            return send(chat_id, f'Split {amount} USDC among {people}:\n{detail}\n\nTo create on-chain payment links, connect Rabby at https://flowusd.vercel.app/dashboard and use Split Bill.')
        except (InvalidOperation, ValueError): return send(chat_id, 'Usage: /split 10 3 (2–20 people, max 6 decimal places)')
    if op == '/watch':
        if not WALLET_RE.fullmatch(arg): return send(chat_id, 'Usage: /watch 0x40HexWalletAddress')
        chat['wallet'] = arg.lower()
        chat['cursor'] = int(rpc('eth_blockNumber'), 16)  # Do not report historical transfers as new.
        chat['seen'] = []
        return send(chat_id, f'✅ Watching {arg}\nStarts from current block; no old transactions will be spammed.')
    if op == '/unwatch':
        chat['wallet'] = ''
        return send(chat_id, 'Wallet alerts paused. Saved links stay in /links.')
    if op == '/threshold':
        try:
            val = Decimal(arg)
            if not val.is_finite() or val < 0: raise InvalidOperation()
            chat['threshold'] = str(val)
            return send(chat_id, f'Minimum alert: {val} USDC')
        except (InvalidOperation, ValueError): return send(chat_id, 'Usage: /threshold 5')
    if op == '/link':
        if not LINK_RE.fullmatch(arg): return send(chat_id, 'Usage: /link 0x64HexLinkId')
        item = link_status(arg)
        chat['links'][arg.lower()] = bool(item['paid'])
        return send(chat_id, f"Saved link {arg}\nAmount: {item['amount']} USDC\nStatus: {'Paid' if item['paid'] else 'Unpaid'}\nRecipient: {item['creator']}")
    if op == '/status':
        if not LINK_RE.fullmatch(arg): return send(chat_id, 'Usage: /status 0x64HexLinkId')
        item = link_status(arg)
        return send(chat_id, f"Link: {arg}\nAmount: {item['amount']} USDC\nStatus: {'Paid' if item['paid'] else 'Unpaid'}\nRecipient: {item['creator']}\nPayer: {item['payer'] if item['paid'] else '—'}")
    if op == '/links':
        if not chat['links']: return send(chat_id, 'No tracked links. Use /link 0x...')
        lines = ['Tracked links:']
        for link_id, was_paid in list(chat['links'].items())[:20]:
            item = link_status(link_id)
            lines.append(f"{link_id[:10]}…: {item['amount']} USDC • {'Paid' if item['paid'] else 'Unpaid'}")
        return send(chat_id, '\n'.join(lines))
    return send(chat_id, 'Unknown command. Use /help')


def topic(address: str): return '0x' + address[2:].lower().rjust(64, '0')


def scan_wallet(chat_id: int, chat: dict):
    wallet = chat.get('wallet', '')
    if not WALLET_RE.fullmatch(wallet): return
    current = int(rpc('eth_blockNumber'), 16)
    start = chat.get('cursor')
    if start is None:
        chat['cursor'] = current
        return
    start = int(start) + 1
    if start > current: return
    end = min(current, start + 199)  # Bounded RPC scan, resume on next poll.
    minimum = Decimal(chat.get('threshold', '1'))
    seen = chat.setdefault('seen', [])
    new_messages = []
    for outgoing in (True, False):
        topics = [TRANSFER_TOPIC, topic(wallet)] if outgoing else [TRANSFER_TOPIC, None, topic(wallet)]
        logs = rpc('eth_getLogs', [{'fromBlock': hex(start), 'toBlock': hex(end), 'address': USDC, 'topics': topics}])
        for log in logs:
            if log.get('removed'): continue
            event_id = f"{log['transactionHash'].lower()}:{log.get('logIndex', '0x0')}"
            if event_id in seen: continue
            seen.append(event_id)
            amount = Decimal(int(log['data'], 16)) / Decimal(1000000)
            if amount < minimum: continue
            sender = '0x' + log['topics'][1][-40:]
            recipient = '0x' + log['topics'][2][-40:]
            direction = 'OUT' if outgoing else 'IN'
            new_messages.append(f"💸 {direction} {amount} USDC\nFrom: {sender}\nTo: {recipient}\nhttps://testnet.arcscan.app/tx/{log['transactionHash']}")
        time.sleep(0.35)
    chat['seen'] = seen[-SEEN_LIMIT:]
    chat['cursor'] = end
    for message in new_messages[:15]: send(chat_id, message)


def scan_links(chat_id: int, chat: dict):
    for link_id, old in list(chat.get('links', {}).items())[:20]:
        item = link_status(link_id)
        if not old and item['paid']:
            send(chat_id, f"✅ Payment Link paid: {item['amount']} USDC\nLink: {link_id}\nPayer: {item['payer']}")
        chat['links'][link_id] = bool(item['paid'])
        time.sleep(0.35)


def main():
    if not TOKEN or not ALLOWED:
        raise SystemExit('Set TELEGRAM_BOT_TOKEN and BOT_ALLOWED_CHAT_IDS in environment; see README.')
    print('FlowUSD Telegram read-only bot started (Arc Testnet).', flush=True)
    state = load_state()
    last_scan = 0.0
    while True:
        try:
            params = {'offset': state.get('offset', 0), 'timeout': 10, 'allowed_updates': ['message']}
            updates = telegram('getUpdates', params)
            for update in updates:
                state['offset'] = max(state.get('offset', 0), update['update_id'] + 1)
                message = update.get('message', {})
                chat_id = message.get('chat', {}).get('id')
                content = message.get('text', '')
                if isinstance(chat_id, int) and chat_id in ALLOWED and content.startswith('/'):
                    try: handle(chat_id, content, state)
                    except Exception as exc:
                        print('Command error:', repr(exc), flush=True)
                        send(chat_id, 'RPC temporarily unavailable; retry later.')
                save(state)
            if time.monotonic() - last_scan > POLL_INTERVAL:
                for cid, chat in state['chats'].items():
                    if int(cid) not in ALLOWED: continue
                    try:
                        scan_wallet(int(cid), chat)
                        scan_links(int(cid), chat)
                        save(state)
                    except Exception as exc:
                        print('Scan error:', repr(exc), flush=True)
                last_scan = time.monotonic()
        except KeyboardInterrupt:
            save(state)
            print('Stopped.', flush=True)
            break
        except Exception as exc:
            print('Bot loop error:', repr(exc), flush=True)
            time.sleep(12)

if __name__ == '__main__': main()
