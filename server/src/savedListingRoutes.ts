import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { getPublicOrigin, withNormalizedImagesList } from "./mediaUrls.js";

const CMP_MAX = 3;

const LISTING_CARD = `SELECT l.id, l.title, l.brand, l.model, l.year, l.mileage_km, l.price_byn, l.city,
  l.fuel_type, l.transmission, l.body_type, l.drivetrain, l.status, l.created_at,
  COALESCE(
    (SELECT json_agg(url ORDER BY sort_order)
     FROM listing_images li WHERE li.listing_id = l.id),
    '[]'::json
  ) AS images`;

export function registerSavedListingRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler
): void {
  app.get("/api/me/favorites", requireAuth, async (req, res) => {
    const userId = req.auth!.userId;
    const { rows } = await pool.query(
      `${LISTING_CARD}
       FROM user_favorites uf
       JOIN listings l ON l.id = uf.listing_id
       WHERE uf.user_id = $1 AND l.status = 'published'
       ORDER BY uf.created_at DESC
       LIMIT 100`,
      [userId]
    );
    res.json(withNormalizedImagesList(rows, getPublicOrigin(req)));
  });

  app.get("/api/me/favorites/ids", requireAuth, async (req, res) => {
    const { rows } = await pool.query<{ listing_id: string }>(
      `SELECT listing_id FROM user_favorites WHERE user_id = $1`,
      [req.auth!.userId]
    );
    res.json(rows.map((r) => r.listing_id));
  });

  app.post("/api/listings/:id/favorite", requireAuth, async (req, res) => {
    const userId = req.auth!.userId;
    const listingId = req.params.id;
    const listing = await pool.query(
      `SELECT id, status FROM listings WHERE id = $1`,
      [listingId]
    );
    if (!listing.rows[0] || listing.rows[0].status !== "published") {
      res.status(404).json({ error: "not_found", message: "Объявление не найдено." });
      return;
    }
    const exists = await pool.query(
      `SELECT 1 FROM user_favorites WHERE user_id = $1 AND listing_id = $2`,
      [userId, listingId]
    );
    if (exists.rows[0]) {
      await pool.query(
        `DELETE FROM user_favorites WHERE user_id = $1 AND listing_id = $2`,
        [userId, listingId]
      );
      res.json({ active: false });
      return;
    }
    await pool.query(
      `INSERT INTO user_favorites (user_id, listing_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, listingId]
    );
    res.json({ active: true });
  });

  app.get("/api/me/compare", requireAuth, async (req, res) => {
    const userId = req.auth!.userId;
    const { rows } = await pool.query(
      `${LISTING_CARD}
       FROM user_compare uc
       JOIN listings l ON l.id = uc.listing_id
       WHERE uc.user_id = $1 AND l.status = 'published'
       ORDER BY uc.sort_order ASC, uc.created_at ASC
       LIMIT ${CMP_MAX}`,
      [userId]
    );
    res.json(withNormalizedImagesList(rows, getPublicOrigin(req)));
  });

  app.get("/api/me/compare/ids", requireAuth, async (req, res) => {
    const { rows } = await pool.query<{ listing_id: string }>(
      `SELECT listing_id FROM user_compare WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [req.auth!.userId]
    );
    res.json(rows.map((r) => r.listing_id));
  });

  app.post("/api/listings/:id/compare", requireAuth, async (req, res) => {
    const userId = req.auth!.userId;
    const listingId = req.params.id;
    const listing = await pool.query(
      `SELECT id, status FROM listings WHERE id = $1`,
      [listingId]
    );
    if (!listing.rows[0] || listing.rows[0].status !== "published") {
      res.status(404).json({ error: "not_found", message: "Объявление не найдено." });
      return;
    }
    const exists = await pool.query(
      `SELECT 1 FROM user_compare WHERE user_id = $1 AND listing_id = $2`,
      [userId, listingId]
    );
    if (exists.rows[0]) {
      await pool.query(
        `DELETE FROM user_compare WHERE user_id = $1 AND listing_id = $2`,
        [userId, listingId]
      );
      res.json({ active: false });
      return;
    }
    const count = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM user_compare WHERE user_id = $1`,
      [userId]
    );
    if (Number(count.rows[0]?.c ?? 0) >= CMP_MAX) {
      res.status(400).json({
        error: "limit",
        message: `В сравнении не больше ${CMP_MAX} объявлений.`,
      });
      return;
    }
    const order = Number(count.rows[0]?.c ?? 0);
    await pool.query(
      `INSERT INTO user_compare (user_id, listing_id, sort_order) VALUES ($1, $2, $3)`,
      [userId, listingId, order]
    );
    res.json({ active: true });
  });
}
