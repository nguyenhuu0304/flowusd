# FlowUSD

> Open-source USDC payment experience built for Arc.

FlowUSD is an open-source application that demonstrates how to build modern stablecoin payment experiences on the Arc network.

The project focuses on simplicity, developer experience, and real-world payment flows powered by native USDC — combining a polished fintech-style UI with genuine on-chain functionality where it counts.

---

## ✨ Vision

FlowUSD aims to make stablecoin payments feel as simple as using a modern fintech application.

Instead of building another wallet, FlowUSD focuses on practical payment experiences such as:

- Send USDC
- Receive payments
- Payment Links & QR Payments
- Transaction Memo
- Merchant Dashboard

Built for developers, creators, and businesses.

---

## 🚀 Features

### Live today

- Modern landing page, responsive UI
- Email/password authentication with **email verification codes** (register → confirm password → 6-digit code emailed via Resend → account created)
- Wallet balance + address (backed by bundled demo API routes, in-memory data)
- Send USDC (deducts balance, records a transaction)
- Receive USDC (address + QR code)
- **Payment Links** — create a shareable link and QR code to request a payment, with a fixed amount or an open "any amount" request. Anyone with the link can pay it — no login and no wallet address needed on their end.
- **Swap** — convert between demo USDC/EURC/USDT balances (simulated rates)
- **Earn (Lending)** — deposit USDC to earn a simulated fixed APY
- Transaction history, search/filter, and detail view
- Dashboard overview (real stats derived from transaction data)
- **Real wallet connection (MetaMask, Arc Testnet)** — connects an actual wallet, reads your real testnet USDC balance, and sends a real on-chain transfer. No private keys ever touch the app; every transaction is signed and confirmed inside the wallet itself.

### Coming soon (built and tested — pending Arc Mainnet)

FlowUSD ships **three smart contracts we wrote and deployed ourselves** (see [`/contracts`](./contracts)) — not third-party protocols:

- `FlowUSDPaymentLinks.sol` — an on-chain payment-link registry. Records a request and settles it by moving USDC directly from payer to creator; the contract never custodies funds.
- `FlowSwapToken.sol` + `FlowUSDSwap.sol` — a minimal, fixed-rate two-way exchange between USDC and a demo token, deployed and controlled by us rather than a random unaudited testnet DEX.

Both were successfully deployed and exercised end-to-end on Arc Testnet during development (real `approve`/`transfer`/swap transactions, confirmed on ArcScan). They're currently switched off in the hosted demo because **Arc Testnet's state was reset ahead of Arc Mainnet's public launch on September 16, 2026**, which took our deployed addresses down along with it. The UI shows a "Coming soon" card for these two sections in the meantime — see [`/contracts/README.md`](./contracts/README.md) for redeploy instructions once Mainnet (or a fresh testnet) is available.

### Planned

- Merchant dashboard & payment analytics
- Real Arc Mainnet support for the on-chain features above
- Dark mode

---

## 🛠 Tech Stack

- Next.js 16
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Solidity (hand-rolled, dependency-free contract bindings — no ethers.js/viem)
- Arc
- Native USDC

---

## 📂 Project Structure

```
flowusd/
│
├── app/
│   ├── (auth)/            # login, register
│   ├── (protected)/       # dashboard, wallet, send, receive, payment-links, swap, earn, transactions
│   ├── api/                # demo backend (in-memory), Next.js route handlers
│   └── pay/[id]/           # public payment-link page (no login required)
│
├── components/
│   ├── dashboard/
│   ├── layout/
│   ├── marketing/
│   └── ui/
│
├── contracts/              # Solidity source for the on-chain features (see contracts/README.md)
├── lib/
│   ├── api/                 # client-side fetch wrappers
│   ├── server/               # demo backend logic (auth, db, email, finance)
│   └── web3/                # wallet connection + contract ABI encoding
├── hooks/
├── public/
│
├── README.md
├── package.json
└── tsconfig.json
```

---

## 🗺 Roadmap

### Sprint 1

- [x] Project setup
- [x] GitHub repository
- [x] Landing Page
- [x] Open-source foundation

### Sprint 2

- [ ] Improve Landing Page
- [ ] Dark Mode
- [ ] Responsive polish

### Sprint 3

- [x] Connect Arc Wallet
- [x] Wallet UI
- [x] Network Configuration

### Sprint 4

- [x] Send USDC
- [x] Receive Payments
- [x] Transaction Memo

### Sprint 5

- [x] Payment Links
- [x] QR Payments
- [x] Payment Requests
- [x] On-chain payment-link registry contract (deployed + tested on Testnet; re-enabling post-Mainnet)

### Sprint 6

- [x] Transaction History
- [ ] Merchant Dashboard
- [ ] Analytics

### Sprint 7

- [ ] Documentation
- [x] Deployment (Vercel-ready, zero config)
- [ ] Community Contributions

---

## 💻 Local Development

Clone the repository:

```bash
git clone https://github.com/nguyenhuu0304/flowusd.git
cd flowusd
```

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

That's it — one command. The demo API (wallet/transactions/auth) is now
implemented as Next.js route handlers under `app/api/`, served by the same
process as the frontend, so there's no separate backend to start.

Open:

```
http://localhost:3000
```

Log in with the seeded demo account (already verified, skips the email
step), or register a new one:

```
email: demo@flowusd.app
password: demo1234
```

### 📧 Setting up email verification (optional for local dev)

Registering a **new** account requires entering a 6-digit code sent by
email. You don't have to set anything up to test this locally — without
an email provider configured, the code is printed to your terminal
(where `npm run dev` is running) instead of being emailed, so you can
still complete the flow.

To have it actually send real emails (needed once deployed, if you want
other people to be able to register):

1. Sign up at **[resend.com](https://resend.com)** (free tier is enough).
2. Create an API key.
3. Add it as an environment variable:
   - Local dev: create `.env.local` in the project root with:
     ```
     RESEND_API_KEY=rere_your_key_here
     ```
   - Vercel: Project Settings → Environment Variables → add `RESEND_API_KEY`.
4. Without verifying your own domain in Resend, you can only send to the
   email address you signed up with — fine for testing, but verify a
   domain in Resend (and set `EMAIL_FROM`) before relying on this for
   real users.

> The demo API keeps its data in server memory (seeded from `mock/db.json`), so sending USDC actually updates the balance and transaction history for as long as the server keeps running — it resets on restart. See `lib/server/db.ts` for the "swap this for a real database" notes.

### 🔗 Real wallet connection (Arc Testnet)

The **Wallet** page also has an "On-chain Wallet" card that connects to an
actual browser wallet — no separate setup needed, but you'll want:

1. **[MetaMask](https://metamask.io/download)** (or any EIP-1193 wallet) installed in your browser.
2. Click **Connect Wallet**. The app will ask your wallet to add/switch to
   **Arc Testnet** automatically (chain ID `5042002`, RPC
   `https://rpc.testnet.arc.network`).
3. Your balance will show `0 USDC` the first time — get free testnet USDC
   (also used to pay gas) from the **[Circle Faucet](https://faucet.circle.com/)**
   (select "Arc Testnet").
4. Sending from this card submits a **real transaction on Arc Testnet** —
   your wallet will show a confirmation popup before anything is signed or
   broadcast. Every transaction can be viewed on
   **[ArcScan](https://testnet.arcscan.app)**.

This is completely separate from the "App Wallet (Demo)" card above — that
one is fake balance/data from `mock/db.json`; this one is a real testnet
blockchain. No production/mainnet funds are ever involved, and the app
never asks for or stores a private key.

### 📜 Re-enabling the on-chain Payment Links / Swap contracts

These ship fully coded and were verified working on Arc Testnet, but are
switched off by default (see "Coming soon" above). To turn them back on
once you have a live network to deploy to, see **[`contracts/README.md`](./contracts/README.md)**
for the full Remix deployment walkthrough, then set:

```
NEXT_PUBLIC_PAYMENT_LINKS_CONTRACT_ADDRESS=0xyour_deployed_address
NEXT_PUBLIC_SWAP_CONTRACT_ADDRESS=0xyour_deployed_address
NEXT_PUBLIC_SWAP_TOKEN_ADDRESS=0xyour_deployed_address
```

in `.env.local`, then restart `npm run dev`. Each card checks for its own
address and only renders once configured — no code changes needed.

---

## ☁️ Deploy to Vercel

The app is set up to deploy on Vercel with **zero required configuration**
— no environment variables are needed for the app to run, though you can
optionally add `RESEND_API_KEY` (see the email verification section above)
so new-account emails actually get delivered instead of only appearing in
your deployment's function logs.

1. Push this project to a GitHub repository (create one if you haven't:
   `git init && git add . && git commit -m "FlowUSD"`, then push it up).
2. Go to **[vercel.com/new](https://vercel.com/new)**, sign in, and import
   that GitHub repository.
3. Leave all settings at their defaults (Vercel auto-detects Next.js) and
   click **Deploy**.
4. You'll get a live URL like `https://your-project.vercel.app` — that's
   your shareable link.

**Good to know about this specific setup:**

- The demo API (`app/api/**`) keeps its data in memory (see
  `lib/server/db.ts`), which is why zero setup is needed — but it means
  data resets whenever the serverless function cold-starts or you push a
  new deploy. That's expected and fine for a demo/portfolio link; if you
  want changes to persist for real, swap `lib/server/db.ts` for a real
  database (Vercel Postgres, Vercel KV, Supabase, etc.) — nothing else in
  the app needs to change, since every route only talks to the functions
  exported from that one file.
- The "Real Wallet Connection" (MetaMask + Arc Testnet) feature needs no
  changes at all to work after deploying — it talks directly to the
  visitor's own wallet and to Arc's public testnet RPC, not to your server.

---

## 🤝 Contributing

Contributions are welcome.

If you'd like to improve FlowUSD:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

---

## 📄 License

This project will be released under the MIT License.

---

## ❤️ Built for Arc

FlowUSD is an independent open-source project created to explore modern USDC payment experiences on Arc.
