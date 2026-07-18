const features = [
  {
    title: "Stable Fees",
    icon: "⚡",
    description:
      "Predictable transaction costs for every USDC payment on Arc.",
  },
  {
    title: "Deterministic Finality",
    icon: "🔒",
    description:
      "Payments settle quickly with deterministic confirmation.",
  },
  {
    title: "Native USDC",
    icon: "🌎",
    description:
      "Use native USDC without wrapped assets or unnecessary bridges.",
  },
  {
    title: "Open Source",
    icon: "💙",
    description:
      "MIT licensed and built in public for the Arc community.",
  },
  {
    title: "Developer First",
    icon: "👨‍💻",
    description:
      "Built with Next.js, TypeScript and reusable components.",
  },
  {
    title: "Production Ready",
    icon: "🚀",
    description:
      "Clean architecture designed to scale beyond a simple demo.",
  },
];

export default function Features() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-bold text-slate-900">
          Why FlowUSD?
        </h2>

        <p className="mt-4 text-lg text-slate-600">
          Everything you need to build stablecoin payment
          experiences on Arc.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="text-4xl">{feature.icon}</div>

            <h3 className="mt-6 text-xl font-semibold text-slate-900">
              {feature.title}
            </h3>

            <p className="mt-3 leading-7 text-slate-600">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}