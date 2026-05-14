import jwt from "jsonwebtoken";
import type { UserRole } from "./types.js";

/** Вызовите в `main()` до `app.listen`, чтобы не падать на `/api/auth/*` с 502. */
export function ensureJwtSecretConfigured(): void {
  const s = process.env.JWT_SECRET?.trim();
  if (s) return;
  console.error(
    "[AutoFinder] JWT_SECRET is not set.\n" +
      "Add a long random string (32+ chars) as env JWT_SECRET.\n" +
      "Railway: your API service → Variables → JWT_SECRET → Generate / paste."
  );
  process.exit(1);
}

function secret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

export function signAccessToken(
  userId: string,
  email: string,
  role: UserRole
): string {
  return jwt.sign(
    { email, role },
    secret(),
    { subject: userId, expiresIn: "7d" }
  );
}

export function verifyAccessToken(token: string): {
  userId: string;
  email: string;
  role: UserRole;
} | null {
  try {
    const decoded = jwt.verify(token, secret()) as jwt.JwtPayload & {
      email?: string;
      role?: UserRole;
    };
    if (!decoded.sub || typeof decoded.sub !== "string") return null;
    const role = decoded.role;
    if (role !== "admin" && role !== "moderator" && role !== "user") return null;
    return {
      userId: decoded.sub,
      email: String(decoded.email ?? ""),
      role,
    };
  } catch {
    return null;
  }
}
