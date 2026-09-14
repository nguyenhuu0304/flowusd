export default function DashboardPreview() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 text-center">
          <span className="rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-700">
            Dashboard Preview
          </span>

          <h2 className="mt-5 text-4xl font-bold text-slate-900">
            Everything in one place
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Manage balances, monitor transactions, and receive payments through
            a clean and modern dashboard.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">

          {/* Header */}

          <div className="flex items-center justify-between border-b border-slate-200 px-8 py-5">
            <div>
              <p className="text-sm text-slate-500">
                Wallet Balance
              </p>

              <h3 className="mt-1 text-3xl font-bold text-slate-900">
                12,450.00 USDC
              </h3>
            </div>

            <button className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">
              Send Payment
            </button>
          </div>

          {/* Body */}

          <div className="grid gap-8 p-8 lg:grid-cols-3">

            {/* Recent Payments */}

            <div className="lg:col-span-2 rounded-2xl border border-slate-200 p-6">

              <h4 className="mb-6 text-xl font-semibold">
                Recent Payments
              </h4>

              <div className="space-y-5">

                <Payment
                  name="Coffee Shop"
                  amount="-5.20 USDC"
                  status="Completed"
                />

                <Payment
                  name="Salary"
                  amount="+2,500.00 USDC"
                  status="Received"
                />

                <Payment
                  name="Hosting"
                  amount="-18.99 USDC"
                  status="Completed"
                />

                <Payment
                  name="Freelance Client"
                  amount="+820.00 USDC"
                  status="Received"
                />

              </div>
            </div>

            {/* Stats */}

            <div className="space-y-5">

              <StatCard
                title="Transactions"
                value="245"
              />

              <StatCard
                title="Monthly Volume"
                value="$38,420"
              />

              <StatCard
                title="Network"
                value="Arc"
              />

            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

function Payment({
  name,
  amount,
  status,
}: {
  name: string;
  amount: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
      <div>
        <h5 className="font-semibold text-slate-900">
          {name}
        </h5>

        <p className="text-sm text-slate-500">
          {status}
        </p>
      </div>

      <span className="font-semibold text-slate-900">
        {amount}
      </span>
    </div>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <h4 className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </h4>
    </div>
  );
}