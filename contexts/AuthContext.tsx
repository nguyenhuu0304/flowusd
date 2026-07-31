"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  User,
  login as loginService,
  logout as logoutService,
  register as registerService,
  LoginPayload,
  RegisterPayload,
} from "@/services/auth.service";
import { loadSession } from "@/lib/session";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initializing: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Restore a previously logged-in session (if any) so a page refresh
  // doesn't kick the user back out to /login. This runs in an effect
  // (rather than a lazy useState initializer) on purpose: localStorage
  // isn't available during server rendering, so reading it eagerly
  // would make the client's first render diverge from the server's
  // and trigger a hydration mismatch.
  useEffect(() => {
    const session = loadSession();

    if (session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setUser(session.user);
    }

    setInitializing(false);
  }, []);

  async function login(payload: LoginPayload) {
    setLoading(true);

    try {
      const user = await loginService(payload);
      setUser(user);
    } finally {
      setLoading(false);
    }
  }

  async function register(payload: RegisterPayload) {
    setLoading(true);

    try {
      const user = await registerService(payload);
      setUser(user);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);

    try {
      await logoutService();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      initializing,
      login,
      register,
      logout,
    }),
    [user, loading, initializing]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuthContext must be used inside AuthProvider"
    );
  }

  return context;
}
