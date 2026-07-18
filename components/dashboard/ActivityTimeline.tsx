import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";

const activities = [
  {
    id: 1,
    title: "Received payment",
    description: "Salary from Acme Inc.",
    time: "10 min ago",
    icon: ArrowDownLeft,
    color: "bg-green-100 text-green-600",
  },
  {
    id: 2,
    title: "Sent payment",
    description: "Coffee Shop",
    time: "45 min ago",
    icon: ArrowUpRight,
    color: "bg-red-100 text-red-600",
  },
  {
    id: 3,
    title: "Invoice paid",
    description: "Invoice #2048",
    time: "Yesterday",
    icon: CheckCircle2,
    color: "bg-blue-100 text-blue-600",
  },
];

export default function ActivityTimeline() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-slate-900">
        Recent Activity
      </h2>

      <div className="space-y-6">
        {activities.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.id} className="flex gap-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${item.color}`}
              >
                <Icon size={18} />
              </div>

              <div className="flex-1">
                <p className="font-semibold text-slate-900">
                  {item.title}
                </p>

                <p className="text-sm text-slate-500">
                  {item.description}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {item.time}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}