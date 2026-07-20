import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import ReceiveCard from "@/components/dashboard/ReceiveCard";

export default function ReceivePage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">
                Receive USDC
              </h1>

              <p className="mt-2 text-slate-500">
                Share your wallet address to receive payments.
              </p>
            </div>

            <ReceiveCard />
          </div>
        </main>
      </div>
    </div>
  );
}