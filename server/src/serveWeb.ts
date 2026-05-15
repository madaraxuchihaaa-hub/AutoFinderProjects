import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";

/** Всегда `server/public`, даже если `process.cwd()` — корень монорепо (иначе отдаётся старый/пустой веб). */
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

export function getPublicDir(): string {
  return PUBLIC_DIR;
}

export function hasWebBuild(): boolean {
  return fs.existsSync(path.join(PUBLIC_DIR, "index.html"));
}

/** В продакшене (Railway) не кэшируем HTML/JS/CSS — иначе после деплоя виден старый фронт. */
function noStoreHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

/** Статика и SPA fallback (после всех /api маршрутов). */
export function registerWeb(app: Express): void {
  if (!hasWebBuild()) {
    console.warn("[web] public/index.html не найден — веб-интерфейс отключён");
    console.warn(`[web] ожидалась папка: ${PUBLIC_DIR}`);
    return;
  }

  console.info(`[web] статика: ${PUBLIC_DIR}`);

  const longCache =
    process.env.NODE_ENV === "production" &&
    process.env.WEB_STATIC_LONG_CACHE === "1" &&
    process.env.DISABLE_STATIC_CACHE !== "1";

  app.use(
    express.static(PUBLIC_DIR, {
      index: false,
      maxAge: longCache ? "1h" : 0,
      setHeaders(res, filePath) {
        const rel = filePath.replace(/\\/g, "/");
        if (
          rel.endsWith(".html") ||
          rel.endsWith(".js") ||
          rel.endsWith(".css") ||
          rel.endsWith(".svg")
        ) {
          if (!longCache) noStoreHeaders(res);
        }
      },
    })
  );

  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    const p = req.path;
    if (
      p.startsWith("/api") ||
      p.startsWith("/uploads") ||
      p === "/health" ||
      p.includes(".")
    ) {
      next();
      return;
    }
    noStoreHeaders(res);
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });
}
