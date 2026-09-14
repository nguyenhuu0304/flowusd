# FlowUSD Smart Contracts

Three contracts, all written and deployed by the FlowUSD team — no third-party protocols.

| Contract | Purpose |
|---|---|
| `FlowUSDPaymentLinks.sol` | On-chain payment-link registry. Records a request (`createLink`) and settles it (`pay`) by moving USDC directly from payer to creator via `transferFrom`. Never custodies funds. |
| `FlowSwapToken.sol` | A minimal, standard ERC-20 test token ("FST") used to demonstrate on-chain swapping. Fixed supply, minted entirely to the deployer at creation. |
| `FlowUSDSwap.sol` | A deliberately simple, fixed-rate two-way exchange between USDC and FST. Not an AMM — no price curve, no external oracle — by design, so the whole contract is easy to read and audit in one sitting. |

All three were compiled, deployed, and exercised end-to-end on Arc Testnet
during development — including real `approve`/`transfer`/`swap` transactions
confirmed on [ArcScan](https://testnet.arcscan.app). They're switched off in
the hosted app right now because Arc Testnet's state was reset ahead of
[Arc Mainnet's public launch on September 16, 2026](https://docs.arc.io),
which took the previously-deployed addresses down with it.

## Redeploying (via Remix — no local toolchain needed)

1. Go to **[remix.ethereum.org](https://remix.ethereum.org)**.
2. Create a new file per contract, paste in the matching `.sol` source from this folder.
3. Compile each (Solidity ^0.8.20).
4. Under **Deploy & Run Transactions**, set Environment to **"Injected Provider — MetaMask"** (or "Browser Extension" on newer Remix UIs), with MetaMask connected to the target network.

### Deploy order & constructor arguments

1. **FlowSwapToken** — constructor arg `initialSupply` (e.g. `1000000000000` for 1,000,000 FST, since it uses 6 decimals). Save the deployed address as `TOKEN`.
2. **FlowUSDSwap** — constructor args, in order:
   - `_usdc`: the network's USDC contract address (Arc Testnet: `0x3600000000000000000000000000000000000000` — see [Arc's contract addresses](https://docs.arc.io/arc/references/contract-addresses))
   - `_token`: the `TOKEN` address from step 1
   - `_initialRate`: e.g. `1000000` (1 USDC = 1 FST to start; scaled by 1e6)
3. **FlowUSDPaymentLinks** — constructor arg `_usdc`, same USDC address as above.

### Funding the swap contract's reserves

`FlowUSDSwap` just reads its own token balances as "reserves" — fund it like
any wallet:

- Call `transfer` on the deployed **FlowSwapToken**, `to` = the Swap contract's address, `amount` = however much FST you want as liquidity.
- Do the same on the **USDC** contract (use Remix's "Add a deployed contract" / "At Address" feature with USDC's address, using any ERC-20 ABI already loaded in the workspace — e.g. `FlowSwapToken`'s, since `transfer`/`approve` share the same signatures).

### Wiring the addresses into the app

Set in `.env.local`:

```
NEXT_PUBLIC_PAYMENT_LINKS_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_SWAP_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_SWAP_TOKEN_ADDRESS=0x...
```

Restart `npm run dev`. Each on-chain card checks for its own address and
renders automatically once set — no other code changes needed.

## Design notes

- **No ethers.js/viem dependency.** `lib/web3/*Abi.ts` hand-encodes every call (function selectors verified against `solc`'s own `methodIdentifiers` output, and cross-checked against `ethers.js` during development) — the whole request/response is easy to read line by line without pulling in a large library.
- **Contracts never custody funds beyond what they explicitly need.** Payment Links moves USDC directly payer → creator. The Swap contract's only "custody" is the liquidity the owner deliberately deposits.
- **Fixed-rate exchange, not an AMM.** A constant-product AMM is a much larger surface to get right (and audit) than this project's scope calls for. A fixed rate the owner can update (`setRate`) is a fair trade-off for a demo of "genuine on-chain settlement," while staying auditable at a glance.
