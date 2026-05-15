import type { Request } from "express";

export function getPublicOrigin(req?: Pick<Request, "protocol" | "get">): string {
  const fromEnv = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (req) return `${req.protocol}://${req.get("host")}`;
  return "";
}

/** Приводит URL загрузок к текущему хосту (Railway / локальный порт). */
export function normalizeMediaUrl(url: unknown, origin: string): string | null {
  if (url == null || url === "") return null;
  const raw = String(url).trim();
  if (!raw) return null;

  try {
    if (/^https?:\/\//i.test(raw)) {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/uploads/")) {
        return origin ? `${origin}${parsed.pathname}` : parsed.pathname;
      }
      return raw;
    }
    if (raw.startsWith("/uploads/")) {
      return origin ? `${origin}${raw}` : raw;
    }
    if (raw.startsWith("uploads/")) {
      return origin ? `${origin}/${raw}` : `/${raw}`;
    }
    return raw;
  } catch {
    return raw;
  }
}

export function parseImagesField(images: unknown): string[] {
  if (Array.isArray(images)) return images.map((x) => String(x)).filter(Boolean);
  if (typeof images === "string") {
    const s = images.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch {
      return [s];
    }
  }
  return [];
}

export function withNormalizedImages<T extends { images?: unknown }>(
  row: T,
  origin: string
): T {
  const images = parseImagesField(row.images)
    .map((u) => normalizeMediaUrl(u, origin))
    .filter((u): u is string => Boolean(u));
  return { ...row, images };
}

export function withNormalizedImagesList<T extends { images?: unknown }>(
  rows: T[],
  origin: string
): T[] {
  return rows.map((r) => withNormalizedImages(r, origin));
}
