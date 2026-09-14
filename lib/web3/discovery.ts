import type { Eip1193Provider } from "./provider";

// EIP-6963: Multi Injected Provider Discovery.
// https://eips.ethereum.org/EIPS/eip-6963
//
// When more than one wallet extension is installed (MetaMask + Coinbase
// Wallet, etc.), they all compete for the single legacy `window.ethereum`
// slot — whichever one wins can silently swallow requests meant for a
// different wallet. EIP-6963 fixes this: every modern wallet announces
// itself via a browser event instead, so we can list them all and let the
// person pick the one they actually want to use.

export type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

export type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
};

type Eip6963AnnounceEvent = Event & {
  detail?: Eip6963ProviderDetail;
};

// Starts listening for wallet announcements and asks every installed
// wallet to announce itself. Returns a cleanup function.
export function discoverProviders(
  onAnnounce: (detail: Eip6963ProviderDetail) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleAnnounce(event: Event) {
    const detail = (event as Eip6963AnnounceEvent).detail;

    if (detail?.info && detail?.provider) {
      onAnnounce(detail);
    }
  }

  window.addEventListener("eip6963:announceProvider", handleAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  return () => {
    window.removeEventListener("eip6963:announceProvider", handleAnnounce);
  };
}
