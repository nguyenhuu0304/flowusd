import DashboardPreview from "./DashboardPreview";

export default function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        {/* Left */}
        <div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-sm font-medium text-blue-700">
            Built for Arc
          </span>

          <h1 className="mt-8 text-5xl font-extrabold tracking-tight text-slate-900 md:text-7xl">
            Modern USDC Payments
            <span className="block text-blue-600">Built for Arc.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            FlowUSD is an open-source payment platform that helps developers,
            creators, and businesses accept native USDC payments with stable
            fees and deterministic finality.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
              Get Started
            </button>

            <button className="rounded-xl border border-slate-300 px-6 py-3 font-semibold transition hover:bg-slate-100">
              View on GitHub
            </button>
          </div>

          <div className="mt-12 flex flex-wrap gap-6 text-sm text-slate-600">
            <div>✓ Native USDC</div>
            <div>✓ Stable Fees</div>
            <div>✓ Deterministic Finality</div>
          </div>
        </div>

        {/* Right */}
        <div className="flex justify-center">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}