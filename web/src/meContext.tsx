import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MeResponse, MeUser } from "./api";
import { apiGet } from "./api";

type Ctx = {
  me: MeResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AppMeContext = createContext<Ctx | null>(null);

export function AppMeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await apiGet<MeResponse>("/api/me");
    setMe(data);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch {
        if (alive) setMe(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ me, loading, refresh }),
    [me, loading, refresh]
  );

  return <AppMeContext.Provider value={value}>{children}</AppMeContext.Provider>;
}

export function useAppMe(): Ctx {
  const v = useContext(AppMeContext);
  if (!v) throw new Error("useAppMe");
  return v;
}

export function displayName(u: MeUser | null): string {
  if (!u) return "";
  return u.fullName?.trim() || u.email;
}
