export default function Footer() {
  return (
    <footer className="border-t border-slate-200 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 md:flex-row">
        <p>© 2026 FlowUSD. Open Source.</p>

        <div className="flex gap-6">
          <a
            href="https://docs.arc.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600"
          >
            Arc Docs
          </a>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}