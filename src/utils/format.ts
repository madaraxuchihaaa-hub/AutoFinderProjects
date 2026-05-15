export function formatByn(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(n)} BYN`;
}

/** @deprecated используйте formatByn */
export function formatRub(value: string | number | null | undefined): string {
  return formatByn(value);
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

export function formatBynWithUsd(
  byn: string | number | null | undefined,
  usdPerByn: number | null | undefined
): { byn: string; usd: string | null } {
  const bynStr = formatByn(byn);
  if (usdPerByn == null || usdPerByn <= 0) return { byn: bynStr, usd: null };
  const n = typeof byn === "string" ? Number(byn) : byn;
  if (n == null || Number.isNaN(n)) return { byn: bynStr, usd: null };
  const usd = Math.round(n * usdPerByn);
  return { byn: bynStr, usd: formatUsd(usd) };
}

export function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(value)} км`;
}
