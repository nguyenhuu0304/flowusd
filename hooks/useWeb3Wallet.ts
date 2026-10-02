"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getEthereumProvider,
  type Eip1193Provider,
} from "@/lib/web3/provider";

import {
  discoverProviders,
  type Eip6963ProviderDetail,
} from "@/lib/web3/discovery";

import {
  ARC_TESTNET_CHAIN_ID_DEC,
  ARC_TESTNET_CHAIN_ID_HEX,
  ARC_TESTNET_PARAMS,
} from "@/lib/web3/config";

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

type WalletConnectProviderLike = Eip1193Provider & {
  connect?: (options?: {
    chains?: number[];
    optionalChains?: number[];
    rpcMap?: Record<number, string>;
  }) => Promise<unknown>;
  disconnect?: () => Promise<void>;
  session?: unknown;
};

const LEGACY_DISCOVERY_TIMEOUT_MS = 300;

const WALLETCONNECT_UUID = "walletconnect";
const WALLETCONNECT_NAME = "Mobile Wallet / WalletConnect";

export const FLOWUSD_SELECTED_WALLET_KEY =
  "flowusd:selected-wallet-uuid";

export const FLOWUSD_CONNECTED_ADDRESS_KEY =
  "flowusd:connected-address";

const WALLET_SYNC_EVENT = "flowusd:wallet-sync";

type WalletSyncDetail = {
  uuid: string | null;
  address: string | null;
  chainId: string | null;
};

let walletConnectSingleton:
  | WalletConnectProviderLike
  | null = null;

let walletConnectInitPromise:
  | Promise<WalletConnectProviderLike>
  | null = null;

function normalizeChainId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    return "0x" + BigInt(value).toString(16);
  } catch {
    return null;
  }
}

function normalizeAddress(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^0x[a-fA-F0-9]{40}$/.test(value)
  ) {
    return null;
  }

  return value;
}

function readAccounts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" &&
      /^0x[a-fA-F0-9]{40}$/.test(item)
  );
}

function publishWalletState(detail: WalletSyncDetail) {
  if (typeof window === "undefined") return;

  if (detail.uuid) {
    localStorage.setItem(
      FLOWUSD_SELECTED_WALLET_KEY,
      detail.uuid
    );
  } else {
    localStorage.removeItem(
      FLOWUSD_SELECTED_WALLET_KEY
    );
  }

  if (detail.address) {
    localStorage.setItem(
      FLOWUSD_CONNECTED_ADDRESS_KEY,
      detail.address
    );
  } else {
    localStorage.removeItem(
      FLOWUSD_CONNECTED_ADDRESS_KEY
    );
  }

  window.dispatchEvent(
    new CustomEvent<WalletSyncDetail>(
      WALLET_SYNC_EVENT,
      { detail }
    )
  );
}

async function getProviderState(
  provider: Eip1193Provider
) {
  const [accountsResponse, chainResponse] =
    await Promise.all([
      provider.request({
        method: "eth_accounts",
      }),
      provider.request({
        method: "eth_chainId",
      }),
    ]);

  const accounts = readAccounts(accountsResponse);

  return {
    address: accounts[0] ?? null,
    chainId: normalizeChainId(chainResponse),
  };
}

async function getWalletConnectProvider(): Promise<WalletConnectProviderLike> {
  if (walletConnectSingleton) {
    return walletConnectSingleton;
  }

  if (walletConnectInitPromise) {
    return walletConnectInitPromise;
  }

  walletConnectInitPromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error(
        "WalletConnect is only available in the browser."
      );
    }

    const projectId =
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

    if (!projectId) {
      throw new Error(
        "Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID."
      );
    }

    const { EthereumProvider } = await import(
      "@walletconnect/ethereum-provider"
    );

    const rpcUrl =
      ARC_TESTNET_PARAMS.rpcUrls[0];

    const provider =
      await EthereumProvider.init({
        projectId,
        optionalChains: [
          ARC_TESTNET_CHAIN_ID_DEC,
        ],
        showQrModal: true,
        rpcMap: {
          [ARC_TESTNET_CHAIN_ID_DEC]:
            rpcUrl,
        },
        methods: [
          "eth_accounts",
          "eth_requestAccounts",
          "eth_chainId",
          "eth_call",
          "eth_sendTransaction",
          "personal_sign",
          "eth_signTypedData",
          "eth_signTypedData_v4",
          "wallet_switchEthereumChain",
          "wallet_addEthereumChain",
        ],
        events: [
          "accountsChanged",
          "chainChanged",
        ],
        metadata: {
          name: "FlowUSD",
          description:
            "USDC payments on Circle Arc Testnet",
          url: window.location.origin,
          icons: [
            `${window.location.origin}/favicon.ico`,
          ],
        },
        qrModalOptions: {
          enableMobileFullScreen: true,
        },
      });

    walletConnectSingleton =
      provider as unknown as WalletConnectProviderLike;

    return walletConnectSingleton;
  })();

  try {
    return await walletConnectInitPromise;
  } catch (error) {
    walletConnectInitPromise = null;
    throw error;
  }
}

export function useWeb3Wallet() {
  const [discovered, setDiscovered] =
    useState<Eip6963ProviderDetail[]>([]);

  const [legacyFallback, setLegacyFallback] =
    useState<Eip1193Provider | null>(null);

  const [
    walletConnectProvider,
    setWalletConnectProvider,
  ] = useState<WalletConnectProviderLike | null>(
    null
  );

  const [discoveryDone, setDiscoveryDone] =
    useState(false);

  const [selectedUuid, setSelectedUuid] =
    useState<string | null>(null);

  const [address, setAddress] =
    useState<string | null>(null);

  const [chainId, setChainId] =
    useState<string | null>(null);

  const [balance, setBalance] =
    useState<string | null>(null);

  const [connecting, setConnecting] =
    useState(false);

  const [loadingBalance, setLoadingBalance] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedUuid = localStorage.getItem(
      FLOWUSD_SELECTED_WALLET_KEY
    );

    setSelectedUuid(savedUuid);
  }, []);

  useEffect(() => {
    const seen =
      new Map<string, Eip6963ProviderDetail>();

    const stopListening = discoverProviders(
      (detail) => {
        seen.set(detail.info.uuid, detail);
        setDiscovered(Array.from(seen.values()));
      }
    );

    const timeout = setTimeout(() => {
      if (seen.size === 0) {
        setLegacyFallback(
          getEthereumProvider()
        );
      }

      setDiscoveryDone(true);
    }, LEGACY_DISCOVERY_TIMEOUT_MS);

    return () => {
      stopListening();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const projectId =
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

    if (!projectId) {
      return;
    }

    let active = true;

    void getWalletConnectProvider()
      .then((provider) => {
        if (active) {
          setWalletConnectProvider(provider);
        }
      })
      .catch((error) => {
        console.warn(
          "[wallet] WalletConnect initialization failed:",
          error instanceof Error
            ? error.message
            : String(error)
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const wallets: WalletOption[] = useMemo(() => {
    const items: WalletOption[] = [];

    if (discovered.length > 0) {
      items.push(
        ...discovered.map((detail) => ({
          uuid: detail.info.uuid,
          name: detail.info.name,
          icon: detail.info.icon,
          provider: detail.provider,
        }))
      );
    } else if (legacyFallback) {
      items.push({
        uuid: "legacy",
        name: "Browser Wallet",
        provider: legacyFallback,
      });
    }

    if (walletConnectProvider) {
      items.push({
        uuid: WALLETCONNECT_UUID,
        name: WALLETCONNECT_NAME,
        provider: walletConnectProvider,
      });
    }

    return items;
  }, [
    discovered,
    legacyFallback,
    walletConnectProvider,
  ]);

  const selectedWallet =
    wallets.find(
      (item) => item.uuid === selectedUuid
    ) ?? null;

  const needsWalletSelection =
    wallets.length > 1 && !selectedWallet;

  const isOnArcTestnet =
    normalizeChainId(chainId) ===
    ARC_TESTNET_CHAIN_ID_HEX;

  const persistAddress = useCallback(
    (next: string | null) => {
      const valid = normalizeAddress(next);

      setAddress(valid);

      if (typeof window === "undefined") {
        return;
      }

      if (valid) {
        localStorage.setItem(
          FLOWUSD_CONNECTED_ADDRESS_KEY,
          valid
        );
      } else {
        localStorage.removeItem(
          FLOWUSD_CONNECTED_ADDRESS_KEY
        );
      }
    },
    []
  );

  const refreshBalance = useCallback(
    async (
      provider: Eip1193Provider,
      addr: string
    ) => {
      setLoadingBalance(true);

      try {
        const state = await getProviderState(
          provider
        );

        if (
          state.chainId !==
            ARC_TESTNET_CHAIN_ID_HEX ||
          state.address?.toLowerCase() !==
            addr.toLowerCase()
        ) {
          setBalance(null);
          return;
        }

        const value = await getUsdcBalance(
          provider,
          addr
        );

        const latest =
          await getProviderState(provider);

        if (
          latest.chainId ===
            ARC_TESTNET_CHAIN_ID_HEX &&
          latest.address?.toLowerCase() ===
            addr.toLowerCase()
        ) {
          setBalance(value);
        } else {
          setBalance(null);
        }
      } catch (error) {
        setBalance(null);

        console.warn(
          "[wallet] Balance refresh failed:",
          error instanceof Error
            ? error.message
            : String(error)
        );
      } finally {
        setLoadingBalance(false);
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleSync(event: Event) {
      const detail = (
        event as CustomEvent<WalletSyncDetail>
      ).detail;

      if (!detail) return;

      setSelectedUuid(detail.uuid);
      setAddress(
        normalizeAddress(detail.address)
      );
      setChainId(
        normalizeChainId(detail.chainId)
      );
      setBalance(null);
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key !==
          FLOWUSD_SELECTED_WALLET_KEY &&
        event.key !==
          FLOWUSD_CONNECTED_ADDRESS_KEY
      ) {
        return;
      }

      setSelectedUuid(
        localStorage.getItem(
          FLOWUSD_SELECTED_WALLET_KEY
        )
      );

      setAddress(null);
      setChainId(null);
      setBalance(null);
    }

    window.addEventListener(
      WALLET_SYNC_EVENT,
      handleSync
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        WALLET_SYNC_EVENT,
        handleSync
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  useEffect(() => {
    const provider = selectedWallet?.provider;

    if (!provider) {
      setAddress(null);
      setChainId(null);
      setBalance(null);
      return;
    }

    let active = true;

    async function restore() {
      try {
        const state =
          await getProviderState(provider!);

        if (!active) return;

        setAddress(state.address);
        setChainId(state.chainId);
        setBalance(null);
      } catch (error) {
        if (!active) return;

        setAddress(null);
        setChainId(null);
        setBalance(null);

        console.debug(
          "[wallet] Restore failed:",
          error
        );
      }
    }

    void restore();

    return () => {
      active = false;
    };
  }, [selectedWallet?.provider]);

  useEffect(() => {
    const provider = selectedWallet?.provider;

    if (!provider?.on || !selectedWallet) {
      return;
    }

    const uuid = selectedWallet.uuid;
    let active = true;

    async function synchronize() {
      try {
        const state =
          await getProviderState(provider!);

        if (!active) return;

        setAddress(state.address);
        setChainId(state.chainId);
        setBalance(null);

        publishWalletState({
          uuid,
          address: state.address,
          chainId: state.chainId,
        });
      } catch (error) {
        console.error(
          "[wallet] Synchronization failed:",
          error
        );
      }
    }

    function handleAccountsChanged(
      ..._args: unknown[]
    ) {
      setBalance(null);
      void synchronize();
    }

    function handleChainChanged(
      ..._args: unknown[]
    ) {
      setBalance(null);
      void synchronize();
    }

    function handleDisconnect(
      ..._args: unknown[]
    ) {
      setSelectedUuid(null);
      setAddress(null);
      setChainId(null);
      setBalance(null);

      publishWalletState({
        uuid: null,
        address: null,
        chainId: null,
      });
    }

    provider.on(
      "accountsChanged",
      handleAccountsChanged
    );

    provider.on(
      "chainChanged",
      handleChainChanged
    );

    provider.on(
      "disconnect",
      handleDisconnect
    );

    return () => {
      active = false;

      provider.removeListener?.(
        "accountsChanged",
        handleAccountsChanged
      );

      provider.removeListener?.(
        "chainChanged",
        handleChainChanged
      );

      provider.removeListener?.(
        "disconnect",
        handleDisconnect
      );
    };
  }, [
    selectedWallet?.provider,
    selectedWallet?.uuid,
  ]);

  useEffect(() => {
    if (
      !address ||
      !isOnArcTestnet ||
      !selectedWallet
    ) {
      setBalance(null);
      return;
    }

    void refreshBalance(
      selectedWallet.provider,
      address
    );
  }, [
    address,
    isOnArcTestnet,
    selectedWallet?.provider,
    refreshBalance,
  ]);

  const connectWith = useCallback(
    async (wallet: WalletOption) => {
      setConnecting(true);

      try {
        if (wallet.uuid === WALLETCONNECT_UUID) {
          const wc =
            wallet.provider as WalletConnectProviderLike;

          const rpcUrl =
            ARC_TESTNET_PARAMS.rpcUrls[0];

          if (!wc.session && wc.connect) {
            await wc.connect({
              chains: [
                ARC_TESTNET_CHAIN_ID_DEC,
              ],
              optionalChains: [
                ARC_TESTNET_CHAIN_ID_DEC,
              ],
              rpcMap: {
                [ARC_TESTNET_CHAIN_ID_DEC]:
                  rpcUrl,
              },
            });
          }
        }

        await requestAccounts(
          wallet.provider
        );

        await ensureArcTestnet(
          wallet.provider
        );

        const state =
          await getProviderState(
            wallet.provider
          );

        if (
          state.chainId !==
          ARC_TESTNET_CHAIN_ID_HEX
        ) {
          throw new Error(
            "Please switch to Arc Testnet."
          );
        }

        if (!state.address) {
          throw new Error(
            "No wallet account is authorized."
          );
        }

        setSelectedUuid(wallet.uuid);
        setChainId(state.chainId);
        persistAddress(state.address);
        setBalance(null);

        publishWalletState({
          uuid: wallet.uuid,
          address: state.address,
          chainId: state.chainId,
        });
      } catch (error) {
        console.error(
          "[wallet] Connection failed:",
          error
        );

        throw error;
      } finally {
        setConnecting(false);
      }
    },
    [persistAddress]
  );

  const connect = useCallback(
    async () => {
      const target =
        selectedWallet ??
        (wallets.length === 1
          ? wallets[0]
          : null);

      if (!target) {
        if (wallets.length === 0) {
          const projectId =
            process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

          if (!projectId) {
            throw new Error(
              "No browser wallet detected and WalletConnect is not configured."
            );
          }

          throw new Error(
            "WalletConnect is still initializing. Try again in a moment."
          );
        }

        throw new Error(
          "Multiple wallets detected. Choose a wallet."
        );
      }

      await connectWith(target);
    },
    [
      wallets,
      selectedWallet,
      connectWith,
    ]
  );

  const disconnect = useCallback(() => {
    const current = selectedWallet;

    if (
      current?.uuid === WALLETCONNECT_UUID
    ) {
      const wc =
        current.provider as WalletConnectProviderLike;

      void wc.disconnect?.().catch(
        (error) => {
          console.warn(
            "[wallet] WalletConnect disconnect failed:",
            error
          );
        }
      );
    }

    setSelectedUuid(null);
    persistAddress(null);
    setChainId(null);
    setBalance(null);

    publishWalletState({
      uuid: null,
      address: null,
      chainId: null,
    });
  }, [
    persistAddress,
    selectedWallet,
  ]);

  const send = useCallback(
    async (
      to: string,
      amount: string
    ) => {
      if (!address || !selectedWallet) {
        throw new Error(
          "Wallet not connected."
        );
      }

      setSending(true);

      try {
        const provider =
          selectedWallet.provider;

        const state =
          await getProviderState(provider);

        if (
          state.chainId !==
          ARC_TESTNET_CHAIN_ID_HEX
        ) {
          throw new Error(
            "Switch to Arc Testnet before sending."
          );
        }

        if (
          state.address?.toLowerCase() !==
          address.toLowerCase()
        ) {
          throw new Error(
            "Wallet account changed. Reconnect before sending."
          );
        }

        const hash =
          await sendUsdcTransfer(
            provider,
            address,
            to,
            amount
          );

        void refreshBalance(
          provider,
          address
        );

        return hash;
      } finally {
        setSending(false);
      }
    },
    [
      address,
      selectedWallet,
      refreshBalance,
    ]
  );

  return {
    isMetaMaskAvailable:
      wallets.length > 0,

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

    provider:
      selectedWallet?.provider ?? null,

    connect,
    connectWith,
    disconnect,
    send,

    refreshBalance: () =>
      selectedWallet && address
        ? refreshBalance(
            selectedWallet.provider,
            address
          )
        : undefined,
  };
}