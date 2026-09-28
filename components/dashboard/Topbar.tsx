"use client";

import { useAuth } from "@/hooks/useAuth";
import { NETWORK_NAME } from "@/lib/constants";

export default function Topbar() {
  const { user } = useAuth();

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">
      {/* Left */}

      <div>
        <p className="text-sm text-slate-500">
          Welcome back{user ? `, ${user.name}` : ""}
        </p>
      </div>

      {/* Right */}

      <div className="flex items-center gap-6">
        <span className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
          {NETWORK_NAME}
        </span>

        <div
          title={user?.email}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white"
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
