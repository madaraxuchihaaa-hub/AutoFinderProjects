import bcrypt from "bcryptjs";
import type { Express } from "express";
import type { Pool } from "pg";
import { signAccessToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";
import { findUserByEmail, normalizeEmail, toSafeUser, verifyPassword } from "./loginCore.js";
import type { UserRole, UserRow } from "./types.js";

export function registerAuthRoutes(app: Express, pool: Pool): void {
  app.post("/api/auth/register", async (req, res) => {
    const email = normalizeEmail(String(req.body?.email ?? ""));
    const password = String(req.body?.password ?? "");
    const full_name = req.body?.full_name
      ? String(req.body.full_name).trim().slice(0, 120)
      : null;
    const phone = req.body?.phone
      ? String(req.body.phone).trim().slice(0, 32)
      : null;

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "validation", message: "Укажите корректный email." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({
        error: "validation",
        message: "Пароль не короче 8 символов.",
      });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    try {
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, full_name, phone, role)
         VALUES ($1, $2, $3, $4, 'user')
         RETURNING id`,
        [email, hash, full_name, phone]
      );
      const userId = ins.rows[0].id;
      const token = signAccessToken(userId, email, "user");
      res.status(201).json({
        accessToken: token,
        user: { id: userId, email, full_name, phone, role: "user" as const },
      });
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "23505") {
        res.status(409).json({ error: "exists", message: "Пользователь с таким email уже есть." });
        return;
      }
      console.error(e);
      res.status(500).json({ error: "server" });
    }
  });

  /** JWT только для мобильного клиента (Expo). */
  app.post("/api/mobile/login", async (req, res) => {
    const email = normalizeEmail(String(req.body?.email ?? ""));
    const password = String(req.body?.password ?? "");
    if (!email || !password) {
      res.status(400).json({ error: "validation", message: "Email и пароль обязательны." });
      return;
    }

    const row = await findUserByEmail(pool, email);
    if (!row) {
      res.status(401).json({ error: "credentials", message: "Неверный email или пароль." });
      return;
    }
    const ok = await verifyPassword(row, password);
    if (!ok) {
      res.status(401).json({ error: "credentials", message: "Неверный email или пароль." });
      return;
    }

    const role = row.role as UserRole;
    const token = signAccessToken(row.id, row.email, role);
    res.json({
      token,
      user: toSafeUser(row),
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const { rows } = await pool.query<UserRow>(
      `SELECT id, email, full_name, phone, role, created_at FROM users WHERE id = $1`,
      [req.auth!.userId]
    );
    if (!rows[0]) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const u = rows[0];
    res.json({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      phone: u.phone,
      role: u.role,
      created_at: u.created_at,
    });
  });

  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    const full_name =
      req.body?.full_name !== undefined
        ? String(req.body.full_name).trim().slice(0, 120) || null
        : undefined;
    const phone =
      req.body?.phone !== undefined
        ? String(req.body.phone).trim().slice(0, 32) || null
        : undefined;

    if (full_name === undefined && phone === undefined) {
      res.status(400).json({ error: "validation", message: "Нет полей для обновления." });
      return;
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (full_name !== undefined) {
      sets.push(`full_name = $${i++}`);
      vals.push(full_name);
    }
    if (phone !== undefined) {
      sets.push(`phone = $${i++}`);
      vals.push(phone);
    }
    sets.push(`updated_at = NOW()`);
    vals.push(req.auth!.userId);

    const { rows } = await pool.query<UserRow>(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${i}
       RETURNING id, email, full_name, phone, role, created_at`,
      vals
    );
    res.json(rows[0]);
  });
}
