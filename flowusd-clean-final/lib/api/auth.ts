import { api } from "./client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
};

export type RegisterResponse = {
  pendingEmail: string;
};

export async function login(data: { email: string; password: string }) {
  return api<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Step 1 of registration: validates the details and emails a 6-digit
// verification code. The account isn't created yet — call
// verifyRegistration() with that code to finish.
export async function register(data: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  return api<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Step 2 of registration: confirms the emailed code and actually creates
// the account, returning a session just like login().
export async function verifyRegistration(data: {
  email: string;
  code: string;
}) {
  return api<AuthResponse>("/auth/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function resendVerificationCode(data: { email: string }) {
  return api<{ success: boolean }>("/auth/resend-code", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function logout() {
  return api<{ success: boolean }>("/auth/logout", {
    method: "POST",
  });
}
