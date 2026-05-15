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

export function searchBrandsLocal(query: string, limit = 50): string[] {
  const names = Object.keys(loadBrands());
  const q = query.trim().toLowerCase();
  const list = q ? names.filter((n) => n.toLowerCase().includes(q)) : names;
  return list.sort((a, b) => a.localeCompare(b, "ru")).slice(0, limit);
}

export function searchModelsLocal(brand: string, query: string, limit = 50): string[] {
  const models = loadBrands()[brand.trim()];
  if (!models) return [];
  const q = query.trim().toLowerCase();
  const list = q ? models.filter((m) => m.toLowerCase().includes(q)) : models;
  return list.sort((a, b) => a.localeCompare(b, "ru")).slice(0, limit);
}

export function isValidBrandModelLocal(brand: string, model: string): boolean {
  const models = loadBrands()[brand.trim()];
  if (!models) return false;
  return models.includes(model.trim());
}
