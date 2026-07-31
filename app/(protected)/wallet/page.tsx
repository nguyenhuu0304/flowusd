import WalletCard from "@/components/dashboard/WalletCard";
import Web3WalletCard from "@/components/dashboard/Web3WalletCard";
import PageHeader from "@/components/ui/PageHeader";

export default function WalletPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <PageHeader
          title="Wallet"
          description="Manage your wallet and stablecoin assets."
        />

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            App Wallet (Demo)
          </h2>

          <WalletCard />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Real Wallet Connection
          </h2>

          <Web3WalletCard />
        </div>
      </div>
    </main>
  );
}
