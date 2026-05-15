const FALLBACK_USD_PER_BYN = Number(process.env.BYN_USD_RATE ?? "0.31");
const CACHE_MS = 60 * 60 * 1000;

let cached: { usdPerByn: number; at: number } | null = null;

/** Сколько USD за 1 BYN */
export async function getUsdPerByn(): Promise<number> {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.usdPerByn;
  }
  try {
    const res = await fetch(
      "https://api.nbrb.by/exrates/rates/USD?parammode=2",
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = (await res.json()) as { Cur_OfficialRate: number; Cur_Scale: number };
      const rate = data.Cur_OfficialRate / (data.Cur_Scale || 1);
      if (rate > 0) {
        const usdPerByn = 1 / rate;
        cached = { usdPerByn, at: Date.now() };
        return usdPerByn;
      }
    }
  } catch {
    /* NBRB недоступен — fallback */
  }
  cached = { usdPerByn: FALLBACK_USD_PER_BYN, at: Date.now() };
  return FALLBACK_USD_PER_BYN;
}

export function bynToUsd(byn: number, usdPerByn: number): number {
  return byn * usdPerByn;
}
