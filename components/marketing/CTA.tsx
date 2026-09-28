import Link from "next/link";

export default function CTA() {
  return (
    <section id="cta" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 px-10 py-20 text-center text-white shadow-2xl">
          <h2 className="text-4xl font-bold md:text-5xl">
            Ready to build on Arc?
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-blue-100">
            Join the open-source movement and start building modern USDC payment
            experiences with FlowUSD.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="rounded-xl bg-white px-8 py-4 text-center font-semibold text-blue-600 transition hover:scale-105"
            >
              Get Started
            </Link>

            <Link
              href="https://github.com/nguyenhuu0304/flowusd"
              target="_blank"
              className="rounded-xl border border-white px-8 py-4 text-center font-semibold text-white transition hover:bg-white hover:text-blue-600"
            >
              View GitHub
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}