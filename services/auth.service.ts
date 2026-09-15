import {
  login as loginApi,
  register as registerApi,
  verifyRegistration as verifyRegistrationApi,
  resendVerificationCode as resendVerificationCodeApi,
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
  confirmPassword: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export async function login(payload: LoginPayload): Promise<User> {
  const { user, token } = await loginApi(payload);

  saveSession({ user, token });

  return user;
}

// Step 1: sends a verification code to the given email. Returns the email
// and an opaque pendingToken to pass to verifyRegistration()/
// resendVerificationCode() — the account doesn't exist yet.
export async function register(
  payload: RegisterPayload
): Promise<{ pendingEmail: string; pendingToken: string }> {
  const { pendingEmail, pendingToken } = await registerApi(payload);
  return { pendingEmail, pendingToken };
}

// Step 2: confirms the code and actually creates + logs in the account.
export async function verifyRegistration(
  email: string,
  code: string,
  pendingToken: string
): Promise<User> {
  const { user, token } = await verifyRegistrationApi({
    email,
    code,
    pendingToken,
  });

  saveSession({ user, token });

  return user;
}

// Returns the refreshed pendingToken — callers must hold onto this and
// use it for the next verifyRegistration() call instead of the old one.
export async function resendVerificationCode(
  email: string,
  pendingToken: string
): Promise<string> {
  const result = await resendVerificationCodeApi({ email, pendingToken });
  return result.pendingToken;
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
