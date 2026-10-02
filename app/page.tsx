import Link from "next/link";

function CheckItem({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
        ✓
      </span>

      <span>{children}</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      {/* Header */}
      <header className="border-b border-slate-100">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-sm">
              F
            </div>

            <div>
              <div className="text-lg font-bold tracking-tight">
                FlowUSD
              </div>

              <div className="text-xs text-slate-500">
                USDC Payments on Arc
              </div>
            </div>
          </Link>

          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
          >
            Get Test USDC
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center px-6 py-16">
        <div className="max-w-4xl">
          <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
            Built for Arc
          </div>

          <h1 className="mt-8 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Modern USDC
            <br />
            Payments
            <br />
            <span className="text-blue-600">
              Built for Arc.
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-600">
            FlowUSD makes USDC payments on Arc simple.
            Send and receive USDC, create payment links,
            split bills, track payments, and verify activity
            directly on-chain.
          </p>

          <div className="mt-10">
            <Link
              href="/dashboard"
              className="inline-flex min-w-36 items-center justify-center rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Open FlowUSD
            </Link>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Need test funds? Use Circle Faucet and select the
            supported test network before requesting USDC.
          </p>

          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4">
            <CheckItem>
              Native USDC
            </CheckItem>

            <CheckItem>
              Payment Links
            </CheckItem>

            <CheckItem>
              Split Bills
            </CheckItem>

            <CheckItem>
              On-chain Verification
            </CheckItem>
          </div>

          <div className="mt-14 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">
              Arc Testnet
            </p>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              FlowUSD is currently running on Arc Testnet.
              Test USDC has no monetary value.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}