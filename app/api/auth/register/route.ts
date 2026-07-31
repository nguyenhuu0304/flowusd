import { NextRequest, NextResponse } from "next/server";
import { getDb, type StoredUser } from "@/lib/server/db";
import { publicUser, fakeToken } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { name, email, password } = body ?? {};

  if (!name || !email || !password) {
    return NextResponse.json(
      { message: "Name, email and password are required." },
      { status: 400 }
    );
  }

  const db = getDb();

  const exists = db.users.some(
    (u) => u.email.toLowerCase() === String(email).toLowerCase()
  );

  if (exists) {
    return NextResponse.json(
      { message: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const user: StoredUser = {
    id: `user_${Date.now()}`,
    name,
    email,
    password, // demo-only in-memory store: never do this in a real backend
  };

  db.users.push(user);

  return NextResponse.json(
    { user: publicUser(user), token: fakeToken(user.id) },
    { status: 201 }
  );
}
