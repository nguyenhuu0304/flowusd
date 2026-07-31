"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { NETWORK_NAME } from "@/lib/constants";

const menus = [
  { title: "Dashboard", href: "/dashboard", icon: "🏠" },
  { title: "Wallet", href: "/wallet", icon: "👛" },
  { title: "Send", href: "/send", icon: "💸" },
  { title: "Receive", href: "/receive", icon: "📥" },
  { title: "Swap", href: "/swap", icon: "🔄" },
  { title: "Earn", href: "/earn", icon: "📈" },
  { title: "Transactions", href: "/transactions", icon: "📄" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}

      <Link href="/dashboard" className="border-b border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-blue-600">
          FlowUSD
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Open-source payments on Arc
        </p>
      </Link>

      {/* Navigation */}

      <nav className="flex-1 p-6">
        <ul className="space-y-3">
          {menus.map((menu) => {
            const active =
              pathname === menu.href ||
              pathname.startsWith(`${menu.href}/`);

            return (
              <li key={menu.title}>
                <Link
                  href={menu.href}
                  className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition ${
                    active
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  <span className="text-xl">
                    {menu.icon}
                  </span>

                  <span className="font-medium">
                    {menu.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}

      <div className="space-y-4 border-t border-slate-200 p-6">
        <div className="rounded-2xl bg-slate-100 p-4">
          <p className="text-xs text-slate-500">
            Connected Network
          </p>

          <h3 className="mt-1 font-semibold">
            {NETWORK_NAME}
          </h3>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
