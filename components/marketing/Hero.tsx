export default function Hero() {
  return (
    <section className="mx-auto flex max-w-7xl flex-col items-center px-6 py-24 text-center">
      <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-sm font-medium text-blue-700">
        Built for Arc
      </span>

      <h1 className="mt-8 max-w-4xl text-5xl font-extrabold tracking-tight text-slate-900 md:text-7xl">
        Stablecoin payments made simple.
      </h1>

      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
        FlowUSD is an open-source payment platform built on Arc, making it easy
        to send, receive, and manage USDC with deterministic finality.
      </p>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
          Launch App
        </button>

        <button className="rounded-xl border border-slate-300 px-6 py-3 font-semibold hover:bg-slate-100">
          View GitHub
        </button>
      </div>
    </section>
  );
}