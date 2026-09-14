import ReceiveCard from "@/components/dashboard/ReceiveCard";
import PageHeader from "@/components/ui/PageHeader";

export default function ReceivePage() {
  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Receive USDC"
          description="Share your wallet address to receive payments."
        />

        <ReceiveCard />
      </div>
    </main>
  );
}
