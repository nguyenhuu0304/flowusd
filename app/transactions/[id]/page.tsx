import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import TransactionDetail from "@/components/dashboard/TransactionDetail";

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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">
                Transaction Detail
              </h1>

              <p className="mt-2 text-slate-500">
                View complete transaction information.
              </p>
            </div>

            <TransactionDetail id={id} />
          </div>
        </main>
      </div>
    </div>
  );
}