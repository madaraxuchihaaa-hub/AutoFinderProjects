CREATE TABLE IF NOT EXISTS vehicle_brands (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id SERIAL PRIMARY KEY,
  brand_id INT NOT NULL REFERENCES vehicle_brands (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, name)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_brand_id ON vehicle_models (brand_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_brands_name_lower ON vehicle_brands (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_vehicle_models_name_lower ON vehicle_models (LOWER(name));
