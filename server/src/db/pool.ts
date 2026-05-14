import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

function poolConfig(): ConstructorParameters<typeof Pool>[0] {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    return { connectionString: url };
  }
  return {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? "postgres",
    password: process.env.PGPASSWORD ?? "",
    database: process.env.PGDATABASE ?? "autofinder",
  };
}

export const pool = new Pool(poolConfig());
