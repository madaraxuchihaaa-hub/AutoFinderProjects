import crypto from "node:crypto";
import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { findUserByEmail, normalizeEmail, verifyPassword } from "../auth/loginCore.js";
import type { UserRow } from "../auth/types.js";

/** Гарантирует csrfToken и compareIds в сессии (в т.ч. для анонимных GET). */
export function ensureSessionCompareAndCsrf(req: Parameters<RequestHandler>[0]): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  if (!req.session.compareIds) {
    req.session.compareIds = [];
  }
}

export const requireWebCsrf: RequestHandler = (req, res, next) => {
  const header = req.headers["x-csrf-token"];
  const fromHeader = typeof header === "string" ? header : Array.isArray(header) ? header[0] : "";
  const fromBody =
    req.body && typeof req.body === "object" && "_csrf" in req.body
      ? String((req.body as { _csrf?: string })._csrf ?? "")
      : "";
  const token = fromHeader || fromBody;
  ensureSessionCompareAndCsrf(req);
  if (token && token === req.session.csrfToken) {
    next();
    return;
  }
  res.status(403).json({ error: "csrf", message: "Неверный CSRF-токен." });
};

export function registerWebSessionRoutes(app: Express, pool: Pool): void {
  app.get("/api/me", async (req, res) => {
    ensureSessionCompareAndCsrf(req);
    const compareIds = req.session.compareIds ?? [];
    const uid = req.session.userId;
    if (!uid) {
      res.json({
        user: null,
        csrfToken: req.session.csrfToken,
        compareIds,
      });
      return;
    }
    const { rows } = await pool.query<UserRow>(
      `SELECT id, email, full_name, phone, role, created_at FROM users WHERE id = $1`,
      [uid]
    );
    const u = rows[0];
    if (!u) {
      req.session.userId = undefined;
      await new Promise<void>((resolve, reject) => {
        req.session.save((e) => (e ? reject(e) : resolve()));
      }).catch(() => undefined);
      res.json({ user: null, csrfToken: req.session.csrfToken, compareIds });
      return;
    }
    res.json({
      user: {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        role: u.role,
      },
      csrfToken: req.session.csrfToken,
      compareIds,
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const email = normalizeEmail(String(req.body?.email ?? ""));
    const password = String(req.body?.password ?? "");
    if (!email || !password) {
      res.status(400).json({ error: "validation", message: "Email и пароль обязательны." });
      return;
    }

    const row = await findUserByEmail(pool, email);
    if (!row || !(await verifyPassword(row, password))) {
      res.status(401).json({ error: "credentials", message: "Неверный email или пароль." });
      return;
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "server" });
        return;
      }
      req.session.userId = row.id;
      req.session.csrfToken = crypto.randomBytes(24).toString("hex");
      req.session.compareIds = [];
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error(saveErr);
          res.status(500).json({ error: "server" });
          return;
        }
        res.json({ ok: true });
      });
    });
  });

  app.post("/api/auth/logout", requireWebCsrf, (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "server" });
        return;
      }
      res.clearCookie("sid", { path: "/" });
      res.json({ ok: true });
    });
  });

  app.post("/api/listings/:id/compare", requireWebCsrf, (req, res) => {
    const id = req.params.id;
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(id)) {
      res.status(400).json({ error: "validation" });
      return;
    }
    ensureSessionCompareAndCsrf(req);
    const cur = [...(req.session.compareIds ?? [])];
    const idx = cur.indexOf(id);
    if (idx >= 0) {
      cur.splice(idx, 1);
    } else {
      cur.push(id);
      while (cur.length > 3) {
        cur.shift();
      }
    }
    req.session.compareIds = cur;
    req.session.save((err) => {
      if (err) {
        res.status(500).json({ error: "server" });
        return;
      }
      res.json({ compareIds: cur });
    });
  });

  app.get("/api/listings/compare", async (req, res) => {
    ensureSessionCompareAndCsrf(req);
    const ids = (req.session.compareIds ?? []).filter((x) => typeof x === "string").slice(0, 3);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    const { rows } = await pool.query(
      `SELECT l.id, l.title, l.brand, l.model, l.year, l.mileage_km, l.price_rub, l.city, l.status,
              COALESCE(
                (SELECT json_agg(url ORDER BY sort_order)
                 FROM listing_images li WHERE li.listing_id = l.id),
                '[]'::json
              ) AS images
       FROM listings l
       WHERE l.id = ANY($1::uuid[]) AND l.status = 'published'`,
      [ids]
    );
    res.json(rows);
  });
}
