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

/** Статика и SPA fallback (после всех /api маршрутов). */
export function registerWeb(app: Express): void {
  if (!hasWebBuild()) {
    console.warn("[web] public/index.html не найден — веб-интерфейс отключён");
    return;
  }

  app.use(
    express.static(PUBLIC_DIR, {
      index: false,
      maxAge:
        process.env.DISABLE_STATIC_CACHE === "1"
          ? 0
          : process.env.NODE_ENV === "production"
            ? "1h"
            : 0,
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
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });
}
