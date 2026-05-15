ALTER TABLE listings ADD COLUMN IF NOT EXISTS equipment JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_listings_equipment ON listings USING gin (equipment);
