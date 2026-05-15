/** Копирует server/data/car_data.json → src/data/car_catalog.json для бандла приложения */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = path.join(root, "server", "data", "car_data.json");
const dest = path.join(root, "src", "data", "car_catalog.json");

const data = JSON.parse(fs.readFileSync(src, "utf8"));
const brands = Object.keys(data.brands ?? {}).length;
fs.writeFileSync(dest, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Synced ${brands} brands → src/data/car_catalog.json`);
