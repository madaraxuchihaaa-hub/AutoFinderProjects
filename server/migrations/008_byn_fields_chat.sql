-- Цены в BYN
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'price_rub'
  ) THEN
    ALTER TABLE listings RENAME COLUMN price_rub TO price_byn;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aggregated_listings' AND column_name = 'price_rub'
  ) THEN
    ALTER TABLE aggregated_listings RENAME COLUMN price_rub TO price_byn;
  END IF;
END $$;

ALTER TABLE listings ADD COLUMN IF NOT EXISTS trim_level TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS interior TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS interior_details TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS safety_systems TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS plate_number TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS plate_number TEXT;

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations (buyer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON conversations (seller_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at ASC);
