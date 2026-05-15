-- Системные учётки персонала (всегда присутствуют после миграций).
-- Модератор: moderator@autofinder.local / ModPass2026
-- Администратор: admin@autofinder.local / AdminPass2026
-- ON CONFLICT обновляет роль и пароль при повторном деплое.

INSERT INTO users (email, password_hash, full_name, phone, role)
VALUES (
  'moderator@autofinder.local',
  '$2a$10$xs6FW9iWWu1xWJ4uySVJy.fI1COtuu6kbW/vc39m9Y1L6SuthTfvm',
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
  '$2a$10$zBf27YZL4vgRVwstAJntH.t.wTFdoYsC1E45sOMxDFHdM7t3Ua.Ku',
  'Администратор',
  NULL,
  'admin'
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  updated_at = NOW();
