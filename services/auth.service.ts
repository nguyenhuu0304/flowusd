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

const mockUser: User = {
  id: "user-001",
  name: "John Doe",
  email: "john@example.com",
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function login(
  payload: LoginPayload
): Promise<User> {
  await delay(700);

  console.log("Login:", payload);

  return mockUser;
}

export async function register(
  payload: RegisterPayload
): Promise<User> {
  await delay(700);

  console.log("Register:", payload);

  return mockUser;
}

export async function logout() {
  await delay(300);

  return true;
}