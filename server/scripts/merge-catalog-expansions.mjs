import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const mainPath = path.join(dataDir, "car_data.json");
const expPath = path.join(dataDir, "catalog_expansions.json");
const clientPath = path.join(__dirname, "..", "..", "src", "data", "car_catalog.json");

function mergeModels(existing, incoming) {
  const out = [...(existing ?? [])];
  const seen = new Set(out.map((m) => m.toLowerCase()));
  for (const m of incoming) {
    const key = m.toLowerCase();
    if (!seen.has(key)) {
      out.push(m);
      seen.add(key);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, "ru"));
}

const main = JSON.parse(fs.readFileSync(mainPath, "utf8"));
const exp = JSON.parse(fs.readFileSync(expPath, "utf8"));

for (const [brand, models] of Object.entries(exp.additions ?? {})) {
  main.brands[brand] = mergeModels(main.brands[brand], models);
}

for (const [brand, models] of Object.entries(exp.newBrands ?? {})) {
  if (main.brands[brand]) {
    main.brands[brand] = mergeModels(main.brands[brand], models);
  } else {
    main.brands[brand] = mergeModels([], models);
  }
}

const sorted = { brands: {} };
for (const key of Object.keys(main.brands).sort((a, b) => a.localeCompare(b, "ru"))) {
  sorted.brands[key] = main.brands[key];
}

const json = `${JSON.stringify(sorted, null, 2)}\n`;
fs.writeFileSync(mainPath, json);
fs.writeFileSync(clientPath, json);

const counts = Object.entries(sorted.brands).map(([k, v]) => [k, v.length]);
console.log("Brands:", counts.length);
console.log("Total models:", counts.reduce((s, [, n]) => s + n, 0));
for (const name of ["BMW", "Audi", "Mercedes-Benz", "Toyota", "Geely", "Chery", "Haval", "Lada", "Hyundai", "Kia"]) {
  console.log(`  ${name}:`, sorted.brands[name]?.length ?? 0);
}
