export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 text-sm text-slate-500 md:flex-row">
        <div>
          <h3 className="text-lg font-bold text-slate-900">FlowUSD</h3>

          <p className="mt-2 max-w-sm">
            Open-source payment infrastructure built for Arc.
          </p>
        </div>

        <div className="flex gap-8">
          <a
            href="#features"
            className="transition hover:text-blue-600"
          >
            Features
          </a>

          <a
            href="#dashboard"
            className="transition hover:text-blue-600"
          >
            Dashboard
          </a>

          <a
            href="#cta"
            className="transition hover:text-blue-600"
          >
            Get Started
          </a>

          <a
            href="https://github.com/nguyenhuu0304/flowusd"
            target="_blank"
            className="transition hover:text-blue-600"
          >
            GitHub
          </a>
        </div>
      </div>

      <div className="border-t border-slate-100 py-5 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} FlowUSD. MIT Licensed.
      </div>
    </footer>
  );
}