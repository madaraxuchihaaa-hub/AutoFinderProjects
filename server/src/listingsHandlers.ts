import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { enqueuePublicationQueue } from "./listingQueue.js";
import { getPublicOrigin, withNormalizedImagesList } from "./mediaUrls.js";
import {
  parseListingBody,
  replaceListingImages,
  statusAfterOwnerEdit,
  validateListingCatalog,
} from "./listingWrite.js";

export function registerProtectedListingRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler
): void {
  app.get("/api/me/listings", requireAuth, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT l.id, l.title, l.brand, l.model, l.year, l.mileage_km, l.price_byn, l.city, l.status, l.created_at,
              l.show_phone, l.plate_number,
              COALESCE(
                (SELECT json_agg(url ORDER BY sort_order)
                 FROM listing_images li WHERE li.listing_id = l.id),
                '[]'::json
              ) AS images
       FROM listings l
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC
       LIMIT 100`,
      [req.auth!.userId]
    );
    res.json(withNormalizedImagesList(rows, getPublicOrigin(req)));
  });

  app.post("/api/listings", requireAuth, async (req, res) => {
    const userId = req.auth!.userId;
    const role = req.auth!.role;
    const staffPublish = role === "admin" || role === "moderator";
    const initialStatus = staffPublish ? "published" : "moderation";

    const parsed = parseListingBody(req.body as Record<string, unknown>);
    if (!parsed.ok) {
      res.status(400).json({ error: "validation", message: parsed.message });
      return;
    }
    const d = parsed.data;

    const catalogErr = await validateListingCatalog(pool, d.brand, d.model);
    if (catalogErr) {
      res.status(400).json({ error: "validation", message: catalogErr });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ins = await client.query<{ id: string }>(
        `INSERT INTO listings (
           user_id, title, description, brand, model, year, mileage_km, price_byn,
           fuel_type, transmission, body_type, engine_volume_ml, drivetrain, color, vin,
           city, status, source,
           trim_level, interior, interior_details, safety_systems, equipment, show_phone, plate_number
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'user',$18,$19,$20,$21,$22::jsonb,$23,$24)
         RETURNING id`,
        [
          userId,
          d.title.slice(0, 200),
          d.description ? d.description.slice(0, 4000) : null,
          d.brand.slice(0, 80),
          d.model.slice(0, 80),
          d.year,
          d.mileage_km,
          Math.floor(d.price_byn),
          d.fuel_type ? d.fuel_type.slice(0, 40) : null,
          d.transmission ? d.transmission.slice(0, 40) : null,
          d.body_type ? d.body_type.slice(0, 40) : null,
          d.engine_volume_ml,
          d.drivetrain,
          d.color,
          d.vin,
          d.city ? d.city.slice(0, 80) : null,
          initialStatus,
          d.trim_level ? d.trim_level.slice(0, 120) : null,
          d.interior ? d.interior.slice(0, 120) : null,
          d.interior_details ? d.interior_details.slice(0, 2000) : null,
          d.safety_systems ? d.safety_systems.slice(0, 2000) : null,
          JSON.stringify(d.equipment),
          d.show_phone,
          d.plate_number,
        ]
      );
      const listingId = ins.rows[0].id;
      await replaceListingImages(client, listingId, d.image_urls);

      if (staffPublish) {
        await enqueuePublicationQueue(client, listingId);
      }

      await client.query("COMMIT");
      res.status(201).json({ id: listingId, status: initialStatus });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(e);
      res.status(500).json({ error: "server" });
    } finally {
      client.release();
    }
  });

  app.patch("/api/listings/:id", requireAuth, async (req, res) => {
    const listingId = req.params.id;
    const userId = req.auth!.userId;
    const role = req.auth!.role;
    const isStaff = role === "admin" || role === "moderator";

    const parsed = parseListingBody(req.body as Record<string, unknown>);
    if (!parsed.ok) {
      res.status(400).json({ error: "validation", message: parsed.message });
      return;
    }
    const d = parsed.data;

    const catalogErr = await validateListingCatalog(pool, d.brand, d.model);
    if (catalogErr) {
      res.status(400).json({ error: "validation", message: catalogErr });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const cur = await client.query<{ status: string; user_id: string }>(
        `SELECT status, user_id FROM listings WHERE id = $1 FOR UPDATE`,
        [listingId]
      );
      const row = cur.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "not_found", message: "Объявление не найдено." });
        return;
      }
      if (row.user_id !== userId && !isStaff) {
        await client.query("ROLLBACK");
        res.status(403).json({ error: "forbidden", message: "Нет прав на редактирование." });
        return;
      }

      const nextStatus = statusAfterOwnerEdit(row.status, isStaff);

      await client.query(
        `UPDATE listings SET
           title = $2, description = $3, brand = $4, model = $5, year = $6,
           mileage_km = $7, price_byn = $8, fuel_type = $9, transmission = $10,
           body_type = $11, engine_volume_ml = $12, drivetrain = $13, color = $14, vin = $15,
           city = $16, status = $17, trim_level = $18,
           interior = $19, interior_details = $20, safety_systems = $21,
           equipment = $22::jsonb, show_phone = $23, plate_number = $24,
           reject_reason = CASE WHEN $17 = 'moderation' AND NOT $25::boolean THEN NULL ELSE reject_reason END,
           updated_at = NOW()
         WHERE id = $1`,
        [
          listingId,
          d.title.slice(0, 200),
          d.description ? d.description.slice(0, 4000) : null,
          d.brand.slice(0, 80),
          d.model.slice(0, 80),
          d.year,
          d.mileage_km,
          Math.floor(d.price_byn),
          d.fuel_type ? d.fuel_type.slice(0, 40) : null,
          d.transmission ? d.transmission.slice(0, 40) : null,
          d.body_type ? d.body_type.slice(0, 40) : null,
          d.engine_volume_ml,
          d.drivetrain,
          d.color,
          d.vin,
          d.city ? d.city.slice(0, 80) : null,
          nextStatus,
          d.trim_level ? d.trim_level.slice(0, 120) : null,
          d.interior ? d.interior.slice(0, 120) : null,
          d.interior_details ? d.interior_details.slice(0, 2000) : null,
          d.safety_systems ? d.safety_systems.slice(0, 2000) : null,
          JSON.stringify(d.equipment),
          d.show_phone,
          d.plate_number,
          isStaff,
        ]
      );

      if (req.body && Object.prototype.hasOwnProperty.call(req.body, "image_urls")) {
        await replaceListingImages(client, listingId, d.image_urls);
      }

      await client.query("COMMIT");
      res.json({ ok: true, id: listingId, status: nextStatus });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(e);
      res.status(500).json({ error: "server" });
    } finally {
      client.release();
    }
  });

  app.delete("/api/listings/:id", requireAuth, async (req, res) => {
    const listingId = req.params.id;
    const userId = req.auth!.userId;
    const role = req.auth!.role;
    const isStaff = role === "admin" || role === "moderator";

    const { rowCount } = await pool.query(
      `DELETE FROM listings WHERE id = $1 AND ($2::boolean OR user_id = $3::uuid)`,
      [listingId, isStaff, userId]
    );
    if (!rowCount) {
      res.status(404).json({ error: "not_found", message: "Объявление не найдено." });
      return;
    }
    res.json({ ok: true, id: listingId });
  });

  app.get("/api/queue/jobs", requireAuth, async (req, res) => {
    const role = req.auth!.role;
    const userId = req.auth!.userId;
    const isStaff = role === "admin" || role === "moderator";

    const { rows } = await pool.query(
      `SELECT pq.id, pq.status, pq.scheduled_at, pq.attempts, pq.last_error,
              p.name AS platform_name, p.code AS platform_code,
              l.id AS listing_id, l.title AS listing_title, l.price_byn
       FROM publication_queue pq
       JOIN platforms p ON p.id = pq.platform_id
       JOIN listings l ON l.id = pq.listing_id
       WHERE ($1::boolean OR l.user_id = $2::uuid)
       ORDER BY pq.scheduled_at DESC
       LIMIT 100`,
      [isStaff, userId]
    );
    res.json(rows);
  });
}
