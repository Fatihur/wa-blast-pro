import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { MessageType, Recipient } from '../types.js';

export interface BlastJob {
  id: string;
  user_id: string;
  message_type: MessageType;
  content: string;
  media_path?: string;
  media_name?: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'scheduled' | 'cancelled';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  current_index: number;
  delay_ms: number;
  scheduled_at?: Date;
  created_at?: Date;
  started_at?: Date;
  completed_at?: Date;
}

export interface BlastRecipient {
  id: string;
  job_id: string;
  phone: string;
  name: string;
  status: 'pending' | 'success' | 'failed';
  message_id?: string;
  error?: string;
  sent_at?: Date;
}

interface BlastJobRow extends RowDataPacket, BlastJob {}
interface BlastRecipientRow extends RowDataPacket, BlastRecipient {}

export const blastRepository = {
  async createJob(job: {
    user_id: string;
    message_type: MessageType;
    content: string;
    media_path?: string;
    media_name?: string;
    recipients: Recipient[];
    delay_ms?: number;
    scheduled_at?: Date;
    poll_data?: any;
    location_data?: any;
  }): Promise<BlastJob> {
    const id = uuidv4();
    const status = job.scheduled_at ? 'scheduled' : 'pending';
    
    await pool.query<ResultSetHeader>(
      `INSERT INTO blast_jobs 
        (id, user_id, message_type, content, media_path, media_name, poll_data, location_data, total_recipients, delay_ms, scheduled_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        job.user_id,
        job.message_type,
        job.content,
        job.media_path || null,
        job.media_name || null,
        job.poll_data ? JSON.stringify(job.poll_data) : null,
        job.location_data ? JSON.stringify(job.location_data) : null,
        job.recipients.length,
        job.delay_ms || 3000,
        job.scheduled_at || null,
        status
      ]
    );

    if (job.recipients.length > 0) {
      const recipientValues = job.recipients.map(r => [
        uuidv4(),
        id,
        r.phone,
        r.name,
        'pending'
      ]);
      await pool.query(
        'INSERT INTO blast_recipients (id, job_id, phone, name, status) VALUES ?',
        [recipientValues]
      );
    }

    return {
      id,
      user_id: job.user_id,
      message_type: job.message_type,
      content: job.content,
      media_path: job.media_path,
      media_name: job.media_name,
      status: status,
      total_recipients: job.recipients.length,
      sent_count: 0,
      failed_count: 0,
      current_index: 0,
      delay_ms: job.delay_ms || 3000,
      scheduled_at: job.scheduled_at
    };
  },

  async findScheduledJobs(userId: string): Promise<BlastJob[]> {
    const [rows] = await pool.query<BlastJobRow[]>(
      `SELECT * FROM blast_jobs 
       WHERE user_id = ? AND scheduled_at IS NOT NULL 
       ORDER BY scheduled_at DESC`,
      [userId]
    );
    return rows;
  },

  async findDueScheduledJobs(): Promise<BlastJob[]> {
    const [rows] = await pool.query<BlastJobRow[]>(
      `SELECT * FROM blast_jobs 
       WHERE status = 'scheduled' AND scheduled_at <= NOW() 
       ORDER BY scheduled_at ASC`
    );
    return rows;
  },

  async findJobById(id: string, userId?: string): Promise<BlastJob | null> {
    let query = 'SELECT * FROM blast_jobs WHERE id = ?';
    const params: any[] = [id];
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    const [rows] = await pool.query<BlastJobRow[]>(query, params);
    return rows.length > 0 ? rows[0] : null;
  },

  async findAllJobs(userId: string, limit: number = 50): Promise<BlastJob[]> {
    const [rows] = await pool.query<BlastJobRow[]>(
      'SELECT * FROM blast_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return rows;
  },

  async findJobsByStatus(userId: string, status: BlastJob['status']): Promise<BlastJob[]> {
    const [rows] = await pool.query<BlastJobRow[]>(
      'SELECT * FROM blast_jobs WHERE user_id = ? AND status = ? ORDER BY created_at DESC',
      [userId, status]
    );
    return rows;
  },

  async updateJobStatus(id: string, status: BlastJob['status']): Promise<boolean> {
    const updates: any = { status };
    
    if (status === 'running') {
      updates.started_at = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date();
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE blast_jobs SET ${setClauses} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  },

  async updateJobProgress(id: string, sent: number, failed: number, current: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE blast_jobs SET sent_count = ?, failed_count = ?, current_index = ? WHERE id = ?',
      [sent, failed, current, id]
    );
    return result.affectedRows > 0;
  },

  async deleteJob(id: string, userId?: string): Promise<boolean> {
    let query = 'DELETE FROM blast_jobs WHERE id = ?';
    const params: any[] = [id];
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    const [result] = await pool.query<ResultSetHeader>(query, params);
    return result.affectedRows > 0;
  },

  async getJobRecipients(jobId: string): Promise<BlastRecipient[]> {
    const [rows] = await pool.query<BlastRecipientRow[]>(
      'SELECT * FROM blast_recipients WHERE job_id = ? ORDER BY id',
      [jobId]
    );
    return rows;
  },

  async getPendingRecipients(jobId: string, offset: number = 0): Promise<BlastRecipient[]> {
    const [rows] = await pool.query<BlastRecipientRow[]>(
      'SELECT * FROM blast_recipients WHERE job_id = ? AND status = ? ORDER BY id LIMIT 1 OFFSET ?',
      [jobId, 'pending', offset]
    );
    return rows;
  },

  async updateRecipientStatus(
    id: string, 
    status: 'success' | 'failed', 
    messageId?: string, 
    error?: string
  ): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE blast_recipients SET status = ?, message_id = ?, error = ?, sent_at = ? WHERE id = ?',
      [status, messageId || null, error || null, new Date(), id]
    );
    return result.affectedRows > 0;
  },

  async getJobStats(jobId: string): Promise<{ total: number; sent: number; failed: number; pending: number }> {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM blast_recipients 
      WHERE job_id = ?
    `, [jobId]);
    
    return {
      total: rows[0].total || 0,
      sent: rows[0].sent || 0,
      failed: rows[0].failed || 0,
      pending: rows[0].pending || 0
    };
  },

  async getDashboardStats(userId: string): Promise<{
    totalSent: number;
    delivered: number;
    pending: number;
    failed: number;
  }> {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        SUM(total_recipients) as totalSent,
        SUM(sent_count) as delivered,
        SUM(CASE WHEN status IN ('pending', 'running', 'paused') THEN total_recipients - sent_count - failed_count ELSE 0 END) as pending,
        SUM(failed_count) as failed
      FROM blast_jobs
      WHERE user_id = ?
    `, [userId]);
    
    return {
      totalSent: rows[0].totalSent || 0,
      delivered: rows[0].delivered || 0,
      pending: rows[0].pending || 0,
      failed: rows[0].failed || 0
    };
  }
};
