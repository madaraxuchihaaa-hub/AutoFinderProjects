import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

let loaded = false;

/** Загружает `server/.env` по пути к пакету (не зависит от cwd). Если файла нет — стандартный dotenv. */
export function loadServerEnv(): void {
  if (loaded) return;
  loaded = true;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const serverRoot = path.join(here, "..");
  const envPath = path.join(serverRoot, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }
}
