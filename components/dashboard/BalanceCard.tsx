export default function BalanceCard() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        {/* Left */}
        <div>
          <p className="text-sm font-medium text-slate-500">
            Total Balance
          </p>

          <h2 className="mt-2 text-5xl font-bold tracking-tight text-slate-900">
            12,450.00
            <span className="ml-3 text-2xl font-semibold text-blue-600">
              USDC
            </span>
          </h2>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              +4.82%
            </span>

            <span className="text-sm text-slate-500">
              Compared to last month
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="grid grid-cols-2 gap-4">
          <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
            Send
          </button>

          <button className="rounded-xl border border-slate-300 px-6 py-3 font-semibold transition hover:bg-slate-50">
            Receive
          </button>

          <button className="rounded-xl border border-slate-300 px-6 py-3 font-semibold transition hover:bg-slate-50">
            Deposit
          </button>

          <button className="rounded-xl border border-slate-300 px-6 py-3 font-semibold transition hover:bg-slate-50">
            Withdraw
          </button>
        </div>
      </div>

      <div className="mt-8 border-t pt-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">
              Wallet Address
            </p>

            <p className="mt-2 font-mono text-sm text-slate-900">
              0xA91C...5F12
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Network
            </p>

            <p className="mt-2 font-semibold text-slate-900">
              Arc Mainnet
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Status
            </p>

            <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              Connected
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}