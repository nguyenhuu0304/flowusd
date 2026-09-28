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
  verifyRegistration as verifyRegistrationService,
  resendVerificationCode as resendVerificationCodeService,
  LoginPayload,
  RegisterPayload,
} from "@/services/auth.service";
import { loadSession } from "@/lib/session";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initializing: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  // Step 1: sends a verification code, returns the email it was sent to.
  register: (payload: RegisterPayload) => Promise<string>;
  // Step 2: confirms the code and logs the new account in. Uses the
  // pendingToken tracked internally since register()/resendVerificationCode().
  verifyRegistration: (email: string, code: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
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

  // Holds the current opaque registration token between the "sent a
  // code" and "confirm the code" steps (and gets refreshed on resend).
  // See lib/server/pendingToken.ts for why this replaced a server-side
  // in-memory store: server memory isn't reliably shared across
  // serverless invocations, but this token round-trips through the
  // browser instead, so any instance can validate it.
  const [pendingToken, setPendingToken] = useState<string | null>(null);

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
      const { pendingEmail, pendingToken } = await registerService(payload);
      setPendingToken(pendingToken);
      return pendingEmail;
    } finally {
      setLoading(false);
    }
  }

  async function verifyRegistration(email: string, code: string) {
    if (!pendingToken) {
      throw new Error(
        "This verification link is invalid. Please register again."
      );
    }

    setLoading(true);

    try {
      const user = await verifyRegistrationService(email, code, pendingToken);
      setUser(user);
      setPendingToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function resendVerificationCode(email: string) {
    if (!pendingToken) {
      throw new Error(
        "This verification link is invalid. Please register again."
      );
    }

    const newPendingToken = await resendVerificationCodeService(
      email,
      pendingToken
    );
    setPendingToken(newPendingToken);
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
      verifyRegistration,
      resendVerificationCode,
      logout,
    }),
    [user, loading, initializing, pendingToken]
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
