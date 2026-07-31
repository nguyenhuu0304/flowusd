"use client";

import Link from "next/link";
import { toast } from "sonner";

const actions = [
  {
    title: "Send Payment",
    description: "Transfer USDC instantly",
    icon: "💸",
    href: "/send",
  },
  {
    title: "Receive Funds",
    description: "Share your wallet address",
    icon: "📥",
    href: "/receive",
  },
  {
    title: "Create Invoice",
    description: "Generate payment requests",
    icon: "🧾",
  },
  {
    title: "View Analytics",
    description: "Track payment activity",
    icon: "📊",
  },
];

export default function QuickActions() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">
          Quick Actions
        </h2>

        <p className="mt-2 text-slate-500">
          Frequently used tools for managing your payments.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const content = (
            <>
              <div className="mb-4 text-3xl">
                {action.icon}
              </div>

              <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">
                {action.title}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {action.description}
              </p>
            </>
          );

          if (action.href) {
            return (
              <Link
                key={action.title}
                href={action.href}
                className="group rounded-2xl border border-slate-200 p-6 text-left transition-all hover:border-blue-500 hover:shadow-lg"
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={action.title}
              onClick={() =>
                toast.info("Coming soon", {
                  description: `${action.title} isn't available yet.`,
                })
              }
              className="group rounded-2xl border border-slate-200 p-6 text-left transition-all hover:border-blue-500 hover:shadow-lg"
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}
