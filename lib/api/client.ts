// Defaults to a relative "/api" path, which resolves against whatever
// domain the app is served from — this means the exact same code works
// unchanged in local dev (Next's own dev server) and once deployed (e.g.
// to Vercel), with no separate API process or CORS setup needed.
//
// NEXT_PUBLIC_API_URL can still be set to point at a different backend
// entirely (e.g. a real API you deploy separately) if you outgrow the
// bundled demo routes under app/api/.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return (await res.json()) as T;
}
