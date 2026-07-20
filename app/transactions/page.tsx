import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import TransactionHistory from "@/components/dashboard/TransactionHistory";

export default function TransactionsPage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">
                Transactions
              </h1>

              <p className="mt-2 text-slate-500">
                View and manage all wallet transactions.
              </p>
            </div>

            <TransactionHistory />
          </div>
        </main>
      </div>
    </div>
  );
}