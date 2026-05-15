import { pool } from "./db/pool.js";
import { runMigrations } from "./db/runMigrations.js";
import { seedCarCatalogIfNeeded } from "./seedCarCatalog.js";
import { seedTestListingsFromManifest } from "./seedTestListings.js";

async function main() {
  await runMigrations(pool);
  await seedCarCatalogIfNeeded(pool);
  await seedTestListingsFromManifest(pool);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
