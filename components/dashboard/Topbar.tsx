export default function Topbar() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">
      {/* Left */}

      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Dashboard
        </h2>

        <p className="text-sm text-slate-500">
          Welcome back to FlowUSD
        </p>
      </div>

      {/* Right */}

      <div className="flex items-center gap-6">
        <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium transition hover:bg-slate-100">
          Arc Mainnet
        </button>

        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
          H
        </div>
      </div>
    </header>
  );
}