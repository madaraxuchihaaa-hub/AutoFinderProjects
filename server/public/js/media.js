/** Нормализация URL картинок на клиенте (запасной вариант к серверу). */

export function parseImagesField(images) {
  if (Array.isArray(images)) return images.map(String).filter(Boolean);
  if (typeof images === "string") {
    const s = images.trim();
    if (!s) return [];
    try {
      const p = JSON.parse(s);
      return Array.isArray(p) ? p.map(String).filter(Boolean) : [];
    } catch {
      return [s];
    }
  }
  return [];
}

function pageOrigin() {
  const { protocol, host } = window.location;
  const p = protocol === "http:" && host.includes("railway.app") ? "https:" : protocol;
  return `${p}//${host}`;
}

export function resolveMediaUrl(raw) {
  if (raw == null || raw === "") return null;
  const u = String(raw).trim();
  if (!u) return null;
  const origin = pageOrigin();

  try {
    if (/^https?:\/\//i.test(u)) {
      const parsed = new URL(u);
      if (parsed.pathname.startsWith("/uploads/")) {
        return `${origin}${parsed.pathname}`;
      }
      if (u.startsWith("http://") && window.location.protocol === "https:") {
        return `https://${u.slice(7)}`;
      }
      return u;
    }
    if (u.startsWith("/uploads/")) return `${origin}${u}`;
    if (u.startsWith("uploads/")) return `${origin}/${u}`;
    return u;
  } catch {
    return u.startsWith("/") ? `${origin}${u}` : u;
  }
}

export function firstImageUrl(item) {
  const list = parseImagesField(item?.images);
  if (list[0]) return resolveMediaUrl(list[0]);
  if (Array.isArray(item?.image_urls) && item.image_urls[0]) {
    return resolveMediaUrl(item.image_urls[0]);
  }
  return null;
}

export function attrEsc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

const PLACEHOLDER_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="#121820" width="400" height="300"/><text x="200" y="155" text-anchor="middle" fill="#5c6b82" font-family="system-ui" font-size="16">Нет фото</text></svg>`
  );

export function imgTag(url, alt = "", className = "media-img") {
  const src = resolveMediaUrl(url);
  if (!src) return "";
  return `<img class="${className}" src="${attrEsc(src)}" alt="${attrEsc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PLACEHOLDER_SVG}';this.classList.add('is-broken');" />`;
}
