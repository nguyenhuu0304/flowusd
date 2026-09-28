import PageHeader from "@/components/ui/PageHeader";

import BalanceCard from "./BalanceCard";
import QuickActions from "./QuickActions";
import StatsCards from "./StatsCards";
import RecentTransactions from "./RecentTransactions";
import SpendingChart from "./SpendingChart";
import ActivityTimeline from "./ActivityTimeline";
import TopCounterparties from "./TopCounterparties";

export default function DashboardContent() {
  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <PageHeader
          title="Dashboard"
          description="Welcome back to FlowUSD."
        />

        <BalanceCard />

        <QuickActions />

        <StatsCards />

        <div className="grid gap-8 xl:grid-cols-3">
          <div className="space-y-8 xl:col-span-2">
            <RecentTransactions />

            <SpendingChart />
          </div>

          <div className="space-y-8">
            <ActivityTimeline />

            <TopCounterparties />
          </div>
        </div>
      </div>
    </main>
  );
}