CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platforms (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aggregation_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  feed_url TEXT,
  platform_hint TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aggregated_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID REFERENCES aggregation_feeds (id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  year INT CHECK (year IS NULL OR (year >= 1900 AND year <= 2100)),
  mileage_km INT,
  price_rub BIGINT,
  city TEXT,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  raw_json JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feed_id, external_id)
);

CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  aggregated_listing_id UUID REFERENCES aggregated_listings (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INT NOT NULL CHECK (year >= 1900 AND year <= 2100),
  mileage_km INT CHECK (mileage_km IS NULL OR mileage_km >= 0),
  price_rub BIGINT NOT NULL CHECK (price_rub > 0),
  fuel_type TEXT,
  transmission TEXT,
  body_type TEXT,
  engine_volume_ml INT,
  color TEXT,
  vin TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'published', 'archived', 'moderation')
  ),
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'aggregated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publication_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  platform_id INT NOT NULL REFERENCES platforms (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'published', 'failed', 'cancelled')
  ),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, platform_id)
);

CREATE TABLE IF NOT EXISTS publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  platform_id INT NOT NULL REFERENCES platforms (id) ON DELETE CASCADE,
  external_listing_url TEXT,
  external_listing_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed', 'error')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_user ON listings (user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aggregated_fetched ON aggregated_listings (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_publication_queue_status ON publication_queue (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images (listing_id, sort_order);

INSERT INTO platforms (code, name, base_url)
VALUES
  ('avito', 'Авито', 'https://www.avito.ru'),
  ('auto_ru', 'Авто.ру', 'https://auto.ru'),
  ('drom', 'Дром', 'https://auto.drom.ru'),
  ('youla', 'Юла', 'https://youla.ru')
ON CONFLICT (code) DO NOTHING;
