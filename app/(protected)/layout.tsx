
"use client";

import { AppearanceProvider } from "@/contexts/AppearanceContext";
import Topbar from "@/components/dashboard/Topbar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppearanceProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
        <Topbar />

        <div className="flex min-w-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </AppearanceProvider>
  );
}
