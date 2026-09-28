import LendingCard from "@/components/dashboard/LendingCard";
import PageHeader from "@/components/ui/PageHeader";

export default function EarnPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Earn"
          description="Deposit USDC to earn a simulated fixed APY."
        />

        <LendingCard />
      </div>
    </main>
  );
}
