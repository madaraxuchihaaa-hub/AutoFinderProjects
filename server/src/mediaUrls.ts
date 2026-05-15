import type { Request } from "express";

function preferHttps(origin: string): string {
  if (!origin) return origin;
  if (process.env.FORCE_HTTPS === "0") return origin;
  return origin.replace(/^http:\/\//i, "https://");
}

/** Базовый URL сайта (PUBLIC_BASE_URL или прокси Railway). */
export function getPublicOrigin(req?: Pick<Request, "protocol" | "get">): string {
  const fromEnv = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) return preferHttps(fromEnv);
  if (req) {
    const proto =
      (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0]?.trim() ||
      "http";
    const host = req.get("x-forwarded-host") || req.get("host") || "";
    if (!host) return "";
    return preferHttps(`${proto}://${host}`);
  }
  return "";
}

/** Путь вида /uploads/… из любого сохранённого URL. */
export function uploadPathFromUrl(url: unknown): string | null {
  if (url == null || url === "") return null;
  const raw = String(url).trim();
  if (!raw) return null;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/uploads/")) return parsed.pathname;
      return null;
    }
    if (raw.startsWith("/uploads/")) return raw;
    if (raw.startsWith("uploads/")) return `/${raw}`;
  } catch {
    /* ignore */
  }
  return null;
}

/** Абсолютный HTTPS-URL для API и мобильного клиента. */
export function normalizeMediaUrl(url: unknown, origin: string): string | null {
  if (url == null || url === "") return null;
  const raw = String(url).trim();
  if (!raw) return null;

  const uploadPath = uploadPathFromUrl(raw);
  if (uploadPath) {
    const base = preferHttps(origin);
    return base ? `${base}${uploadPath}` : uploadPath;
  }

  if (/^https?:\/\//i.test(raw)) return preferHttps(raw);
  return raw;
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
