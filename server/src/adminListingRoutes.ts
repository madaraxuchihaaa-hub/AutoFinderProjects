import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { getPublicOrigin, withNormalizedImagesList } from "./mediaUrls.js";

const LISTING_STATUSES = new Set(["draft", "published", "moderation", "archived"]);

export function registerAdminListingRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler
): void {
  app.get("/api/admin/listings", requireAuth, requireAdmin, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const conditions: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (status && status !== "all") {
      if (!LISTING_STATUSES.has(status)) {
        res.status(400).json({ error: "validation", message: "Недопустимый статус." });
        return;
      }
      conditions.push(`l.status = $${i++}`);
      vals.push(status);
    }

    if (q) {
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRe.test(q)) {
        conditions.push(`l.id = $${i++}`);
        vals.push(q);
      } else {
        const pat = `%${q}%`;
        conditions.push(
          `(l.title ILIKE $${i} OR l.brand ILIKE $${i} OR l.model ILIKE $${i} OR COALESCE(l.city,'') ILIKE $${i} OR u.email ILIKE $${i} OR COALESCE(l.plate_number,'') ILIKE $${i})`
        );
        vals.push(pat);
        i++;
      }
    }

    const where = conditions.length ? conditions.join(" AND ") : "TRUE";
    const origin = getPublicOrigin(req);

    const { rows: countRows } = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM listings l
       JOIN users u ON u.id = l.user_id
       WHERE ${where}`,
      vals
    );
    const total = Number(countRows[0]?.c ?? 0);

    const limIdx = i++;
    const offIdx = i++;
    const listVals = [...vals, limit, offset];

    const { rows } = await pool.query(
      `SELECT l.id, l.title, l.brand, l.model, l.year, l.status, l.price_byn, l.city, l.created_at,
              u.email AS owner_email,
              COALESCE(
                (SELECT json_agg(url ORDER BY sort_order)
                 FROM listing_images li WHERE li.listing_id = l.id),
                '[]'::json
              ) AS images
       FROM listings l
       JOIN users u ON u.id = l.user_id
       WHERE ${where}
       ORDER BY l.created_at DESC
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      listVals
    );

    res.json({
      items: withNormalizedImagesList(rows as { images?: unknown }[], origin),
      total,
    });
  });
}
