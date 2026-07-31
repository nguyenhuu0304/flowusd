import {
  login as loginApi,
  register as registerApi,
  logout as logoutApi,
} from "@/lib/api/auth";

import { saveSession, clearSession } from "@/lib/session";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export async function login(
  payload: LoginPayload
): Promise<User> {
  const { user, token } = await loginApi(payload);

  saveSession({ user, token });

  return user;
}

export async function register(
  payload: RegisterPayload
): Promise<User> {
  const { user, token } = await registerApi(payload);

  saveSession({ user, token });

  return user;
}

export async function logout(): Promise<void> {
  try {
    await logoutApi();
  } catch (error) {
    // Best-effort: even if the mock API call fails, still clear the
    // local session so the user isn't stuck "logged in".
    console.error("Logout request failed:", error);
  } finally {
    clearSession();
  }
}
