"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownUp, Repeat, Wallet2 } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import {
  getRate,
  getReserves,
  getTokenBalance,
  isSwapContractConfigured,
  swapTokenForUsdc,
  swapUsdcForToken,
} from "@/lib/web3/swapContract";
import {
  SWAP_CONTRACT_ADDRESS,
  SWAP_TOKEN_SYMBOL,
  USDC_DECIMALS,
} from "@/lib/web3/config";
import { parseUnits, formatUnits } from "@/lib/web3/erc20";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/web3/config";
import { shortenAddress } from "@/lib/utils";

type Direction = "usdcToToken" | "tokenToUsdc";

export default function OnChainSwapCard() {
  const wallet = useWeb3Wallet();

  const [direction, setDirection] = useState<Direction>("usdcToToken");
  const [amount, setAmount] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [rate, setRate] = useState<bigint | null>(null);
  const [reserves, setReserves] = useState<{ usdc: string; token: string } | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.provider || !isSwapContractConfigured()) return;

    let active = true;

    async function load() {
      try {
        const [r, res] = await Promise.all([
          getRate(wallet.provider!),
          getReserves(wallet.provider!),
        ]);

        if (!active) return;

        setRate(r);
        setReserves({
          usdc: formatUnits(res.usdcReserve, USDC_DECIMALS),
          token: formatUnits(res.tokenReserve, USDC_DECIMALS),
        });

        if (wallet.address) {
          const bal = await getTokenBalance(wallet.provider!, wallet.address);
          if (active) setTokenBalance(formatUnits(bal, USDC_DECIMALS));
        }
      } catch (error) {
        console.error("Failed to load swap contract state:", error);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [wallet.provider, wallet.address]);

  if (!isSwapContractConfigured()) {
    return (
      <Card className="p-8">
        <div className="mb-3 flex items-center gap-3">
          <Repeat size={20} className="text-slate-400" />
          <h2 className="text-xl font-bold text-slate-900">
            On-chain Swap
          </h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
            Coming soon
          </span>
        </div>

        <p className="text-sm text-slate-500">
          Real on-chain swapping between USDC and a demo token, settled
          through our own deployed contract — not a third-party DEX. We
          deployed and tested this on Arc Testnet already — it&apos;s
          turning back on shortly after Arc Mainnet&apos;s launch on
          September 16, 2026.
        </p>
      </Card>
    );
  }

  const rateLabel =
    rate !== null
      ? `1 USDC = ${formatUnits(rate, USDC_DECIMALS)} ${SWAP_TOKEN_SYMBOL}`
      : "Loading rate...";

  async function handleSwap(e: React.FormEvent) {
    e.preventDefault();

    if (!wallet.address || !wallet.provider) {
      toast.error("Connect your wallet first.");
      return;
    }

    const amountRaw = parseUnits(amount || "0", USDC_DECIMALS);

    if (amountRaw <= BigInt(0)) {
      toast.error("Enter an amount greater than 0.");
      return;
    }

    setSwapping(true);
    setTxHash(null);

    try {
      toast("Approving spend if needed — confirm in your wallet.");

      const hash =
        direction === "usdcToToken"
          ? await swapUsdcForToken(wallet.provider, wallet.address, amountRaw)
          : await swapTokenForUsdc(wallet.provider, wallet.address, amountRaw);

      setTxHash(hash);
      setAmount("");
      toast.success("Swap submitted on-chain!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Swap failed.";
      toast.error(message);
    } finally {
      setSwapping(false);
    }
  }

  return (
    <Card className="p-8">
      <div className="mb-2 flex items-center gap-2">
        <Repeat size={20} className="text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900">
          On-chain Swap (Arc Testnet)
        </h2>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Real transactions against our own deployed swap contract —{" "}
        <a
          href={explorerAddressUrl(SWAP_CONTRACT_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          {shortenAddress(SWAP_CONTRACT_ADDRESS)}
        </a>
        . Fixed rate, not an AMM — a simple, auditable exchange for demo purposes.
      </p>

      <div className="mb-6 rounded-xl bg-slate-50 p-4 text-sm">
        <p className="font-medium text-slate-700">{rateLabel}</p>
        {reserves && (
          <p className="mt-1 text-slate-500">
            Liquidity: {reserves.usdc} USDC / {reserves.token} {SWAP_TOKEN_SYMBOL}
          </p>
        )}
        {tokenBalance && (
          <p className="mt-1 text-slate-500">
            Your {SWAP_TOKEN_SYMBOL} balance: {tokenBalance}
          </p>
        )}
      </div>

      {wallet.needsWalletSelection ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <p className="mb-4 text-center text-slate-600">
            Multiple wallets detected — choose which one to use.
          </p>

          <div className="space-y-3">
            {wallet.wallets.map((w) => (
              <button
                key={w.uuid}
                onClick={() =>
                  wallet.connectWith(w).catch((e) => toast.error(e.message))
                }
                disabled={wallet.connecting}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left font-medium text-slate-900 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {w.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.icon} alt="" className="h-6 w-6 rounded" />
                ) : (
                  <Wallet2 size={20} className="text-blue-600" />
                )}
                <span>{w.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : !wallet.address ? (
        <Button onClick={() => wallet.connect().catch((e) => toast.error(e.message))}>
          {wallet.connecting ? "Connecting..." : "Connect Wallet"}
        </Button>
      ) : (
        <form onSubmit={handleSwap} className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <span className="font-medium text-slate-700">
              {direction === "usdcToToken" ? "USDC" : SWAP_TOKEN_SYMBOL}
            </span>

            <button
              type="button"
              onClick={() =>
                setDirection((d) => (d === "usdcToToken" ? "tokenToUsdc" : "usdcToToken"))
              }
              className="rounded-full border border-slate-200 p-2 hover:bg-slate-50"
            >
              <ArrowDownUp size={16} className="text-slate-500" />
            </button>

            <span className="font-medium text-slate-700">
              {direction === "usdcToToken" ? SWAP_TOKEN_SYMBOL : "USDC"}
            </span>
          </div>

          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Amount in ${direction === "usdcToToken" ? "USDC" : SWAP_TOKEN_SYMBOL}`}
          />

          <Button type="submit" disabled={swapping} className="w-full justify-center">
            {swapping ? "Swapping..." : "Swap"}
          </Button>

          {txHash && (
            <a
              href={explorerTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-blue-600 underline"
            >
              View transaction on ArcScan
            </a>
          )}
        </form>
      )}
    </Card>
  );
}
