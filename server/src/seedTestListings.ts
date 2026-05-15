import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Pool, PoolClient } from "pg";
import { equipmentFromBody, sanitizeEquipmentForDb } from "./equipmentOptions.js";
import { normalizeByPlate, validateByPlate, validateByPhone } from "./validation/by.js";
import { TestDataLoader } from "./testData/TestDataLoader.js";
import { ensureUploadsDir } from "./uploadPaths.js";
import { validateBrandModel } from "./vehicleRoutes.js";

const DEMO_PASSWORD = "DemoSeller2026!";

export type TestManifestSeller = {
  email: string;
  full_name: string;
  phone: string;
};

export type TestManifestListing = {
  photoFile: string;
  sellerIndex: number;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage_km: number;
  price_byn: number;
  city: string;
  fuel_type: string;
  transmission: string;
  body_type: string;
  engine_volume_ml: number;
  drivetrain: string;
  color: string;
  vin: string;
  plate_number: string;
  trim_level: string;
  show_phone: boolean;
  equipment: Record<string, string[]>;
  description: string;
};

export type TestManifestV2 = {
  version: number;
  sellers: TestManifestSeller[];
  listings: TestManifestListing[];
};

function readManifestV2(loader: TestDataLoader): TestManifestV2 | null {
  if (!loader.manifestExists()) {
    console.warn("[seed-test] manifest.json не найден:", loader.manifestPath);
    return null;
  }
  const raw = fs.readFileSync(loader.manifestPath, "utf8");
  const doc = JSON.parse(raw) as Partial<TestManifestV2>;
  if (doc.version !== 2 || !Array.isArray(doc.sellers) || !Array.isArray(doc.listings)) {
    console.warn("[seed-test] ожидается manifest version 2 с полями sellers и listings.");
    return null;
  }
  return doc as TestManifestV2;
}

async function ensureSeller(
  client: PoolClient,
  row: TestManifestSeller,
  passwordHash: string
): Promise<string> {
  const phoneErr = validateByPhone(row.phone);
  if (phoneErr) throw new Error(`${row.email}: ${phoneErr}`);

  const ins = await client.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, phone, role)
     VALUES ($1, $2, $3, $4, 'user')
     ON CONFLICT (email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       phone = EXCLUDED.phone,
       password_hash = EXCLUDED.password_hash,
       updated_at = NOW()
     RETURNING id`,
    [row.email.trim().toLowerCase(), passwordHash, row.full_name, row.phone.trim()]
  );
  return ins.rows[0].id;
}

function copyPhotoToUploads(photosDir: string, photoFile: string, uploadsDir: string): string {
  const src = path.join(photosDir, photoFile);
  if (!fs.existsSync(src)) {
    throw new Error(`Фото не найдено: ${src}`);
  }
  const ext = path.extname(photoFile) || ".jpg";
  const destName = `seed-${randomUUID()}${ext}`;
  const dest = path.join(uploadsDir, destName);
  fs.copyFileSync(src, dest);
  return `/uploads/${destName}`;
}

/**
 * Создаёт двух демо-продавцов и объявления из server/test-data/manifest.json (version 2).
 * Идемпотентно: удаляет прежние объявления этих продавцов и создаёт заново.
 */
export async function seedTestListingsFromManifest(pool: Pool): Promise<void> {
  const loader = new TestDataLoader();
  const manifest = readManifestV2(loader);
  if (!manifest || manifest.listings.length === 0) {
    console.info("[seed-test] пропуск: нет данных в manifest.");
    return;
  }

  if (manifest.sellers.length < 2) {
    throw new Error("[seed-test] нужны минимум 2 записи в sellers.");
  }

  const uploadsDir = ensureUploadsDir();
  const photosDir = loader.photosDir;

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userIds: string[] = [];
    for (const s of manifest.sellers.slice(0, 2)) {
      userIds.push(await ensureSeller(client, s, hash));
    }

    const emails = manifest.sellers.slice(0, 2).map((s) => s.email.trim().toLowerCase());
    await client.query(
      `DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))`,
      [emails]
    );

    for (const item of manifest.listings) {
      const sellerIdx = item.sellerIndex === 1 ? 1 : 0;
      const userId = userIds[sellerIdx];
      if (!userId) throw new Error("[seed-test] неверный sellerIndex.");

      const plateErr = validateByPlate(item.plate_number);
      if (plateErr) throw new Error(`${item.title}: ${plateErr}`);

      const catErr = await validateBrandModel(pool, item.brand, item.model);
      if (catErr) throw new Error(`${item.brand} ${item.model}: ${catErr}`);

      const eqBody = equipmentFromBody({
        trim_level: item.trim_level,
        equipment: item.equipment,
      } as Record<string, unknown>);
      const equipmentJson = JSON.stringify(sanitizeEquipmentForDb(eqBody.equipment));

      const ins = await client.query<{ id: string }>(
        `INSERT INTO listings (
           user_id, title, description, brand, model, year, mileage_km, price_byn,
           fuel_type, transmission, body_type, engine_volume_ml, drivetrain, color, vin,
           city, status, source,
           trim_level, interior, interior_details, safety_systems, equipment, show_phone, plate_number
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'published','user',
           $17,$18,$19,$20,$21::jsonb,$22,$23
         )
         RETURNING id`,
        [
          userId,
          item.title.slice(0, 200),
          item.description.slice(0, 4000),
          item.brand.slice(0, 80),
          item.model.slice(0, 80),
          item.year,
          item.mileage_km,
          Math.floor(item.price_byn),
          item.fuel_type,
          item.transmission,
          item.body_type,
          item.engine_volume_ml,
          item.drivetrain,
          item.color,
          item.vin,
          item.city.slice(0, 80),
          item.trim_level.slice(0, 120),
          eqBody.interior,
          eqBody.interior_details,
          eqBody.safety_systems,
          equipmentJson,
          item.show_phone,
          normalizeByPlate(item.plate_number),
        ]
      );

      const listingId = ins.rows[0].id;
      const imageUrl = copyPhotoToUploads(photosDir, item.photoFile, uploadsDir);
      await client.query(
        `INSERT INTO listing_images (listing_id, url, sort_order) VALUES ($1,$2,0)`,
        [listingId, imageUrl]
      );
    }

    await client.query("COMMIT");
    console.info(
      `[seed-test] готово: ${manifest.listings.length} объявлений, продавцы ${emails.join(", ")} (пароль: ${DEMO_PASSWORD})`
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
