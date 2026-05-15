/**
 * Перезалить каталог из data/car_data.json в PostgreSQL.
 * Usage: cd server && CATALOG_FORCE_RESEED=1 npm run resync:catalog
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(serverDir);
dotenv.config({ path: path.join(serverDir, ".env") });
process.env.CATALOG_FORCE_RESEED = "1";

const { pool } = await import("../src/db/pool.js");
const { syncCarCatalogFromFile } = await import("../src/seedCarCatalog.js");

await syncCarCatalogFromFile(pool, { force: true });
await pool.end();
console.log("Done.");
