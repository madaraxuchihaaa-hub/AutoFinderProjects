import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiGet, apiPost } from "../api/client";
import { registerAccessTokenGetter } from "./tokenBridge";
import type { AuthUser, LoginResponse } from "../types/api";

const TOKEN_KEY = "autofinder_access_token";

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (params: {
    email: string;
    password: string;
    full_name?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setProfileLocal: (u: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    registerAccessTokenGetter(async () => token);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!cancelled) setToken(t);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }
    const me = await apiGet<AuthUser & { created_at?: string }>("/api/auth/me");
    setUser({
      id: me.id,
      email: me.email,
      full_name: me.full_name,
      phone: me.phone,
      role: me.role,
    });
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setUser(null);
      return;
    }
    refreshUser().catch(() => {
      void logout();
    });
  }, [ready, token, refreshUser, logout]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost<LoginResponse>(
      "/api/auth/login",
      { email: email.trim(), password },
      { auth: false }
    );
    await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (params: {
      email: string;
      password: string;
      full_name?: string;
      phone?: string;
    }) => {
      const data = await apiPost<LoginResponse>(
        "/api/auth/register",
        {
          email: params.email.trim(),
          password: params.password,
          full_name: params.full_name?.trim() || undefined,
          phone: params.phone?.trim() || undefined,
        },
        { auth: false }
      );
      await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
      setToken(data.accessToken);
      setUser(data.user);
    },
    []
  );

  const setProfileLocal = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({
      ready,
      token,
      user,
      login,
      register,
      logout,
      refreshUser,
      setProfileLocal,
    }),
    [ready, token, user, login, register, logout, refreshUser, setProfileLocal]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
