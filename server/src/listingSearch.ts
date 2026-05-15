import type { Pool } from "pg";
import { getUsdPerByn } from "./exchangeRates.js";

export type ListingSearchParams = {
  brand?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  priceFrom?: number;
  priceTo?: number;
  currency?: "byn" | "usd";
  volumeFrom?: number;
  volumeTo?: number;
  transmission?: string;
  bodyType?: string;
  fuelType?: string;
  drivetrain?: string;
  generation?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

const LISTING_SELECT = `SELECT l.id, l.title, l.brand, l.model, l.year, l.mileage_km, l.price_byn, l.city,
  l.fuel_type, l.transmission, l.body_type, l.engine_volume_ml, l.drivetrain, l.created_at,
  COALESCE(
    (SELECT json_agg(url ORDER BY sort_order)
     FROM listing_images li WHERE li.listing_id = l.id),
    '[]'::json
  ) AS images`;

function toBynPrice(amount: number, currency: "byn" | "usd", usdPerByn: number): number {
  if (currency === "usd") return Math.floor(amount / usdPerByn);
  return Math.floor(amount);
}

export async function searchPublishedListings(
  pool: Pool,
  params: ListingSearchParams
): Promise<{ rows: unknown[]; total: number }> {
  const usdPerByn = await getUsdPerByn();
  const currency = params.currency === "usd" ? "usd" : "byn";
  const conditions: string[] = ["l.status = 'published'"];
  const vals: unknown[] = [];
  let i = 1;

  if (params.brand?.trim()) {
    conditions.push(`l.brand = $${i++}`);
    vals.push(params.brand.trim());
  }
  if (params.model?.trim()) {
    conditions.push(`l.model = $${i++}`);
    vals.push(params.model.trim());
  }
  if (params.yearFrom != null && Number.isFinite(params.yearFrom)) {
    conditions.push(`l.year >= $${i++}`);
    vals.push(params.yearFrom);
  }
  if (params.yearTo != null && Number.isFinite(params.yearTo)) {
    conditions.push(`l.year <= $${i++}`);
    vals.push(params.yearTo);
  }
  if (params.priceFrom != null && Number.isFinite(params.priceFrom) && params.priceFrom > 0) {
    conditions.push(`l.price_byn >= $${i++}`);
    vals.push(toBynPrice(params.priceFrom, currency, usdPerByn));
  }
  if (params.priceTo != null && Number.isFinite(params.priceTo) && params.priceTo > 0) {
    conditions.push(`l.price_byn <= $${i++}`);
    vals.push(toBynPrice(params.priceTo, currency, usdPerByn));
  }
  if (params.volumeFrom != null && Number.isFinite(params.volumeFrom)) {
    conditions.push(`l.engine_volume_ml >= $${i++}`);
    vals.push(Math.round(params.volumeFrom * 1000));
  }
  if (params.volumeTo != null && Number.isFinite(params.volumeTo)) {
    conditions.push(`l.engine_volume_ml <= $${i++}`);
    vals.push(Math.round(params.volumeTo * 1000));
  }
  if (params.transmission?.trim()) {
    conditions.push(`l.transmission ILIKE $${i++}`);
    vals.push(params.transmission.trim());
  }
  if (params.bodyType?.trim()) {
    conditions.push(`l.body_type ILIKE $${i++}`);
    vals.push(params.bodyType.trim());
  }
  if (params.fuelType?.trim()) {
    conditions.push(`l.fuel_type ILIKE $${i++}`);
    vals.push(params.fuelType.trim());
  }
  if (params.drivetrain?.trim()) {
    conditions.push(`l.drivetrain ILIKE $${i++}`);
    vals.push(params.drivetrain.trim());
  }
  if (params.generation?.trim()) {
    const pattern = `%${params.generation.trim()}%`;
    conditions.push(`(l.model ILIKE $${i} OR l.title ILIKE $${i})`);
    vals.push(pattern);
    i++;
  }
  if (params.q?.trim()) {
    const pattern = `%${params.q.trim()}%`;
    conditions.push(
      `(l.title ILIKE $${i} OR l.brand ILIKE $${i} OR l.model ILIKE $${i} OR l.city ILIKE $${i})`
    );
    vals.push(pattern);
    i++;
  }

  const where = conditions.join(" AND ");
  const limit = Math.min(params.limit ?? 50, 100);
  const offset = Math.max(params.offset ?? 0, 0);

  const countRes = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM listings l WHERE ${where}`,
    vals
  );
  const total = Number(countRes.rows[0]?.c ?? 0);

  const listVals = [...vals, limit, offset];
  const { rows } = await pool.query(
    `${LISTING_SELECT}
     FROM listings l
     WHERE ${where}
     ORDER BY l.created_at DESC
     LIMIT $${i++} OFFSET $${i}`,
    listVals
  );

  return { rows, total };
}

export function parseListingSearchQuery(q: Record<string, unknown>): ListingSearchParams {
  const num = (k: string) => {
    const v = Number(q[k]);
    return Number.isFinite(v) ? v : undefined;
  };
  return {
    brand: q.brand ? String(q.brand) : undefined,
    model: q.model ? String(q.model) : undefined,
    yearFrom: num("year_from"),
    yearTo: num("year_to"),
    priceFrom: num("price_from"),
    priceTo: num("price_to"),
    currency: q.currency === "usd" ? "usd" : "byn",
    volumeFrom: num("volume_from"),
    volumeTo: num("volume_to"),
    transmission: q.transmission ? String(q.transmission) : undefined,
    bodyType: q.body_type ? String(q.body_type) : undefined,
    fuelType: q.fuel_type ? String(q.fuel_type) : undefined,
    drivetrain: q.drivetrain ? String(q.drivetrain) : undefined,
    generation: q.generation ? String(q.generation) : undefined,
    q: q.q ? String(q.q) : undefined,
    limit: num("limit"),
    offset: num("offset"),
  };
}
