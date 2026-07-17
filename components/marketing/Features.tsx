import { CreditCard, ShieldCheck, Zap } from "lucide-react";

const features = [
  {
    icon: CreditCard,
    title: "USDC Native",
    description:
      "Accept and send native USDC on Arc with a simple developer experience.",
  },
  {
    icon: Zap,
    title: "Fast Finality",
    description:
      "Built for predictable confirmations and a smooth payment experience.",
  },
  {
    icon: ShieldCheck,
    title: "Open Source",
    description:
      "Transparent, community-driven, and ready for developers to contribute.",
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="mx-auto max-w-7xl px-6 py-20"
    >
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold text-slate-900">
          Why FlowUSD?
        </h2>

        <p className="mt-3 text-slate-600">
          Everything you need to build stablecoin payments on Arc.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;

          return (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <Icon className="mb-5 h-10 w-10 text-blue-600" />

              <h3 className="text-xl font-semibold text-slate-900">
                {feature.title}
              </h3>

              <p className="mt-3 leading-7 text-slate-600">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}