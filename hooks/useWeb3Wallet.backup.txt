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

const LEGACY_DISCOVERY_TIMEOUT_MS = 300;

export const FLOWUSD_SELECTED_WALLET_KEY = "flowusd:selected-wallet-uuid";
export const FLOWUSD_CONNECTED_ADDRESS_KEY = "flowusd:connected-address";

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSelectedUuid(window.localStorage.getItem(FLOWUSD_SELECTED_WALLET_KEY));
    setAddress(window.localStorage.getItem(FLOWUSD_CONNECTED_ADDRESS_KEY));
  }, []);

  useEffect(() => {
    const seen = new Map<string, Eip6963ProviderDetail>();

    const stopListening = discoverProviders((detail) => {
      seen.set(detail.info.uuid, detail);
      setDiscovered(Array.from(seen.values()));
    });

    const timeout = setTimeout(() => {
      if (seen.size === 0) setLegacyFallback(getEthereumProvider());
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
      return [{ uuid: "legacy", name: "Browser Wallet", provider: legacyFallback }];
    }

    return [];
  }, [discovered, legacyFallback]);

  const selectedWallet = wallets.find((w) => w.uuid === selectedUuid) ?? null;
  const needsWalletSelection = wallets.length > 1 && !selectedWallet;
  const isOnArcTestnet = chainId === ARC_TESTNET_CHAIN_ID_HEX;

  const persistAddress = useCallback((next: string | null) => {
    setAddress(next);
    if (typeof window === "undefined") return;

    if (next) {
      window.localStorage.setItem(FLOWUSD_CONNECTED_ADDRESS_KEY, next);
    } else {
      window.localStorage.removeItem(FLOWUSD_CONNECTED_ADDRESS_KEY);
    }
  }, []);

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

  useEffect(() => {
    if (!address || !isOnArcTestnet || !selectedWallet) return;
    void refreshBalance(selectedWallet.provider, address);
  }, [address, isOnArcTestnet, selectedWallet, refreshBalance]);

  useEffect(() => {
    const provider = selectedWallet?.provider;
    if (!provider?.on) return;

    function handleAccountsChanged(...args: unknown[]) {
      const accounts = args[0] as string[];
      persistAddress(accounts.length > 0 ? accounts[0] : null);
      if (accounts.length === 0) setBalance(null);
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
  }, [selectedWallet, persistAddress]);

  useEffect(() => {
    if (!selectedWallet) return;

    let active = true;
    (async () => {
      try {
        const [accounts, currentChain] = await Promise.all([
          selectedWallet.provider.request({ method: "eth_accounts" }) as Promise<string[]>,
          selectedWallet.provider.request({ method: "eth_chainId" }) as Promise<string>,
        ]);

        if (!active) return;
        setChainId(currentChain);
        if (accounts[0]) persistAddress(accounts[0]);
      } catch (error) {
        console.debug("[wallet] restore failed:", error);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedWallet, persistAddress]);

  const connectWith = useCallback(async (wallet: WalletOption) => {
    setSelectedUuid(wallet.uuid);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(FLOWUSD_SELECTED_WALLET_KEY, wallet.uuid);
    }

    setConnecting(true);

    try {
      const accounts = await requestAccounts(wallet.provider);
      await ensureArcTestnet(wallet.provider);

      const newChainId = await wallet.provider.request({ method: "eth_chainId" });
      setChainId(newChainId as string);
      persistAddress(accounts[0] ?? null);
    } catch (error) {
      console.error("[wallet] connectWith failed:", error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [persistAddress]);

  const connect = useCallback(async () => {
    const target = selectedWallet ?? (wallets.length === 1 ? wallets[0] : null);

    if (!target) {
      if (wallets.length === 0) {
        throw new Error("No wallet extension found. Install MetaMask to continue.");
      }

      throw new Error("Multiple wallets detected — pick one from the list below.");
    }

    await connectWith(target);
  }, [wallets, selectedWallet, connectWith]);

  const disconnect = useCallback(() => {
    persistAddress(null);
    setBalance(null);
    setSelectedUuid(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(FLOWUSD_SELECTED_WALLET_KEY);
    }
  }, [persistAddress]);

  const send = useCallback(
    async (to: string, amount: string) => {
      if (!address || !selectedWallet) throw new Error("Wallet not connected.");

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
    provider: selectedWallet?.provider ?? null,
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
