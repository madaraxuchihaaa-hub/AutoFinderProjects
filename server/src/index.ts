import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { ensureJwtSecretConfigured } from "./auth/jwt.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { optionalAuth, requireAdmin, requireAuth, requireStaff } from "./auth/middleware.js";
import { registerProtectedListingRoutes } from "./listingsHandlers.js";
import { registerAdminUserRoutes } from "./adminUserRoutes.js";
import { registerChatRoutes } from "./chatRoutes.js";
import { getUsdPerByn, bynToUsd } from "./exchangeRates.js";
import { parseListingSearchQuery, searchPublishedListings } from "./listingSearch.js";
import { registerStaffRoutes } from "./staffRoutes.js";
import { pool } from "./db/pool.js";
import { runMigrations } from "./db/runMigrations.js";
import { seedCarCatalogIfNeeded } from "./seedCarCatalog.js";
import { registerUploadRoutes } from "./uploadRoutes.js";
import { registerVehicleRoutes } from "./vehicleRoutes.js";

dotenv.config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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

app.get("/api/exchange-rates", async (_req, res) => {
  const usdPerByn = await getUsdPerByn();
  res.json({
    usdPerByn,
    source: "nbrb",
    example: { byn: 10000, usd: Math.round(bynToUsd(10000, usdPerByn) * 100) / 100 },
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
  const q = String(req.query.q ?? "").trim();
  if (q) {
    const pattern = `%${q}%`;
    const { rows } = await pool.query(
      `SELECT id, title, brand, model, year, mileage_km, price_byn, city, image_urls, fetched_at
       FROM aggregated_listings
       WHERE title ILIKE $1 OR brand ILIKE $1 OR model ILIKE $1 OR city ILIKE $1
       ORDER BY fetched_at DESC
       LIMIT $2`,
      [pattern, limit]
    );
    res.json(rows);
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, title, brand, model, year, mileage_km, price_byn, city, image_urls, fetched_at
     FROM aggregated_listings
     ORDER BY fetched_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

app.get("/api/aggregated/:id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, feed_id, external_id, title, brand, model, year, mileage_km, price_byn, city, image_urls, raw_json, fetched_at
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
  const params = parseListingSearchQuery(req.query as Record<string, unknown>);
  const hasFilters =
    params.brand ||
    params.model ||
    params.yearFrom != null ||
    params.yearTo != null ||
    params.priceFrom != null ||
    params.priceTo != null ||
    params.volumeFrom != null ||
    params.volumeTo != null ||
    params.transmission ||
    params.bodyType ||
    params.fuelType ||
    params.drivetrain ||
    params.generation ||
    params.q;

  if (hasFilters || req.query.search === "1") {
    const { rows, total } = await searchPublishedListings(pool, {
      ...params,
      limit: params.limit ?? 50,
    });
    res.json({ items: rows, total });
    return;
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const { rows, total } = await searchPublishedListings(pool, { limit });
  res.json({ items: rows, total });
});

app.get("/api/listings/:id", optionalAuth, async (req, res) => {
  const id = req.params.id;
  const auth = req.auth;
  const isStaff = auth?.role === "admin" || auth?.role === "moderator";
  const userId = auth?.userId ?? null;

  const { rows } = await pool.query(
    `SELECT l.*,
            u.id AS owner_id,
            u.full_name AS owner_name,
            CASE
              WHEN l.user_id = $2::uuid THEN u.phone
              WHEN l.show_phone AND l.status = 'published' THEN u.phone
              ELSE NULL
            END AS owner_phone,
            COALESCE(
              (SELECT json_agg(url ORDER BY sort_order)
               FROM listing_images li WHERE li.listing_id = l.id),
              '[]'::json
            ) AS images
     FROM listings l
     JOIN users u ON u.id = l.user_id
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

registerVehicleRoutes(app, pool);
registerUploadRoutes(app, requireAuth);
registerAuthRoutes(app, pool);
registerProtectedListingRoutes(app, pool, requireAuth);
registerAdminUserRoutes(app, pool, requireAuth, requireAdmin);
registerChatRoutes(app, pool, requireAuth);
registerStaffRoutes(app, pool, requireAuth, requireStaff);

const port = Number(process.env.PORT ?? 3000);

async function main() {
  ensureJwtSecretConfigured();
  await runMigrations(pool);
  await seedCarCatalogIfNeeded(pool);
  app.listen(port, () => {
    console.info(`AutoFinder API → http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
