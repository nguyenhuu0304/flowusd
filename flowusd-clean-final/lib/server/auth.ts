import type { StoredUser } from "./db";

export function publicUser(user: StoredUser) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, ...rest } = user;
  return rest;
}

export function fakeToken(userId: string) {
  return Buffer.from(`${userId}:${Date.now()}`).toString("base64");
}
