import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import type { UserRole, UserRow } from "./types.js";

export async function findUserByEmail(
  pool: Pool,
  email: string
): Promise<(UserRow & { password_hash: string }) | null> {
  const normalized = normalizeEmail(email);
  const { rows } = await pool.query<UserRow & { password_hash: string }>(
    `SELECT id, email, password_hash, full_name, phone, role, created_at FROM users WHERE email = $1`,
    [normalized]
  );
  return rows[0] ?? null;
}

export async function verifyPassword(
  row: { password_hash: string },
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, row.password_hash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type SafeUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
};

export function toSafeUser(row: UserRow & { password_hash?: string }): SafeUser {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    phone: row.phone,
    role: row.role,
  };
}
