const stats = [
  {
    title: "Total Payments",
    value: "1,284",
    change: "+12%",
    color: "text-blue-600",
  },
  {
    title: "Monthly Volume",
    value: "$38,420",
    change: "+8%",
    color: "text-emerald-600",
  },
  {
    title: "Success Rate",
    value: "99.98%",
    change: "+0.2%",
    color: "text-violet-600",
  },
  {
    title: "Pending Invoices",
    value: "18",
    change: "-3",
    color: "text-amber-600",
  },
];

export default function StatsCards() {
  return (
    <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm text-slate-500">
            {stat.title}
          </p>

          <h3 className="mt-3 text-3xl font-bold text-slate-900">
            {stat.value}
          </h3>

          <p className={`mt-2 text-sm font-medium ${stat.color}`}>
            {stat.change} this month
          </p>
        </div>
      ))}
    </section>
  );
}