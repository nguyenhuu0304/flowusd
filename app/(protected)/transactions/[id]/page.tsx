import TransactionDetail from "@/components/dashboard/TransactionDetail";
import PageHeader from "@/components/ui/PageHeader";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TransactionDetailPage({
  params,
}: Props) {
  const { id } = await params;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Transaction Detail"
          description="View complete transaction information."
        />

        <TransactionDetail id={id} />
      </div>
    </main>
  );
}
