import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { ensureJwtSecretConfigured } from "./auth/jwt.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { optionalAuth, requireAdmin, requireAuth, requireStaff } from "./auth/middleware.js";
import { registerProtectedListingRoutes } from "./listingsHandlers.js";
import { registerStaffRoutes } from "./staffRoutes.js";
import { pool } from "./db/pool.js";
import { runMigrations } from "./db/runMigrations.js";

dotenv.config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/api/stats", async (_req, res) => {
  const [a, l, q] = await Promise.all([
    pool.query<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM aggregated_listings"
    ),
    pool.query<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM listings WHERE status = 'published'"
    ),
    pool.query<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM publication_queue WHERE status = 'pending'"
    ),
  ]);
  res.json({
    aggregated: a.rows[0].c,
    publishedListings: l.rows[0].c,
    queuePending: q.rows[0].c,
  });
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "up" });
  } catch {
    res.status(500).json({ ok: false, db: "down" });
  }
});

app.get("/api/platforms", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, code, name, base_url, is_active FROM platforms WHERE is_active = TRUE ORDER BY id"
  );
  res.json(rows);
});

app.get("/api/aggregated", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const { rows } = await pool.query(
    `SELECT id, title, brand, model, year, mileage_km, price_rub, city, image_urls, fetched_at
     FROM aggregated_listings
     ORDER BY fetched_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

app.get("/api/aggregated/:id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, feed_id, external_id, title, brand, model, year, mileage_km, price_rub, city, image_urls, raw_json, fetched_at
     FROM aggregated_listings WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(rows[0]);
});

app.get("/api/listings", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.brand, l.model, l.year, l.mileage_km, l.price_rub, l.city, l.status, l.created_at,
            COALESCE(
              (SELECT json_agg(url ORDER BY sort_order)
               FROM listing_images li WHERE li.listing_id = l.id),
              '[]'::json
            ) AS images
     FROM listings l
     WHERE l.status = 'published'
     ORDER BY l.created_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

app.get("/api/listings/:id", optionalAuth, async (req, res) => {
  const id = req.params.id;
  const auth = req.auth;
  const isStaff = auth?.role === "admin" || auth?.role === "moderator";
  const userId = auth?.userId ?? null;

  const { rows } = await pool.query(
    `SELECT l.*,
            COALESCE(
              (SELECT json_agg(url ORDER BY sort_order)
               FROM listing_images li WHERE li.listing_id = l.id),
              '[]'::json
            ) AS images
     FROM listings l
     WHERE l.id = $1
       AND (
         l.status = 'published'
         OR ($2::uuid IS NOT NULL AND l.user_id = $2::uuid)
         OR $3::boolean
       )`,
    [id, userId, isStaff]
  );
  if (!rows[0]) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(rows[0]);
});

app.get("/api/queue/summary", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT pq.status, COUNT(*)::int AS count
     FROM publication_queue pq
     GROUP BY pq.status`
  );
  res.json(rows);
});

registerAuthRoutes(app, pool);
registerProtectedListingRoutes(app, pool, requireAuth);
registerStaffRoutes(app, pool, requireAuth, requireStaff, requireAdmin);

const port = Number(process.env.PORT ?? 3000);

async function main() {
  ensureJwtSecretConfigured();
  await runMigrations(pool);
  app.listen(port, () => {
    console.info(`AutoFinder API → http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
