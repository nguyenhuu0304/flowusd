import SwapCard from "@/components/dashboard/SwapCard";
import PageHeader from "@/components/ui/PageHeader";

export default function SwapPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Swap"
          description="Convert between demo stablecoin balances."
        />

        <SwapCard />
      </div>
    </main>
  );
}
