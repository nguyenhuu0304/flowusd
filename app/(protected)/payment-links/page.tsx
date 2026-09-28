import OnChainPaymentLinkCard from "@/components/dashboard/OnChainPaymentLinkCard";
import PaymentLinksCard from "@/components/dashboard/PaymentLinksCard";
import PageHeader from "@/components/ui/PageHeader";

export default function PaymentLinksPage() {
  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          title="Payment Links"
          description="Create shareable links and QR codes to request payments."
        />

        <PaymentLinksCard />
        <OnChainPaymentLinkCard />
      </div>
    </main>
  );
}
