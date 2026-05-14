import bcrypt from "bcryptjs";
import { pool } from "./db/pool.js";

export async function seedDemoIfNeeded(): Promise<void> {
  if (process.env.AUTO_SEED_DEMO !== "1") return;

  const count = await pool.query<{ c: string }>(
    "SELECT COUNT(*)::text AS c FROM listings"
  );
  if (Number(count.rows[0].c) > 0) return;

  const hash = await bcrypt.hash("demo123", 10);
  const email = "demo@autofinder.local";

  let userId: string;
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );
  if (existing.rows[0]) {
    userId = existing.rows[0].id;
  } else {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, phone, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING id`,
      [email, hash, "Демо дилер", "+79990000000"]
    );
    userId = ins.rows[0].id;
  }

  const l1 = await pool.query<{ id: string }>(
    `INSERT INTO listings (
       user_id, title, description, brand, model, year, mileage_km, price_rub,
       fuel_type, transmission, body_type, city, status, source
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'published', 'user'
     ) RETURNING id`,
    [
      userId,
      "Mercedes-Benz E 220 d, AMG-line",
      "Полная история ТО, не бит не крашен. Гарантия юр. чистоты.",
      "Mercedes-Benz",
      "E-Класс",
      2022,
      28000,
      4550000,
      "Дизель",
      "Автомат",
      "Седан",
      "Москва",
    ]
  );

  const l2 = await pool.query<{ id: string }>(
    `INSERT INTO listings (
       user_id, title, description, brand, model, year, mileage_km, price_rub,
       fuel_type, transmission, body_type, city, status, source
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'published', 'user'
     ) RETURNING id`,
    [
      userId,
      "Volvo XC60 B5 AWD Inscription",
      "Панорама, Bowers & Wilkins, адаптивный круиз.",
      "Volvo",
      "XC60",
      2021,
      52000,
      3850000,
      "Бензин",
      "Автомат",
      "Кроссовер",
      "Санкт-Петербург",
    ]
  );

  const imgs: { listingId: string; urls: string[] }[] = [
    {
      listingId: l1.rows[0].id,
      urls: [
        "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80",
        "https://images.unsplash.com/photo-1617531653520-bd9098b87717?w=800&q=80",
      ],
    },
    {
      listingId: l2.rows[0].id,
      urls: [
        "https://images.unsplash.com/photo-1606664515524-ed2f786e0bd6?w=800&q=80",
      ],
    },
  ];

  for (const block of imgs) {
    let order = 0;
    for (const url of block.urls) {
      await pool.query(
        `INSERT INTO listing_images (listing_id, url, sort_order) VALUES ($1, $2, $3)`,
        [block.listingId, url, order++]
      );
    }
  }

  const avito = await pool.query<{ id: number }>(
    "SELECT id FROM platforms WHERE code = 'avito' LIMIT 1"
  );
  const drom = await pool.query<{ id: number }>(
    "SELECT id FROM platforms WHERE code = 'drom' LIMIT 1"
  );
  const avitoId = avito.rows[0]?.id;
  const dromId = drom.rows[0]?.id;

  if (avitoId) {
    await pool.query(
      `INSERT INTO publication_queue (listing_id, platform_id, status, scheduled_at)
       VALUES ($1, $2, 'pending', NOW()) ON CONFLICT (listing_id, platform_id) DO NOTHING`,
      [l1.rows[0].id, avitoId]
    );
  }
  if (dromId) {
    await pool.query(
      `INSERT INTO publication_queue (listing_id, platform_id, status, scheduled_at)
       VALUES ($1, $2, 'pending', NOW()) ON CONFLICT (listing_id, platform_id) DO NOTHING`,
      [l2.rows[0].id, dromId]
    );
  }

  console.info("[seed] demo listings and queue rows created");
}
