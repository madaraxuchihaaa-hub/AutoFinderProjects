import fs from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

type CarDataFile = { brands: Record<string, string[]> };

/** Загрузить каталог из data/car_data.json в PostgreSQL. */
export async function syncCarCatalogFromFile(
  pool: Pool,
  options?: { force?: boolean }
): Promise<void> {
  const force = options?.force === true || process.env.CATALOG_FORCE_RESEED === "1";

  if (!force) {
    const { rows } = await pool.query<{ c: string }>(
      "SELECT COUNT(*)::text AS c FROM vehicle_brands"
    );
    if (Number(rows[0].c) > 0) return;
  } else {
    await pool.query("TRUNCATE vehicle_models, vehicle_brands RESTART IDENTITY CASCADE");
    console.info("[seed] vehicle catalog: force reseed from car_data.json");
  }

  const filePath = path.join(process.cwd(), "data", "car_data.json");
  if (!fs.existsSync(filePath)) {
    console.warn("[seed] car_data.json not found at", filePath);
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as CarDataFile;
  const brands = data.brands ?? {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let brandCount = 0;
    let modelCount = 0;
    for (const [brandName, models] of Object.entries(brands)) {
      const b = brandName.trim();
      if (!b) continue;
      const ins = await client.query<{ id: number }>(
        `INSERT INTO vehicle_brands (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [b]
      );
      const brandId = ins.rows[0].id;
      brandCount++;
      for (const modelName of models) {
        const m = modelName.trim();
        if (!m) continue;
        await client.query(
          `INSERT INTO vehicle_models (brand_id, name) VALUES ($1, $2)
           ON CONFLICT (brand_id, name) DO NOTHING`,
          [brandId, m]
        );
        modelCount++;
      }
    }
    await client.query("COMMIT");
    console.info(`[seed] vehicle catalog: ${brandCount} brands, ${modelCount} models`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function seedCarCatalogIfNeeded(pool: Pool): Promise<void> {
  await syncCarCatalogFromFile(pool, { force: false });
}
