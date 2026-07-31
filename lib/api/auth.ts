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

export async function login(data: {
  email: string;
  password: string;
}) {
  return api<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
}) {
  return api<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function logout() {
  return api<{ success: boolean }>("/auth/logout", {
    method: "POST",
  });
}
