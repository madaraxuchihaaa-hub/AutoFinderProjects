-- Удаление демо-данных из 001_init и тестовых учёток из 002_roles_auth.
DELETE FROM publications
WHERE listing_id IN (
  SELECT id FROM listings
  WHERE user_id IN (
    SELECT id FROM users
    WHERE email IN (
      'demo@autofinder.local',
      'moderator@autofinder.local',
      'admin@autofinder.local'
    )
  )
);

DELETE FROM publication_queue
WHERE listing_id IN (
  SELECT id FROM listings
  WHERE user_id IN (
    SELECT id FROM users
    WHERE email IN (
      'demo@autofinder.local',
      'moderator@autofinder.local',
      'admin@autofinder.local'
    )
  )
);

DELETE FROM listing_images
WHERE listing_id IN (
  SELECT id FROM listings
  WHERE user_id IN (
    SELECT id FROM users
    WHERE email IN (
      'demo@autofinder.local',
      'moderator@autofinder.local',
      'admin@autofinder.local'
    )
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
WHERE external_id LIKE 'demo-ext-%'
   OR raw_json @> '{"demo": true}'::jsonb;

DELETE FROM aggregation_feeds
WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;
