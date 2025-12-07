import { Router, Request, Response } from 'express';
import { authMiddleware } from './auth.js';
import { pool } from '../config/database.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const router = Router();

router.use(authMiddleware);

interface SettingRow extends RowDataPacket {
  key: string;
  value: string;
  user_id: string;
}

// Get all settings for user
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const [rows] = await pool.query<SettingRow[]>(
      'SELECT `key`, `value` FROM user_settings WHERE user_id = ?',
      [userId]
    );
    
    const settings: Record<string, string> = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific setting
router.get('/:key', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { key } = req.params;
  try {
    const [rows] = await pool.query<SettingRow[]>(
      'SELECT `value` FROM user_settings WHERE user_id = ? AND `key` = ?',
      [userId, key]
    );
    
    if (rows.length === 0) {
      return res.json({ success: true, value: null });
    }
    
    res.json({ success: true, value: rows[0].value });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save setting (upsert)
router.post('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { key, value } = req.body;
  
  if (!key) {
    return res.status(400).json({ success: false, error: 'Key is required' });
  }
  
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO user_settings (user_id, \`key\`, \`value\`) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updated_at = CURRENT_TIMESTAMP`,
      [userId, key, value || '']
    );
    
    res.json({ success: true, message: 'Setting saved' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save multiple settings at once
router.post('/bulk', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { settings } = req.body;
  
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ success: false, error: 'Settings object is required' });
  }
  
  try {
    const entries = Object.entries(settings);
    for (const [key, value] of entries) {
      await pool.query<ResultSetHeader>(
        `INSERT INTO user_settings (user_id, \`key\`, \`value\`) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updated_at = CURRENT_TIMESTAMP`,
        [userId, key, value || '']
      );
    }
    
    res.json({ success: true, message: 'Settings saved' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete setting
router.delete('/:key', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { key } = req.params;
  
  try {
    await pool.query<ResultSetHeader>(
      'DELETE FROM user_settings WHERE user_id = ? AND `key` = ?',
      [userId, key]
    );
    
    res.json({ success: true, message: 'Setting deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
