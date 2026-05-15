import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { enqueuePublicationQueue } from "./listingQueue.js";
export function registerStaffRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireStaff: RequestHandler
): void {
  app.get("/api/staff/pending-listings", requireAuth, requireStaff, async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT l.id, l.title, l.brand, l.model, l.year, l.mileage_km, l.price_rub, l.city, l.description,
              l.status, l.created_at, u.email AS owner_email, u.id AS owner_id,
              COALESCE(
                (SELECT json_agg(url ORDER BY sort_order)
                 FROM listing_images li WHERE li.listing_id = l.id),
                '[]'::json
              ) AS images
       FROM listings l
       JOIN users u ON u.id = l.user_id
       WHERE l.status = 'moderation'
       ORDER BY l.created_at ASC`
    );
    res.json(rows);
  });

  app.post("/api/staff/pending-listings/:id/approve", requireAuth, requireStaff, async (req, res) => {
    const listingId = req.params.id;
    const staffId = req.auth!.userId;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const upd = await client.query<{ id: string }>(
        `UPDATE listings
         SET status = 'published',
             updated_at = NOW(),
             moderated_at = NOW(),
             moderated_by = $2,
             reject_reason = NULL
         WHERE id = $1 AND status = 'moderation'
         RETURNING id`,
        [listingId, staffId]
      );
      if (!upd.rows[0]) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "not_found", message: "Заявка не найдена или уже обработана." });
        return;
      }
      await enqueuePublicationQueue(client, listingId);
      await client.query("COMMIT");
      res.json({ ok: true, id: listingId, status: "published" });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(e);
      res.status(500).json({ error: "server" });
    } finally {
      client.release();
    }
  });

  app.post("/api/staff/pending-listings/:id/reject", requireAuth, requireStaff, async (req, res) => {
    const listingId = req.params.id;
    const staffId = req.auth!.userId;
    const reason = req.body?.reason
      ? String(req.body.reason).trim().slice(0, 500)
      : null;

    const { rowCount } = await pool.query(
      `UPDATE listings
       SET status = 'archived',
           updated_at = NOW(),
           moderated_at = NOW(),
           moderated_by = $2,
           reject_reason = $3
       WHERE id = $1 AND status = 'moderation'`,
      [listingId, staffId, reason]
    );
    if (!rowCount) {
      res.status(404).json({ error: "not_found", message: "Заявка не найдена или уже обработана." });
      return;
    }
    res.json({ ok: true, id: listingId, status: "archived" });
  });

}
