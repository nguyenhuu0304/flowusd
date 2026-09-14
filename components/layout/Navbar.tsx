import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
            F
          </div>

          <div>
            <p className="text-lg font-bold text-slate-900">
              FlowUSD
            </p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="#features"
            className="text-sm text-slate-600 transition hover:text-blue-600"
          >
            Features
          </Link>

          <Link
            href="#roadmap"
            className="text-sm text-slate-600 transition hover:text-blue-600"
          >
            Roadmap
          </Link>

          <Link
            href="#opensource"
            className="text-sm text-slate-600 transition hover:text-blue-600"
          >
            Open Source
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="https://docs.arc.io"
            target="_blank"
            className="hidden rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-100 md:inline-flex"
          >
            Docs
          </Link>

          <Link
            href="https://github.com"
            target="_blank"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}