
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * FlowUSD - Disable legacy/demo API endpoints.
 *
 * Real Arc API remains available:
 *   /api/arc/transactions
 *
 * Real on-chain payment page remains available:
 *   /pay/onchain/[id]
 */
export function proxy(_request: NextRequest) {
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

export const config = {
  matcher: [
    "/api/wallet/:path*",
    "/api/lending/:path*",
    "/api/payment-links/:path*",
    "/api/transactions/:path*",
  ],
};
