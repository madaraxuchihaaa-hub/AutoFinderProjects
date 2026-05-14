import type { RequestHandler } from "express";
import { verifyAccessToken } from "./jwt.js";

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
