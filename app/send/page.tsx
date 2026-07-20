import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import SendCard from "@/components/dashboard/SendCard";

export default function SendPage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">
                Send USDC
              </h1>

              <p className="mt-2 text-slate-500">
                Transfer USDC securely to another wallet.
              </p>
            </div>

            <SendCard />
          </div>
        </main>
      </div>
    </div>
  );
}