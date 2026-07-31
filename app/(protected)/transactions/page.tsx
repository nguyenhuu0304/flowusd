import TransactionHistory from "@/components/dashboard/TransactionHistory";
import PageHeader from "@/components/ui/PageHeader";

export default function TransactionsPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Transactions"
          description="View and manage all wallet transactions."
        />

        <TransactionHistory />
      </div>
    </main>
  );
}
