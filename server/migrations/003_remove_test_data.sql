-- Удаление тестовых пользователей, их объявлений и демо-агрегатов (для уже существующих БД).

UPDATE listings
SET aggregated_listing_id = NULL
WHERE aggregated_listing_id IN (
  SELECT id FROM aggregated_listings
  WHERE feed_id = '11111111-1111-1111-1111-111111111111'::uuid
     OR external_id IN ('demo-ext-1', 'demo-ext-2', 'demo-ext-3')
);

DELETE FROM publication_queue
WHERE listing_id IN (
  SELECT l.id
  FROM listings l
  JOIN users u ON u.id = l.user_id
  WHERE u.email IN (
    'demo@autofinder.local',
    'moderator@autofinder.local',
    'admin@autofinder.local'
  )
);

DELETE FROM listing_images
WHERE listing_id IN (
  SELECT l.id
  FROM listings l
  JOIN users u ON u.id = l.user_id
  WHERE u.email IN (
    'demo@autofinder.local',
    'moderator@autofinder.local',
    'admin@autofinder.local'
  )
);

DELETE FROM publications
WHERE listing_id IN (
  SELECT l.id
  FROM listings l
  JOIN users u ON u.id = l.user_id
  WHERE u.email IN (
    'demo@autofinder.local',
    'moderator@autofinder.local',
    'admin@autofinder.local'
  )
);

DELETE FROM listings
WHERE user_id IN (
  SELECT id FROM users
  WHERE email IN (
    'demo@autofinder.local',
    'moderator@autofinder.local',
    'admin@autofinder.local'
  )
);

DELETE FROM users
WHERE email IN (
  'demo@autofinder.local',
  'moderator@autofinder.local',
  'admin@autofinder.local'
);

DELETE FROM aggregated_listings
WHERE feed_id = '11111111-1111-1111-1111-111111111111'::uuid
   OR external_id IN ('demo-ext-1', 'demo-ext-2', 'demo-ext-3');

DELETE FROM aggregation_feeds
WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;
