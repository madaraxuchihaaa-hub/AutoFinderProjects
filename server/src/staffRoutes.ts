import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { resolveListingEquipment } from "./equipmentOptions.js";
import { getPublicOrigin, withNormalizedImages } from "./mediaUrls.js";
import { enqueuePublicationQueue } from "./listingQueue.js";
export function registerStaffRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireStaff: RequestHandler
): void {
  app.get("/api/staff/pending-listings", requireAuth, requireStaff, async (req, res) => {
    const origin = getPublicOrigin(req);
    const { rows } = await pool.query(
      `SELECT l.id, l.title, l.brand, l.model, l.year, l.mileage_km, l.price_byn, l.city, l.description,
              l.status, l.created_at, l.fuel_type, l.transmission, l.body_type, l.trim_level,
              l.plate_number, l.show_phone,
              u.email AS owner_email, u.full_name AS owner_name, u.id AS owner_id,
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
    res.json(
      rows.map((row) => {
        const normalized = withNormalizedImages(row, origin);
        const resolved = resolveListingEquipment(normalized);
        return {
          ...normalized,
          equipment: resolved.equipment,
          equipment_sections: resolved.sections,
        };
      })
    );
  });

  app.get("/api/staff/pending-listings/:id", requireAuth, requireStaff, async (req, res) => {
    const id = req.params.id;
    const origin = getPublicOrigin(req);
    const { rows } = await pool.query(
      `SELECT l.*,
              u.id AS owner_id,
              u.email AS owner_email,
              u.full_name AS owner_name,
              u.phone AS owner_phone,
              COALESCE(
                (SELECT json_agg(url ORDER BY sort_order)
                 FROM listing_images li WHERE li.listing_id = l.id),
                '[]'::json
              ) AS images
       FROM listings l
       JOIN users u ON u.id = l.user_id
       WHERE l.id = $1 AND l.status = 'moderation'`,
      [id]
    );
    if (!rows[0]) {
      res.status(404).json({ error: "not_found", message: "Заявка не найдена или уже обработана." });
      return;
    }
    const row = withNormalizedImages(rows[0], origin);
    const resolved = resolveListingEquipment(row);
    res.json({
      ...row,
      equipment: resolved.equipment,
      equipment_sections: resolved.sections,
    });
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
