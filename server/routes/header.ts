import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { authMiddleware } from './auth.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

router.use(authMiddleware);

// ==================== SEARCH ====================

// Global search across contacts, blast history, templates
router.get('/search', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const query = (req.query.q as string || '').trim();
  const category = req.query.category as string; // optional: contacts, history, templates

  if (!query || query.length < 2) {
    return res.json({ success: true, results: { contacts: [], history: [], templates: [] } });
  }

  try {
    const searchPattern = `%${query}%`;
    const results: { contacts: any[]; history: any[]; templates: any[] } = {
      contacts: [],
      history: [],
      templates: []
    };

    // Search contacts
    if (!category || category === 'contacts') {
      const [contacts] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, phone, tags FROM contacts 
         WHERE user_id = ? AND (name LIKE ? OR phone LIKE ?)
         LIMIT 10`,
        [userId, searchPattern, searchPattern]
      );
      results.contacts = contacts;
    }

    // Search blast history
    if (!category || category === 'history') {
      const [history] = await pool.query<RowDataPacket[]>(
        `SELECT id, content, message_type, status, total_recipients, sent_count, failed_count, created_at
         FROM blast_jobs 
         WHERE user_id = ? AND content LIKE ?
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId, searchPattern]
      );
      results.history = history;
    }

    // Search templates
    if (!category || category === 'templates') {
      const [templates] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, content, message_type FROM message_templates 
         WHERE name LIKE ? OR content LIKE ?
         LIMIT 10`,
        [searchPattern, searchPattern]
      );
      results.templates = templates;
    }

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== NOTIFICATIONS ====================

// Get all notifications
router.get('/notifications', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const [notifications] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );

    const [unreadResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    res.json({
      success: true,
      notifications,
      unreadCount: unreadResult[0]?.count || 0
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create notification (internal use / can be called from other services)
router.post('/notifications', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { type, title, message, data } = req.body;

  try {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, type || 'system', title, message, JSON.stringify(data || {})]
    );

    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = ?`,
      [userId]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete notification
router.delete('/notifications/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  try {
    await pool.query(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [id, userId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all notifications
router.delete('/notifications', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  try {
    await pool.query(`DELETE FROM notifications WHERE user_id = ?`, [userId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== INBOX MESSAGES ====================

// Get inbox messages
router.get('/inbox', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const [messages] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM inbox_messages 
       WHERE user_id = ? 
       ORDER BY received_at DESC 
       LIMIT ?`,
      [userId, limit]
    );

    const [unreadResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM inbox_messages WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    res.json({
      success: true,
      messages,
      unreadCount: unreadResult[0]?.count || 0
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark message as read
router.put('/inbox/:id/read', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE inbox_messages SET is_read = TRUE WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark all inbox as read
router.put('/inbox/read-all', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  try {
    await pool.query(
      `UPDATE inbox_messages SET is_read = TRUE WHERE user_id = ?`,
      [userId]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete inbox message
router.delete('/inbox/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  try {
    await pool.query(`DELETE FROM inbox_messages WHERE id = ? AND user_id = ?`, [id, userId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to create notification (exported for use in other services)
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: any
) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, type, title, message, JSON.stringify(data || {})]
  );
  return id;
}

// Helper function to save inbox message (exported for use in WhatsApp service)
export async function saveInboxMessage(
  userId: string,
  fromPhone: string,
  fromName: string,
  messageType: string,
  content: string,
  mediaUrl?: string
) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO inbox_messages (id, user_id, from_phone, from_name, message_type, content, media_url) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, fromPhone, fromName || fromPhone, messageType, content, mediaUrl]
  );
  return id;
}

export default router;
