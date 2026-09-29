
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const disabledApiPrefixes = [
  "/api/wallet",
  "/api/lending",
  "/api/payment-links",
  "/api/transactions",
];

const disabledDemoPages = new Set([
  "/swap",
  "/earn",
  "/send",
  "/receive",
  "/analytics",
  "/login",
  "/register",
]);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isDemoApi = disabledApiPrefixes.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix + "/")
  );

  if (isDemoApi) {
    return NextResponse.json(
      {
        error: "This legacy demo API has been disabled.",
        code: "DEMO_API_DISABLED",
      },
      {
        status: 410,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  if (disabledDemoPages.has(pathname)) {
    return NextResponse.redirect(
      new URL("/dashboard", request.url)
    );
  }

  // Disable the legacy payment page while preserving
  // the real /pay/onchain/[id] payment flow.
  if (
    pathname.startsWith("/pay/") &&
    !pathname.startsWith("/pay/onchain/")
  ) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/wallet/:path*",
    "/api/lending/:path*",
    "/api/payment-links/:path*",
    "/api/transactions/:path*",

    "/swap",
    "/earn",
    "/send",
    "/receive",
    "/analytics",
    "/login",
    "/register",

    "/pay/:path*",
  ],
};
