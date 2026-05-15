import type { Express } from "express";
import type { Pool } from "pg";
import { isValidBrandModelLocal, searchBrandsLocal, searchModelsLocal } from "./carCatalogLocal.js";

function mergeNames(local: string[], api: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...local, ...api]) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= limit) break;
  }
  return out;
}

export function registerVehicleRoutes(app: Express, pool: Pool): void {
  app.get("/api/vehicles/brands", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const { rows } = await pool.query<{ id: number; name: string }>(
      q
        ? `SELECT id, name FROM vehicle_brands
           WHERE LOWER(name) LIKE LOWER($1)
           ORDER BY name
           LIMIT $2`
        : `SELECT id, name FROM vehicle_brands ORDER BY name LIMIT $1`,
      q ? [`%${q}%`, limit] : [limit]
    );
    const apiNames = rows.map((r) => r.name);
    const localNames = searchBrandsLocal(q, limit);
    const names = mergeNames(localNames, apiNames, limit);
    res.json(names.map((name, i) => ({ id: i + 1, name })));
  });

  app.get("/api/vehicles/models", async (req, res) => {
    const brand = String(req.query.brand ?? "").trim();
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit) || 50, 80);
    if (!brand) {
      res.status(400).json({ error: "validation", message: "Укажите марку (brand)." });
      return;
    }
    const { rows } = await pool.query<{ id: number; name: string; brand_name: string }>(
      q
        ? `SELECT m.id, m.name, b.name AS brand_name
           FROM vehicle_models m
           JOIN vehicle_brands b ON b.id = m.brand_id
           WHERE b.name = $1 AND LOWER(m.name) LIKE LOWER($2)
           ORDER BY m.name
           LIMIT $3`
        : `SELECT m.id, m.name, b.name AS brand_name
           FROM vehicle_models m
           JOIN vehicle_brands b ON b.id = m.brand_id
           WHERE b.name = $1
           ORDER BY m.name
           LIMIT $2`,
      q ? [brand, `%${q}%`, limit] : [brand, limit]
    );
    const apiNames = rows.map((r) => r.name);
    const localNames = searchModelsLocal(brand, q, limit);
    const names = mergeNames(localNames, apiNames, limit);
    res.json(
      names.map((name, i) => ({ id: i + 1, name, brand_name: brand }))
    );
  });
}

/** null — всё ок; иначе текст ошибки для клиента. */
export async function validateBrandModel(
  pool: Pool,
  brand: string,
  model: string
): Promise<string | null> {
  const b = await pool.query<{ id: number }>(
    "SELECT id FROM vehicle_brands WHERE name = $1",
    [brand]
  );
  if (!b.rows[0]) {
    if (isValidBrandModelLocal(brand, model)) return null;
    return "Выберите марку из списка.";
  }
  const m = await pool.query(
    `SELECT 1 FROM vehicle_models m
     JOIN vehicle_brands b ON b.id = m.brand_id
     WHERE b.name = $1 AND m.name = $2`,
    [brand, model]
  );
  if (!m.rowCount) {
    if (isValidBrandModelLocal(brand, model)) return null;
    return "Выберите модель из списка для выбранной марки.";
  }
  return null;
}
