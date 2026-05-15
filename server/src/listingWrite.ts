import type { PoolClient } from "pg";
import type { Pool } from "pg";
import {
  equipmentFromBody,
  sanitizeEquipmentForDb,
} from "./equipmentOptions.js";
import { validateBrandModel } from "./vehicleRoutes.js";
import { validateByPlate, normalizeByPlate } from "./validation/by.js";

export type ParsedListingInput = {
  title: string;
  brand: string;
  model: string;
  year: number;
  price_byn: number;
  mileage_km: number | null;
  city: string | null;
  description: string | null;
  fuel_type: string | null;
  transmission: string | null;
  body_type: string | null;
  engine_volume_ml: number | null;
  drivetrain: string | null;
  color: string | null;
  vin: string | null;
  trim_level: string | null;
  interior: string | null;
  interior_details: string | null;
  safety_systems: string | null;
  equipment: Record<string, string[]>;
  show_phone: boolean;
  plate_number: string | null;
  image_urls: string[];
};

function parsePriceByn(b: Record<string, unknown>): number {
  if (b.price_byn !== undefined) return Number(b.price_byn);
  if (b.price_rub !== undefined) return Number(b.price_rub);
  return Number.NaN;
}

function parseEngineVolumeMl(b: Record<string, unknown>): number | null {
  if (b.engine_volume_ml !== undefined && b.engine_volume_ml !== "") {
    const ml = Number(b.engine_volume_ml);
    if (Number.isFinite(ml) && ml > 0) return Math.min(Math.round(ml), 20000);
  }
  if (b.engine_volume_l !== undefined && b.engine_volume_l !== "") {
    const liters = Number(String(b.engine_volume_l).replace(",", "."));
    if (Number.isFinite(liters) && liters > 0 && liters < 20) {
      return Math.min(Math.round(liters * 1000), 20000);
    }
  }
  return null;
}

export function parseListingBody(
  b: Record<string, unknown>
): { ok: true; data: ParsedListingInput } | { ok: false; message: string } {
  const title = String(b.title ?? "").trim();
  const brand = String(b.brand ?? "").trim();
  const model = String(b.model ?? "").trim();
  const year = Number(b.year);
  const price_byn = parsePriceByn(b);
  const mileage_km =
    b.mileage_km === undefined || b.mileage_km === ""
      ? null
      : Number(b.mileage_km);
  const city = b.city ? String(b.city).trim() : null;
  const description = b.description ? String(b.description).trim() : null;
  const fuel_type = b.fuel_type ? String(b.fuel_type).trim() : null;
  const transmission = b.transmission ? String(b.transmission).trim() : null;
  const body_type = b.body_type ? String(b.body_type).trim() : null;
  const engine_volume_ml = parseEngineVolumeMl(b);
  const drivetrain = b.drivetrain ? String(b.drivetrain).trim().slice(0, 40) : null;
  const color = b.color ? String(b.color).trim().slice(0, 60) : null;
  const vinRaw = b.vin ? String(b.vin).trim().toUpperCase().replace(/\s/g, "") : null;
  const vin = vinRaw && vinRaw.length >= 11 && vinRaw.length <= 17 ? vinRaw : null;
  const eqParsed = equipmentFromBody(b);
  const show_phone = b.show_phone !== false && b.show_phone !== "false";
  const plateRaw = b.plate_number ? String(b.plate_number).trim() : null;
  const image_urls = Array.isArray(b.image_urls)
    ? (b.image_urls as unknown[]).map((u) => String(u).trim()).filter(Boolean).slice(0, 8)
    : [];

  if (!title || !brand || !model || !Number.isFinite(year) || year < 1990 || year > 2030) {
    return { ok: false, message: "Проверьте название, марку, модель и год." };
  }
  if (!Number.isFinite(price_byn) || price_byn < 1) {
    return { ok: false, message: "Укажите цену в BYN больше 0." };
  }

  const plateErr = validateByPlate(plateRaw);
  if (plateErr) {
    return { ok: false, message: plateErr };
  }

  return {
    ok: true,
    data: {
      title,
      brand,
      model,
      year,
      price_byn,
      mileage_km:
        mileage_km !== null && Number.isFinite(mileage_km) ? Math.max(0, mileage_km) : null,
      city,
      description,
      fuel_type,
      transmission,
      body_type,
      engine_volume_ml,
      drivetrain,
      color,
      vin,
      trim_level: eqParsed.trim_level,
      interior: eqParsed.interior,
      interior_details: eqParsed.interior_details,
      safety_systems: eqParsed.safety_systems,
      equipment: sanitizeEquipmentForDb(eqParsed.equipment),
      show_phone,
      plate_number: plateRaw ? normalizeByPlate(plateRaw) : null,
      image_urls,
    },
  };
}

export async function replaceListingImages(
  client: PoolClient,
  listingId: string,
  image_urls: string[]
): Promise<void> {
  await client.query(`DELETE FROM listing_images WHERE listing_id = $1`, [listingId]);
  let order = 0;
  for (const url of image_urls) {
    if (url.length > 2000) continue;
    await client.query(
      `INSERT INTO listing_images (listing_id, url, sort_order) VALUES ($1,$2,$3)`,
      [listingId, url, order++]
    );
  }
}

export async function validateListingCatalog(
  pool: Pool,
  brand: string,
  model: string
): Promise<string | null> {
  return validateBrandModel(pool, brand, model);
}

export function statusAfterOwnerEdit(currentStatus: string, isStaff: boolean): string {
  if (isStaff) return currentStatus;
  return "moderation";
}
