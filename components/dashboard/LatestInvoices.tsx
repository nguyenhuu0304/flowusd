const invoices = [
  {
    id: "INV-1001",
    client: "Acme Inc.",
    amount: "250.00 USDC",
    status: "Paid",
  },
  {
    id: "INV-1002",
    client: "Nova Labs",
    amount: "1,200.00 USDC",
    status: "Pending",
  },
  {
    id: "INV-1003",
    client: "Flow Studio",
    amount: "480.00 USDC",
    status: "Paid",
  },
];

export default function LatestInvoices() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">
          Latest Invoices
        </h2>

        <button className="text-sm font-medium text-blue-600 hover:underline">
          View All
        </button>
      </div>

      <div className="space-y-4">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="flex items-center justify-between rounded-2xl border border-slate-100 p-4 transition hover:bg-slate-50"
          >
            <div>
              <p className="font-semibold text-slate-900">
                {invoice.client}
              </p>

              <p className="text-sm text-slate-500">
                {invoice.id}
              </p>
            </div>

            <div className="text-right">
              <p className="font-semibold text-slate-900">
                {invoice.amount}
              </p>

              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                  invoice.status === "Paid"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {invoice.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}