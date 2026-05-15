import catalog from "../data/car_catalog.json";

type CatalogFile = { brands: Record<string, string[]> };

const data = catalog as CatalogFile;

export function searchBrandsLocal(query: string, limit = 50): string[] {
  const names = Object.keys(data.brands ?? {});
  const q = query.trim().toLowerCase();
  const list = q ? names.filter((n) => n.toLowerCase().includes(q)) : names;
  return list.sort((a, b) => a.localeCompare(b, "ru")).slice(0, limit);
}

export function searchModelsLocal(brand: string, query: string, limit = 50): string[] {
  const models = data.brands?.[brand];
  if (!models) return [];
  const q = query.trim().toLowerCase();
  const list = q ? models.filter((m) => m.toLowerCase().includes(q)) : models;
  return list.sort((a, b) => a.localeCompare(b, "ru")).slice(0, limit);
}

export function isValidBrandModel(brand: string, model: string): boolean {
  const models = data.brands?.[brand.trim()];
  if (!models) return false;
  return models.includes(model.trim());
}

export function allBrandsCount(): number {
  return Object.keys(data.brands ?? {}).length;
}

/** Локальный каталог + API, приоритет у car_catalog.json */
export function mergeCatalogNames(local: string[], api: string[], limit: number): string[] {
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
