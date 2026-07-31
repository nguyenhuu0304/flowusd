# FlowUSD

> Open-source USDC payment experience built for Arc.

FlowUSD is an open-source application that demonstrates how to build modern stablecoin payment experiences on the Arc network.

The project focuses on simplicity, developer experience, and real-world payment flows powered by native USDC.

---

## ✨ Vision

FlowUSD aims to make stablecoin payments feel as simple as using a modern fintech application.

Instead of building another wallet, FlowUSD focuses on practical payment experiences such as:

- Send USDC
- Receive payments
- Payment Links
- QR Payments
- Transaction Memo
- Merchant Dashboard

Built for developers, creators, and businesses.

---

## 🚀 Features

Current:

- Modern Landing Page
- Email/password authentication (register, login, persisted session)
- Wallet balance + address (backed by bundled demo API routes, in-memory data)
- Send USDC (deducts balance, records a transaction)
- Receive USDC (address + QR code)
- Transaction history, search/filter, and detail view
- Dashboard overview (real stats derived from transaction data)
- **Real wallet connection (MetaMask, Arc Testnet)** — connects an actual
  wallet, reads your real testnet USDC balance, and sends a real (testnet)
  on-chain transfer. No private keys ever touch the app; every transaction
  is signed and confirmed inside the wallet itself.
- Responsive UI
- Open-source architecture

Planned:

- Payment Requests / Payment Links
- Merchant Tools

---

## 🛠 Tech Stack

- Next.js 16
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Arc
- Native USDC

---

## 📂 Project Structure

```
flowusd/
│
├── app/
├── components/
│   ├── dashboard/
│   ├── layout/
│   ├── marketing/
│   └── ui/
│
├── lib/
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

- [ ] Send USDC
- [ ] Receive Payments
- [ ] Transaction Memo

### Sprint 5

- [ ] Payment Links
- [ ] QR Payments
- [ ] Payment Requests

### Sprint 6

- [ ] Merchant Dashboard
- [ ] Transaction History
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

Log in with the seeded demo account, or register a new one:

```
email: demo@flowusd.app
password: demo1234
```

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

---

## ☁️ Deploy to Vercel

The app is set up to deploy on Vercel with **zero configuration** — no
environment variables, no separate server to stand up.

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

This project is not an official Arc product.