import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  remember_token: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PasswordReset {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export const authRepository = {
  async findUserByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows.length > 0 ? (rows[0] as User) : null;
  },

  async findUserById(id: string): Promise<User | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as User) : null;
  },

  async findUserByRememberToken(token: string): Promise<User | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE remember_token = ?',
      [token]
    );
    return rows.length > 0 ? (rows[0] as User) : null;
  },

  async createUser(name: string, email: string, hashedPassword: string): Promise<User> {
    const id = uuidv4();
    await pool.query<ResultSetHeader>(
      'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
      [id, name, email, hashedPassword]
    );
    return (await this.findUserById(id))!;
  },

  async updateRememberToken(userId: string, token: string | null): Promise<void> {
    await pool.query<ResultSetHeader>(
      'UPDATE users SET remember_token = ? WHERE id = ?',
      [token, userId]
    );
  },

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await pool.query<ResultSetHeader>(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
  },

  async updateUser(userId: string, data: { name?: string }): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name) {
      updates.push('name = ?');
      values.push(data.name);
    }

    if (updates.length > 0) {
      values.push(userId);
      await pool.query<ResultSetHeader>(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }
  },

  async createPasswordReset(userId: string, token: string, expiresAt: Date): Promise<PasswordReset> {
    const id = uuidv4();
    await pool.query<ResultSetHeader>(
      'INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [id, userId, token, expiresAt]
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM password_resets WHERE id = ?',
      [id]
    );
    return rows[0] as PasswordReset;
  },

  async findValidPasswordReset(token: string): Promise<PasswordReset | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW() AND used_at IS NULL',
      [token]
    );
    return rows.length > 0 ? (rows[0] as PasswordReset) : null;
  },

  async markPasswordResetUsed(id: string): Promise<void> {
    await pool.query<ResultSetHeader>(
      'UPDATE password_resets SET used_at = NOW() WHERE id = ?',
      [id]
    );
  },

  async deleteExpiredPasswordResets(): Promise<void> {
    await pool.query<ResultSetHeader>(
      'DELETE FROM password_resets WHERE expires_at < NOW() OR used_at IS NOT NULL'
    );
  }
};
