import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Каталог загрузок: всегда рядом с пакетом `server/`, не зависит от process.cwd(). */
export function getUploadsDir(): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "uploads");
}

export function ensureUploadsDir(): string {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
