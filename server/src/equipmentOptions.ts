import fs from "node:fs";
import path from "node:path";

export type EquipmentCategory = {
  id: string;
  label: string;
  multiple: boolean;
  options: string[];
};

export type EquipmentCatalog = {
  trim_levels: string[];
  categories: EquipmentCategory[];
};

export type EquipmentMap = Record<string, string[]>;

let catalogCache: EquipmentCatalog | null = null;

export function getEquipmentCatalog(): EquipmentCatalog {
  if (catalogCache) return catalogCache;
  const file = path.join(process.cwd(), "data", "listing_equipment_options.json");
  const raw = fs.readFileSync(file, "utf8");
  catalogCache = JSON.parse(raw) as EquipmentCatalog;
  return catalogCache;
}

function splitTokens(value: unknown): string[] {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.map((x) => String(x).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[,;•\n|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function optionIndex(catalog: EquipmentCatalog): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of catalog.categories) {
    for (const opt of cat.options) {
      map.set(opt.toLowerCase(), cat.id);
    }
  }
  return map;
}

/** Раскладывает произвольные строки по категориям каталога. */
export function tokensToEquipment(
  tokens: string[],
  catalog = getEquipmentCatalog()
): EquipmentMap {
  const idx = optionIndex(catalog);
  const out: EquipmentMap = {};
  for (const raw of tokens) {
    const catId = idx.get(raw.toLowerCase());
    if (!catId) continue;
    if (!out[catId]) out[catId] = [];
    if (!out[catId].includes(raw)) out[catId].push(raw);
  }
  return out;
}

export function parseEquipmentField(raw: unknown): EquipmentMap {
  if (raw == null || raw === "") return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return normalizeEquipmentMap(parsed as Record<string, unknown>);
      }
    } catch {
      return tokensToEquipment(splitTokens(raw));
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return normalizeEquipmentMap(raw as Record<string, unknown>);
  }
  return {};
}

function normalizeEquipmentMap(obj: Record<string, unknown>): EquipmentMap {
  const out: EquipmentMap = {};
  for (const [key, val] of Object.entries(obj)) {
    const list = splitTokens(val);
    if (list.length) out[key] = list;
  }
  return out;
}

/** Объединяет JSON equipment и старые текстовые поля. */
export function resolveListingEquipment(row: {
  equipment?: unknown;
  trim_level?: string | null;
  interior?: string | null;
  interior_details?: string | null;
  safety_systems?: string | null;
}): { trim_level: string | null; equipment: EquipmentMap; sections: { id: string; label: string; values: string[] }[] } {
  const catalog = getEquipmentCatalog();
  const equipment: EquipmentMap = { ...parseEquipmentField(row.equipment) };

  const interiorTokens = splitTokens(row.interior);
  for (const t of interiorTokens) {
    if (!equipment.interior) equipment.interior = [];
    if (!equipment.interior.includes(t)) equipment.interior.push(t);
  }

  const safetyTokens = splitTokens(row.safety_systems);
  for (const t of safetyTokens) {
    if (!equipment.safety) equipment.safety = [];
    if (!equipment.safety.includes(t)) equipment.safety.push(t);
  }

  const miscTokens = splitTokens(row.interior_details);
  const miscAssigned = tokensToEquipment(miscTokens, catalog);
  for (const [catId, vals] of Object.entries(miscAssigned)) {
    if (!equipment[catId]) equipment[catId] = [];
    for (const v of vals) {
      if (!equipment[catId].includes(v)) equipment[catId].push(v);
    }
  }

  const sections: { id: string; label: string; values: string[] }[] = [];
  const trim = row.trim_level?.trim() || null;
  if (trim) {
    sections.push({ id: "trim", label: "Комплектация", values: [trim] });
  }
  for (const cat of catalog.categories) {
    const values = equipment[cat.id];
    if (values?.length) {
      sections.push({ id: cat.id, label: cat.label, values });
    }
  }

  return { trim_level: trim, equipment, sections };
}

export function equipmentFromBody(
  body: Record<string, unknown>,
  catalog = getEquipmentCatalog()
): { trim_level: string | null; equipment: EquipmentMap; interior: string | null; interior_details: string | null; safety_systems: string | null } {
  let trim_level = body.trim_level ? String(body.trim_level).trim() : null;
  const equipment: EquipmentMap =
    body.equipment && typeof body.equipment === "object" && !Array.isArray(body.equipment)
      ? normalizeEquipmentMap(body.equipment as Record<string, unknown>)
      : {};

  if (!trim_level && Array.isArray(equipment.trim) && equipment.trim[0]) {
    trim_level = equipment.trim[0];
  }
  delete equipment.trim;

  for (const cat of catalog.categories) {
    const fromBody = body[`equipment_${cat.id}`];
    if (fromBody !== undefined) {
      equipment[cat.id] = splitTokens(fromBody);
    }
  }

  const interior = equipment.interior?.length ? equipment.interior.join(", ") : null;
  const safety_systems = equipment.safety?.length ? equipment.safety.join(", ") : null;
  const otherCats = ["assistance", "exterior", "optics", "climate", "multimedia", "comfort"] as const;
  const interior_details = otherCats
    .flatMap((id) => equipment[id] ?? [])
    .join(", ") || null;

  return { trim_level, equipment, interior, interior_details, safety_systems };
}

export function sanitizeEquipmentForDb(
  equipment: EquipmentMap,
  catalog = getEquipmentCatalog()
): EquipmentMap {
  const allowed = new Set(catalog.categories.map((c) => c.id));
  const out: EquipmentMap = {};
  for (const [key, vals] of Object.entries(equipment)) {
    if (!allowed.has(key)) continue;
    const cat = catalog.categories.find((c) => c.id === key);
    if (!cat) continue;
    const allowedOpts = new Set(cat.options.map((o) => o.toLowerCase()));
    const clean = vals.filter((v) => allowedOpts.has(v.toLowerCase()));
    if (clean.length) out[key] = clean;
  }
  return out;
}
