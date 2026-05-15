export function formatEngineMl(ml: number | null | undefined): string {
  if (ml == null || !Number(ml)) return "—";
  return `${(Number(ml) / 1000).toFixed(1).replace(/\.0$/, "")} л`;
}

export function engineVolumeLitersFromMl(ml: number | null | undefined): string {
  if (ml == null || !Number(ml)) return "";
  return String(Number(ml) / 1000).replace(/\.0$/, "");
}

export function parseEngineVolumeLiters(raw: string): number | undefined {
  const s = raw.trim().replace(",", ".");
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n < 20) return Math.round(n * 1000);
  return Math.round(n);
}
