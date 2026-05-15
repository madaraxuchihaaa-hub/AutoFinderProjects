import bcrypt from "bcryptjs";
import type { Express } from "express";
import type { Pool } from "pg";
import { signAccessToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";
import type { UserRole, UserRow } from "./types.js";
import {
  normalizeByPhone,
  normalizeByPlate,
  validateByPhone,
  validateByPlate,
} from "../validation/by.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function registerAuthRoutes(app: Express, pool: Pool): void {
  app.post("/api/auth/register", async (req, res) => {
    const email = normalizeEmail(String(req.body?.email ?? ""));
    const password = String(req.body?.password ?? "");
    const full_name = req.body?.full_name
      ? String(req.body.full_name).trim().slice(0, 120)
      : null;
    const phoneRaw = req.body?.phone ? String(req.body.phone).trim() : null;

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

    const reserved = [
      "moderator@autofinder.local",
      "admin@autofinder.local",
      "demo@autofinder.local",
    ];
    if (reserved.includes(email)) {
      res.status(400).json({ error: "validation", message: "Этот email зарезервирован." });
      return;
    }

    const phoneErr = validateByPhone(phoneRaw);
    if (phoneErr) {
      res.status(400).json({ error: "validation", message: phoneErr });
      return;
    }
    const phone = phoneRaw ? normalizeByPhone(phoneRaw) : null;

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

  app.post("/api/auth/login", async (req, res) => {
    const email = normalizeEmail(String(req.body?.email ?? ""));
    const password = String(req.body?.password ?? "");
    if (!email || !password) {
      res.status(400).json({ error: "validation", message: "Email и пароль обязательны." });
      return;
    }

    const { rows } = await pool.query<
      UserRow & { password_hash: string; is_blocked?: boolean }
    >(
      `SELECT id, email, password_hash, full_name, phone, plate_number, role, created_at, is_blocked
       FROM users WHERE email = $1`,
      [email]
    );
    const row = rows[0];
    if (!row) {
      res.status(401).json({ error: "credentials", message: "Неверный email или пароль." });
      return;
    }
    if (row.is_blocked) {
      res.status(403).json({
        error: "blocked",
        message: "Учётная запись заблокирована. Обратитесь к администратору.",
      });
      return;
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      res.status(401).json({ error: "credentials", message: "Неверный email или пароль." });
      return;
    }

    const role = row.role as UserRole;
    const token = signAccessToken(row.id, row.email, role);
    res.json({
      accessToken: token,
      user: {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        phone: row.phone,
        plate_number: row.plate_number,
        role,
      },
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const { rows } = await pool.query<UserRow>(
      `SELECT id, email, full_name, phone, plate_number, role, created_at FROM users WHERE id = $1`,
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
      plate_number: u.plate_number,
      role: u.role,
      created_at: u.created_at,
    });
  });

  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    const full_name =
      req.body?.full_name !== undefined
        ? String(req.body.full_name).trim().slice(0, 120) || null
        : undefined;
    const phoneRaw =
      req.body?.phone !== undefined
        ? String(req.body.phone).trim() || null
        : undefined;
    const plateRaw =
      req.body?.plate_number !== undefined
        ? String(req.body.plate_number).trim() || null
        : undefined;

    if (full_name === undefined && phoneRaw === undefined && plateRaw === undefined) {
      res.status(400).json({ error: "validation", message: "Нет полей для обновления." });
      return;
    }

    if (phoneRaw !== undefined) {
      const phoneErr = validateByPhone(phoneRaw);
      if (phoneErr) {
        res.status(400).json({ error: "validation", message: phoneErr });
        return;
      }
    }
    if (plateRaw !== undefined) {
      const plateErr = validateByPlate(plateRaw);
      if (plateErr) {
        res.status(400).json({ error: "validation", message: plateErr });
        return;
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (full_name !== undefined) {
      sets.push(`full_name = $${i++}`);
      vals.push(full_name);
    }
    if (phoneRaw !== undefined) {
      sets.push(`phone = $${i++}`);
      vals.push(phoneRaw ? normalizeByPhone(phoneRaw) : null);
    }
    if (plateRaw !== undefined) {
      sets.push(`plate_number = $${i++}`);
      vals.push(plateRaw ? normalizeByPlate(plateRaw) : null);
    }
    sets.push(`updated_at = NOW()`);
    vals.push(req.auth!.userId);

    const { rows } = await pool.query<UserRow>(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${i}
       RETURNING id, email, full_name, phone, plate_number, role, created_at`,
      vals
    );
    res.json(rows[0]);
  });
}
