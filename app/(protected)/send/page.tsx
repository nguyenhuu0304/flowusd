import SendCard from "@/components/dashboard/SendCard";
import PageHeader from "@/components/ui/PageHeader";

export default function SendPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Send USDC"
          description="Transfer USDC securely to another wallet."
        />

        <SendCard />
      </div>
    </main>
  );
}
