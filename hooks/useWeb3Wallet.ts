"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getEthereumProvider, type Eip1193Provider } from "@/lib/web3/provider";
import { discoverProviders, type Eip6963ProviderDetail } from "@/lib/web3/discovery";
import { ARC_TESTNET_CHAIN_ID_HEX } from "@/lib/web3/config";
import {
  ensureArcTestnet,
  getUsdcBalance,
  requestAccounts,
  sendUsdcTransfer,
} from "@/lib/web3/wallet";

export type WalletOption = {
  uuid: string;
  name: string;
  icon?: string;
  provider: Eip1193Provider;
};

const LEGACY_DISCOVERY_TIMEOUT_MS = 200;

export function useWeb3Wallet() {
  const [discovered, setDiscovered] = useState<Eip6963ProviderDetail[]>([]);
  const [legacyFallback, setLegacyFallback] = useState<Eip1193Provider | null>(null);
  const [discoveryDone, setDiscoveryDone] = useState(false);

  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [sending, setSending] = useState(false);

  // Discover every wallet extension that supports EIP-6963. If none
  // respond after a short wait, fall back to the legacy window.ethereum
  // slot (older wallets that don't support EIP-6963 yet).
  useEffect(() => {
    const seen = new Map<string, Eip6963ProviderDetail>();

    const stopListening = discoverProviders((detail) => {
      seen.set(detail.info.uuid, detail);
      setDiscovered(Array.from(seen.values()));
    });

    const timeout = setTimeout(() => {
      if (seen.size === 0) {
        setLegacyFallback(getEthereumProvider());
      }
      setDiscoveryDone(true);
    }, LEGACY_DISCOVERY_TIMEOUT_MS);

    return () => {
      stopListening();
      clearTimeout(timeout);
    };
  }, []);

  const wallets: WalletOption[] = useMemo(() => {
    if (discovered.length > 0) {
      return discovered.map((d) => ({
        uuid: d.info.uuid,
        name: d.info.name,
        icon: d.info.icon,
        provider: d.provider,
      }));
    }

    if (legacyFallback) {
      return [
        {
          uuid: "legacy",
          name: "Browser Wallet",
          provider: legacyFallback,
        },
      ];
    }

    return [];
  }, [discovered, legacyFallback]);

  const selectedWallet =
    wallets.find((w) => w.uuid === selectedUuid) ?? null;

  const needsWalletSelection = wallets.length > 1 && !selectedWallet;

  const isOnArcTestnet = chainId === ARC_TESTNET_CHAIN_ID_HEX;

  const refreshBalance = useCallback(
    async (provider: Eip1193Provider, addr: string) => {
      setLoadingBalance(true);

      try {
        const value = await getUsdcBalance(provider, addr);
        setBalance(value);
      } catch (error) {
        console.error("Failed to load on-chain USDC balance:", error);
      } finally {
        setLoadingBalance(false);
      }
    },
    []
  );

  // Once we have an address on the right network, load its balance.
  useEffect(() => {
    if (!address || !isOnArcTestnet || !selectedWallet) return;

    let active = true;

    (async () => {
      if (active) await refreshBalance(selectedWallet.provider, address);
    })();

    return () => {
      active = false;
    };
  }, [address, isOnArcTestnet, selectedWallet, refreshBalance]);

  // React to the user switching accounts/networks from inside their wallet.
  useEffect(() => {
    const provider = selectedWallet?.provider;
    if (!provider?.on) return;

    function handleAccountsChanged(...args: unknown[]) {
      const accounts = args[0] as string[];
      setAddress(accounts.length > 0 ? accounts[0] : null);

      if (accounts.length === 0) {
        setBalance(null);
      }
    }

    function handleChainChanged(...args: unknown[]) {
      setChainId(args[0] as string);
    }

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [selectedWallet]);

  const connectWith = useCallback(async (wallet: WalletOption) => {
    setSelectedUuid(wallet.uuid);
    setConnecting(true);

    try {
      const accounts = await requestAccounts(wallet.provider);
      await ensureArcTestnet(wallet.provider);

      const newChainId = await wallet.provider.request({
        method: "eth_chainId",
      });

      setChainId(newChainId as string);
      setAddress(accounts[0] ?? null);
    } catch (error) {
      console.error("[wallet] connectWith failed:", error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Convenience entry point: reuses the already-selected wallet when one
  // exists (e.g. re-triggering a network switch), otherwise falls back to
  // the sole detected wallet. When more than one wallet is installed and
  // none has been chosen yet, the UI should call `connectWith` directly
  // once the person picks one from the list.
  const connect = useCallback(async () => {
    const target = selectedWallet ?? (wallets.length === 1 ? wallets[0] : null);

    if (!target) {
      if (wallets.length === 0) {
        throw new Error(
          "No wallet extension found. Install MetaMask to continue."
        );
      }

      throw new Error(
        "Multiple wallets detected — pick one from the list below."
      );
    }

    await connectWith(target);
  }, [wallets, selectedWallet, connectWith]);

  const disconnect = useCallback(() => {
    // Wallets don't expose a real "disconnect" API to dapps — this just
    // resets our own UI state. The wallet extension stays connected until
    // the user revokes access from within it.
    setAddress(null);
    setBalance(null);
    setSelectedUuid(null);
  }, []);

  const send = useCallback(
    async (to: string, amount: string) => {
      if (!address || !selectedWallet) {
        throw new Error("Wallet not connected.");
      }

      setSending(true);

      try {
        const hash = await sendUsdcTransfer(
          selectedWallet.provider,
          address,
          to,
          amount
        );
        await refreshBalance(selectedWallet.provider, address);
        return hash;
      } finally {
        setSending(false);
      }
    },
    [address, selectedWallet, refreshBalance]
  );

  return {
    isMetaMaskAvailable: wallets.length > 0,
    discoveryDone,
    wallets,
    needsWalletSelection,
    address,
    chainId,
    isOnArcTestnet,
    balance,
    connecting,
    loadingBalance,
    sending,
    connect,
    connectWith,
    disconnect,
    send,
    refreshBalance: () =>
      selectedWallet && address
        ? refreshBalance(selectedWallet.provider, address)
        : undefined,
  };
}
