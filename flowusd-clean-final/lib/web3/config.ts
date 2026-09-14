// Circle's Arc network (https://docs.arc.io) — an EVM-compatible L1 where
// USDC is the native gas token. This app only ever targets Arc **Testnet**:
// no real money is involved.
//
// Reference: https://docs.arc.io/arc/references/contract-addresses

export const ARC_TESTNET_CHAIN_ID_DEC = 5042002;
export const ARC_TESTNET_CHAIN_ID_HEX = "0x4cef52"; // 5042002 in hex

export const ARC_TESTNET_PARAMS = {
  chainId: ARC_TESTNET_CHAIN_ID_HEX,
  chainName: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    // The native gas token uses 18 decimals on Arc. We don't use this value
    // directly for balances/transfers — see USDC_DECIMALS below.
    decimals: 18,
  },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

// Arc's docs recommend integrating against the standard ERC-20 interface for
// USDC (rather than the native 18-decimal gas balance) for reading balances
// and sending transfers, since it behaves like any other ERC-20 token.
export const USDC_CONTRACT_ADDRESS =
  "0x3600000000000000000000000000000000000000";

export const USDC_DECIMALS = 6;

// The FlowUSD Payment Links registry (see /contracts/FlowUSDPaymentLinks.sol).
// This is a contract WE deploy ourselves — unlike USDC above, there is no
// canonical address for it. Fill this in after deploying via Remix; the
// on-chain payment link UI stays hidden until it's set.
export const PAYMENT_LINKS_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_PAYMENT_LINKS_CONTRACT_ADDRESS || "";

// FlowUSDSwap + FlowSwapToken (see /contracts/FlowUSDSwap.sol and
// FlowSwapToken.sol). Also contracts WE deploy ourselves — fill these in
// after deploying via Remix.
export const SWAP_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_SWAP_CONTRACT_ADDRESS || "";
export const SWAP_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_SWAP_TOKEN_ADDRESS || "";
export const SWAP_TOKEN_SYMBOL = "FST";

export const ARC_FAUCET_URL = "https://faucet.circle.com/";
export const ARC_EXPLORER_URL = "https://testnet.arcscan.app";

export function explorerAddressUrl(address: string) {
  return `${ARC_EXPLORER_URL}/address/${address}`;
}

export function explorerTxUrl(hash: string) {
  return `${ARC_EXPLORER_URL}/tx/${hash}`;
}
