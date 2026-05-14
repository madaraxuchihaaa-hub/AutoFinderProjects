import type { RequestHandler } from "express";
import { verifyAccessToken } from "./jwt.js";
import type { UserRole } from "./types.js";

export const requireAuth: RequestHandler = (req, res, next) => {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Требуется авторизация" });
    return;
  }
  const token = raw.slice(7).trim();
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: "invalid_token", message: "Неверный или просроченный токен" });
    return;
  }
  req.auth = payload;
  next();
};

/** Подставляет req.auth при наличии валидного Bearer; иначе без ошибки. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) {
    next();
    return;
  }
  const payload = verifyAccessToken(raw.slice(7).trim());
  if (payload) req.auth = payload;
  next();
};

function requireRoles(roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({ error: "unauthorized", message: "Требуется авторизация" });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: "forbidden", message: "Недостаточно прав" });
      return;
    }
    next();
  };
}

export const requireStaff = requireRoles(["admin", "moderator"]);
export const requireAdmin = requireRoles(["admin"]);
