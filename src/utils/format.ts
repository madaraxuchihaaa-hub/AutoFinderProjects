export function formatRub(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(n)} ₽`;
}

export function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(value)} км`;
}
