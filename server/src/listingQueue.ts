import type { PoolClient } from "pg";

export async function enqueuePublicationQueue(
  client: PoolClient,
  listingId: string
): Promise<void> {
  const plats = await client.query<{ id: number }>(
    "SELECT id FROM platforms WHERE code IN ('avito', 'drom', 'auto_ru') AND is_active = TRUE"
  );
  for (const p of plats.rows) {
    await client.query(
      `INSERT INTO publication_queue (listing_id, platform_id, status, scheduled_at)
       VALUES ($1, $2, 'pending', NOW())
       ON CONFLICT (listing_id, platform_id) DO NOTHING`,
      [listingId, p.id]
    );
  }
}
