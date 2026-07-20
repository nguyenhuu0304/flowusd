import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import WalletCard from "@/components/dashboard/WalletCard";

export default function WalletPage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-3xl font-bold text-slate-900">
              Wallet
            </h1>

            <p className="mt-2 text-slate-500">
              Manage your wallet and stablecoin assets.
            </p>

            <div className="mt-8">
              <WalletCard />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}