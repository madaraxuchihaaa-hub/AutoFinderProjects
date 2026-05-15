import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";

export function registerChatRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler
): void {
  app.get("/api/conversations", requireAuth, async (req, res) => {
    const userId = req.auth!.userId;
    const { rows } = await pool.query(
      `SELECT c.id, c.listing_id, c.buyer_id, c.seller_id, c.updated_at,
              l.title AS listing_title,
              l.brand AS listing_brand,
              l.model AS listing_model,
              CASE WHEN c.buyer_id = $1 THEN seller.email ELSE buyer.email END AS peer_email,
              CASE WHEN c.buyer_id = $1 THEN seller.full_name ELSE buyer.full_name END AS peer_name,
              lm.body AS last_message,
              lm.created_at AS last_message_at,
              lm.sender_id AS last_sender_id
       FROM conversations c
       JOIN listings l ON l.id = c.listing_id
       JOIN users buyer ON buyer.id = c.buyer_id
       JOIN users seller ON seller.id = c.seller_id
       LEFT JOIN LATERAL (
         SELECT body, created_at, sender_id
         FROM messages m
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC
         LIMIT 1
       ) lm ON TRUE
       WHERE c.buyer_id = $1 OR c.seller_id = $1
       ORDER BY c.updated_at DESC
       LIMIT 100`,
      [userId]
    );
    res.json(rows);
  });

  app.post("/api/conversations", requireAuth, async (req, res) => {
    const buyerId = req.auth!.userId;
    const listingId = String(req.body?.listing_id ?? "").trim();
    if (!listingId) {
      res.status(400).json({ error: "validation", message: "Укажите listing_id." });
      return;
    }

    const listing = await pool.query<{ user_id: string; status: string }>(
      "SELECT user_id, status FROM listings WHERE id = $1",
      [listingId]
    );
    const row = listing.rows[0];
    if (!row || row.status !== "published") {
      res.status(404).json({ error: "not_found", message: "Объявление не найдено или не опубликовано." });
      return;
    }
    if (row.user_id === buyerId) {
      res.status(400).json({ error: "validation", message: "Нельзя написать самому себе." });
      return;
    }

    const ins = await pool.query(
      `INSERT INTO conversations (listing_id, buyer_id, seller_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (listing_id, buyer_id) DO UPDATE SET updated_at = NOW()
       RETURNING id, listing_id, buyer_id, seller_id, created_at, updated_at`,
      [listingId, buyerId, row.user_id]
    );
    res.status(201).json(ins.rows[0]);
  });

  app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    const userId = req.auth!.userId;
    const convId = req.params.id;

    const conv = await pool.query(
      "SELECT id FROM conversations WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)",
      [convId, userId]
    );
    if (!conv.rows[0]) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at,
              u.email AS sender_email, u.full_name AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT 500`,
      [convId]
    );
    res.json(rows);
  });

  app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    const userId = req.auth!.userId;
    const convId = req.params.id;
    const body = String(req.body?.body ?? "").trim();
    if (!body || body.length > 4000) {
      res.status(400).json({ error: "validation", message: "Сообщение от 1 до 4000 символов." });
      return;
    }

    const conv = await pool.query(
      "SELECT id FROM conversations WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)",
      [convId, userId]
    );
    if (!conv.rows[0]) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const ins = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, sender_id, body, created_at`,
      [convId, userId, body]
    );
    await pool.query("UPDATE conversations SET updated_at = NOW() WHERE id = $1", [convId]);
    res.status(201).json(ins.rows[0]);
  });
}
