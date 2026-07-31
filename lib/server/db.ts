import seed from "@/mock/db.json";

// A tiny in-memory "database" for the demo API routes.
//
// This is intentionally NOT a real database: it exists so the app has
// something that behaves like a backend without requiring the person
// deploying it to provision one just to see a working demo. It's good
// enough to showcase the full login → wallet → send → history flow on a
// single running instance (e.g. right after a Vercel deploy).
//
// Real limitations to know about:
// - State lives in server memory, so it resets on a cold start / new
//   deployment, and isn't shared across multiple serverless instances.
// - For a production app with real users, swap this for an actual
//   database (Postgres, Vercel KV, etc.) behind the same functions below
//   — nothing above this layer (routes, services, hooks) would need to
//   change, since they only depend on the shapes exported here.

export type StoredWallet = {
  id: number;
  address: string;
  balance: number;
  currency: string;
  balances: Record<string, number>;
  lending: {
    deposited: number;
    apy: number;
    since: string | null;
  };
};

export type StoredTransaction = {
  id: string;
  name: string;
  address: string;
  amount: number;
  type: "income" | "expense";
  status: "completed" | "pending";
  createdAt: string;
  memo?: string;
};

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  password: string;
};

export type PendingRegistration = {
  name: string;
  email: string;
  password: string;
  code: string;
  expiresAt: number;
  attempts: number;
};

type Db = {
  wallet: StoredWallet;
  transactions: StoredTransaction[];
  users: StoredUser[];
  pendingRegistrations: Map<string, PendingRegistration>;
};

declare global {
  var __flowusdDb: Db | undefined;
}

function seedDb(): Db {
  // Deep-clone the bundled seed data so repeated resets (e.g. in dev,
  // where this module can be re-evaluated) never mutate the imported JSON.
  const cloned = JSON.parse(JSON.stringify(seed)) as Omit<
    Db,
    "pendingRegistrations"
  >;

  return {
    ...cloned,
    pendingRegistrations: new Map(),
  };
}

export function getDb(): Db {
  if (!global.__flowusdDb) {
    global.__flowusdDb = seedDb();
  }

  return global.__flowusdDb;
}
