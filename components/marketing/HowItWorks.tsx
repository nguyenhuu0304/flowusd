const steps = [
  {
    number: "01",
    title: "Connect Wallet",
    description:
      "Securely connect your Arc-compatible wallet in just a few clicks.",
    icon: "🔗",
  },
  {
    number: "02",
    title: "Create Payment",
    description:
      "Generate invoices or payment requests with native USDC.",
    icon: "💳",
  },
  {
    number: "03",
    title: "Receive Funds",
    description:
      "Payments settle quickly with deterministic finality on Arc.",
    icon: "✅",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-700">
            How It Works
          </span>

          <h2 className="mt-5 text-4xl font-bold text-slate-900">
            Accept payments in three simple steps
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            FlowUSD simplifies stablecoin payments so developers and businesses
            can start accepting USDC in minutes.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl">
                {step.icon}
              </div>

              <span className="text-sm font-semibold text-blue-600">
                STEP {step.number}
              </span>

              <h3 className="mt-3 text-2xl font-bold text-slate-900">
                {step.title}
              </h3>

              <p className="mt-4 leading-7 text-slate-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}