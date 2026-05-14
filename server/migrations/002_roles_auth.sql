ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'moderator', 'user'));

UPDATE users SET role = 'user' WHERE email = 'demo@autofinder.local' AND (role IS NULL OR role = 'user');

INSERT INTO users (email, password_hash, full_name, phone, role)
VALUES (
  'moderator@autofinder.local',
  '$2a$10$bEuJYYWGKNgQpRuPsGXvfuB5kTNTWkvXssOOeiLa878hZjc60cSIe',
  'Системный модератор',
  NULL,
  'moderator'
)
ON CONFLICT (email) DO UPDATE SET
  role = 'moderator',
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  updated_at = NOW();

INSERT INTO users (email, password_hash, full_name, phone, role)
VALUES (
  'admin@autofinder.local',
  '$2a$10$SMAXhSyx06WWcQg6dhKdRuWjXF.5zQ.SCy/mxjcifMOjPSb1m3vNu',
  'Администратор',
  NULL,
  'admin'
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  updated_at = NOW();
