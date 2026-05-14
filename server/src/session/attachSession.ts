import cookieParser from "cookie-parser";
import type { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Pool } from "pg";

export function attachSessionMiddleware(app: Express, pool: Pool): void {
  const PgSession = connectPgSimple(session);
  const secret =
    process.env.SESSION_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "dev-only-change-session-secret";

  app.use(cookieParser());
  app.use(
    session({
      name: "sid",
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: false,
      }),
      secret,
      resave: false,
      saveUninitialized: true,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    })
  );
}
