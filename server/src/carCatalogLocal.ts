import fs from "node:fs";
import path from "node:path";

type CarDataFile = { brands: Record<string, string[]> };

let brandsCache: Record<string, string[]> | null = null;

function loadBrands(): Record<string, string[]> {
  if (brandsCache) return brandsCache;
  const filePath = path.join(process.cwd(), "data", "car_data.json");
  if (!fs.existsSync(filePath)) {
    brandsCache = {};
    return brandsCache;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as CarDataFile;
  brandsCache = data.brands ?? {};
  return brandsCache;
}

export function isValidBrandModelLocal(brand: string, model: string): boolean {
  const models = loadBrands()[brand.trim()];
  if (!models) return false;
  return models.includes(model.trim());
}
