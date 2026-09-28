import OnChainSwapCard from "@/components/dashboard/OnChainSwapCard";
import SwapCard from "@/components/dashboard/SwapCard";
import PageHeader from "@/components/ui/PageHeader";

export default function SwapPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          title="Swap"
          description="Convert between demo stablecoin balances."
        />

        <SwapCard />
        <OnChainSwapCard />
      </div>
    </main>
  );
}
