import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

type Rates = { usdPerByn: number };

let cache: { usdPerByn: number; at: number } | null = null;
const CACHE_MS = 30 * 60 * 1000;

export function useExchangeRate(): number | null {
  const [usdPerByn, setUsdPerByn] = useState<number | null>(
    cache && Date.now() - cache.at < CACHE_MS ? cache.usdPerByn : null
  );

  useEffect(() => {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      setUsdPerByn(cache.usdPerByn);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const data = await apiGet<Rates>("/api/exchange-rates", { auth: false });
        if (alive && data.usdPerByn > 0) {
          cache = { usdPerByn: data.usdPerByn, at: Date.now() };
          setUsdPerByn(data.usdPerByn);
        }
      } catch {
        if (alive) setUsdPerByn(0.31);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return usdPerByn;
}
