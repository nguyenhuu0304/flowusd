export default function Sidebar() {
  const menus = [
    {
      title: "Dashboard",
      icon: "🏠",
    },
    {
      title: "Payments",
      icon: "💳",
    },
    {
      title: "Transactions",
      icon: "📄",
    },
    {
      title: "Wallet",
      icon: "👛",
    },
    {
      title: "Settings",
      icon: "⚙️",
    },
  ];

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}

      <div className="border-b border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-blue-600">
          FlowUSD
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Open-source payments on Arc
        </p>
      </div>

      {/* Navigation */}

      <nav className="flex-1 p-6">
        <ul className="space-y-3">
          {menus.map((menu) => (
            <li key={menu.title}>
              <button className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition hover:bg-blue-50 hover:text-blue-600">
                <span className="text-xl">
                  {menu.icon}
                </span>

                <span className="font-medium">
                  {menu.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}

      <div className="border-t border-slate-200 p-6">
        <div className="rounded-2xl bg-slate-100 p-4">
          <p className="text-xs text-slate-500">
            Connected Network
          </p>

          <h3 className="mt-1 font-semibold">
            Arc Mainnet
          </h3>
        </div>
      </div>
    </aside>
  );
}