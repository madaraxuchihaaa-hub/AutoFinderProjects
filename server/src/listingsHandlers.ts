import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";

export function registerProtectedListingRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler
): void {
  app.post("/api/listings", requireAuth, async (req, res) => {
    const userId = req.auth!.userId;

    const b = req.body as Record<string, unknown>;
    const title = String(b.title ?? "").trim();
    const brand = String(b.brand ?? "").trim();
    const model = String(b.model ?? "").trim();
    const year = Number(b.year);
    const price_rub = Number(b.price_rub);
    const mileage_km =
      b.mileage_km === undefined || b.mileage_km === ""
        ? null
        : Number(b.mileage_km);
    const city = b.city ? String(b.city).trim() : null;
    const description = b.description ? String(b.description).trim() : null;
    const fuel_type = b.fuel_type ? String(b.fuel_type).trim() : null;
    const transmission = b.transmission ? String(b.transmission).trim() : null;
    const body_type = b.body_type ? String(b.body_type).trim() : null;
    const image_urls = Array.isArray(b.image_urls)
      ? (b.image_urls as unknown[]).map((u) => String(u).trim()).filter(Boolean).slice(0, 8)
      : [];

    if (!title || !brand || !model || !Number.isFinite(year) || year < 1990 || year > 2030) {
      res.status(400).json({ error: "validation", message: "Проверьте название, марку, модель и год." });
      return;
    }
    if (!Number.isFinite(price_rub) || price_rub < 1) {
      res.status(400).json({ error: "validation", message: "Укажите цену больше 0." });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ins = await client.query<{ id: string }>(
        `INSERT INTO listings (
           user_id, title, description, brand, model, year, mileage_km, price_rub,
           fuel_type, transmission, body_type, city, status, source
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'published','user')
         RETURNING id`,
        [
          userId,
          title.slice(0, 200),
          description ? description.slice(0, 4000) : null,
          brand.slice(0, 80),
          model.slice(0, 80),
          year,
          mileage_km !== null && Number.isFinite(mileage_km) ? Math.max(0, mileage_km) : null,
          Math.floor(price_rub),
          fuel_type ? fuel_type.slice(0, 40) : null,
          transmission ? transmission.slice(0, 40) : null,
          body_type ? body_type.slice(0, 40) : null,
          city ? city.slice(0, 80) : null,
        ]
      );
      const listingId = ins.rows[0].id;

      let order = 0;
      for (const url of image_urls) {
        if (url.length > 2000) continue;
        await client.query(
          `INSERT INTO listing_images (listing_id, url, sort_order) VALUES ($1,$2,$3)`,
          [listingId, url, order++]
        );
      }

      const plats = await client.query<{ id: number }>(
        "SELECT id FROM platforms WHERE code IN ('avito', 'drom', 'auto_ru') AND is_active = TRUE"
      );
      for (const p of plats.rows) {
        await client.query(
          `INSERT INTO publication_queue (listing_id, platform_id, status, scheduled_at)
           VALUES ($1, $2, 'pending', NOW())
           ON CONFLICT (listing_id, platform_id) DO NOTHING`,
          [listingId, p.id]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ id: listingId, status: "published" });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(e);
      res.status(500).json({ error: "server" });
    } finally {
      client.release();
    }
  });

  app.get("/api/queue/jobs", requireAuth, async (req, res) => {
    const role = req.auth!.role;
    const userId = req.auth!.userId;
    const isStaff = role === "admin" || role === "moderator";

    const { rows } = await pool.query(
      `SELECT pq.id, pq.status, pq.scheduled_at, pq.attempts, pq.last_error,
              p.name AS platform_name, p.code AS platform_code,
              l.id AS listing_id, l.title AS listing_title, l.price_rub
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
