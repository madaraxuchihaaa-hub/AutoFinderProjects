import type { Express } from "express";
import type { Pool } from "pg";

export function registerCatalogListRoute(app: Express, pool: Pool): void {
  app.get("/api/listings", async (req, res) => {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit) || 20)));
    const offset = (page - 1) * limit;

    const countR = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM listings WHERE status = 'published'`
    );
    const total = countR.rows[0]?.c ?? 0;

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
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ items: rows, total, page, limit });
  });
}
