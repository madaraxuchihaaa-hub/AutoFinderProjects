import bcrypt from "bcryptjs";
import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import type { UserRole } from "./auth/types.js";

const RESERVED_EMAILS = new Set([
  "admin@autofinder.local",
  "moderator@autofinder.local",
  "demo@autofinder.local",
]);

const USER_SELECT = `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.is_blocked,
  u.created_at, u.updated_at,
  (SELECT COUNT(*)::int FROM listings l WHERE l.user_id = u.id) AS listings_count`;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isProtectedEmail(email: string): boolean {
  return RESERVED_EMAILS.has(normalizeEmail(email));
}

function parseRole(raw: unknown): UserRole | null {
  if (raw === "user" || raw === "moderator" || raw === "admin") return raw;
  return null;
}

export function registerAdminUserRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler
): void {
  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const pattern = q ? `%${q}%` : null;

    const { rows } = await pool.query(
      pattern
        ? `${USER_SELECT}
           FROM users u
           WHERE u.email ILIKE $1 OR COALESCE(u.full_name, '') ILIKE $1 OR COALESCE(u.phone, '') ILIKE $1
           ORDER BY u.created_at DESC
           LIMIT $2`
        : `${USER_SELECT}
           FROM users u
           ORDER BY u.created_at DESC
           LIMIT $1`,
      pattern ? [pattern, limit] : [limit]
    );
    res.json(rows);
  });

  app.get("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    const { rows } = await pool.query(
      `${USER_SELECT}
       FROM users u
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) {
      res.status(404).json({ error: "not_found", message: "Пользователь не найден." });
      return;
    }
    res.json(rows[0]);
  });

  app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    const email = normalizeEmail(String(req.body?.email ?? ""));
    const password = String(req.body?.password ?? "");
    const full_name = req.body?.full_name
      ? String(req.body.full_name).trim().slice(0, 120)
      : null;
    const phone = req.body?.phone
      ? String(req.body.phone).trim().slice(0, 32)
      : null;
    const roleRaw = req.body?.role ?? "user";
    const role = parseRole(roleRaw);

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "validation", message: "Укажите корректный email." });
      return;
    }
    if (RESERVED_EMAILS.has(email)) {
      res.status(400).json({ error: "validation", message: "Этот email зарезервирован." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "validation", message: "Пароль не короче 8 символов." });
      return;
    }
    if (!role || role === "admin") {
      res.status(400).json({
        error: "validation",
        message: "Допустимая роль при создании: user или moderator.",
      });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    try {
      const ins = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, phone, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, full_name, phone, role, is_blocked, created_at, updated_at`,
        [email, hash, full_name, phone, role]
      );
      const row = ins.rows[0];
      res.status(201).json({ ...row, listings_count: 0 });
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

  app.patch("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    const targetId = req.params.id;
    const actorId = req.auth!.userId;
    if (targetId === actorId) {
      res.status(400).json({
        error: "validation",
        message: "Редактируйте свой профиль в разделе «Профиль».",
      });
      return;
    }

    const existing = await pool.query<{
      id: string;
      email: string;
      role: UserRole;
    }>("SELECT id, email, role FROM users WHERE id = $1", [targetId]);
    const target = existing.rows[0];
    if (!target) {
      res.status(404).json({ error: "not_found", message: "Пользователь не найден." });
      return;
    }

    const protectedAccount = isProtectedEmail(target.email) || target.role === "admin";

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (req.body?.email !== undefined) {
      const email = normalizeEmail(String(req.body.email));
      if (!email || !email.includes("@")) {
        res.status(400).json({ error: "validation", message: "Укажите корректный email." });
        return;
      }
      if (RESERVED_EMAILS.has(email) && email !== normalizeEmail(target.email)) {
        res.status(400).json({ error: "validation", message: "Этот email зарезервирован." });
        return;
      }
      if (protectedAccount && email !== normalizeEmail(target.email)) {
        res.status(400).json({ error: "validation", message: "Нельзя менять email системной учётки." });
        return;
      }
      sets.push(`email = $${i++}`);
      vals.push(email);
    }

    if (req.body?.full_name !== undefined) {
      sets.push(`full_name = $${i++}`);
      vals.push(String(req.body.full_name).trim().slice(0, 120) || null);
    }

    if (req.body?.phone !== undefined) {
      sets.push(`phone = $${i++}`);
      vals.push(String(req.body.phone).trim().slice(0, 32) || null);
    }

    if (req.body?.role !== undefined) {
      const role = parseRole(req.body.role);
      if (!role) {
        res.status(400).json({ error: "validation", message: "Недопустимая роль." });
        return;
      }
      if (protectedAccount) {
        res.status(400).json({ error: "validation", message: "Роль системной учётки нельзя изменить." });
        return;
      }
      if (role === "admin") {
        res.status(400).json({
          error: "validation",
          message: "Назначение роли admin через API запрещено.",
        });
        return;
      }
      sets.push(`role = $${i++}`);
      vals.push(role);
    }

    if (req.body?.is_blocked !== undefined) {
      if (protectedAccount) {
        res.status(400).json({ error: "validation", message: "Системную учётку нельзя заблокировать." });
        return;
      }
      sets.push(`is_blocked = $${i++}`);
      vals.push(Boolean(req.body.is_blocked));
    }

    if (req.body?.password !== undefined) {
      const password = String(req.body.password);
      if (password.length > 0 && password.length < 8) {
        res.status(400).json({ error: "validation", message: "Пароль не короче 8 символов." });
        return;
      }
      if (password.length >= 8) {
        const hash = await bcrypt.hash(password, 10);
        sets.push(`password_hash = $${i++}`);
        vals.push(hash);
      }
    }

    if (!sets.length) {
      res.status(400).json({ error: "validation", message: "Нет полей для обновления." });
      return;
    }

    sets.push("updated_at = NOW()");
    vals.push(targetId);

    try {
      const { rows } = await pool.query(
        `UPDATE users SET ${sets.join(", ")} WHERE id = $${i}
         RETURNING id, email, full_name, phone, role, is_blocked, created_at, updated_at`,
        vals
      );
      if (!rows[0]) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const counts = await pool.query<{ c: number }>(
        "SELECT COUNT(*)::int AS c FROM listings WHERE user_id = $1",
        [targetId]
      );
      res.json({ ...rows[0], listings_count: counts.rows[0].c });
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "23505") {
        res.status(409).json({ error: "exists", message: "Email уже занят." });
        return;
      }
      console.error(e);
      res.status(500).json({ error: "server" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    const targetId = req.params.id;
    const actorId = req.auth!.userId;
    if (targetId === actorId) {
      res.status(400).json({ error: "validation", message: "Нельзя удалить свою учётную запись." });
      return;
    }

    const existing = await pool.query<{ email: string; role: UserRole }>(
      "SELECT email, role FROM users WHERE id = $1",
      [targetId]
    );
    const target = existing.rows[0];
    if (!target) {
      res.status(404).json({ error: "not_found", message: "Пользователь не найден." });
      return;
    }
    if (target.role === "admin" || isProtectedEmail(target.email)) {
      res.status(400).json({
        error: "validation",
        message: "Системную или администраторскую учётку удалить нельзя.",
      });
      return;
    }

    const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [targetId]);
    if (!rowCount) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true, id: targetId });
  });
}
