import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  tags: string[];
  created_at?: Date;
  updated_at?: Date;
}

export interface ContactRow extends RowDataPacket {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  tags: string;
  created_at: Date;
  updated_at: Date;
}

function parseTags(tagsValue: any): string[] {
  if (!tagsValue) return [];
  if (Array.isArray(tagsValue)) return tagsValue;
  if (typeof tagsValue !== 'string') return [];
  if (tagsValue === '') return [];
  
  try {
    const parsed = JSON.parse(tagsValue);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return tagsValue.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }
}

export const contactRepository = {
  async findAll(userId: string): Promise<Contact[]> {
    const [rows] = await pool.query<ContactRow[]>(
      'SELECT * FROM contacts WHERE user_id = ? ORDER BY name ASC',
      [userId]
    );
    return rows.map(row => ({
      ...row,
      tags: parseTags(row.tags)
    }));
  },

  async findPaginated(
    userId: string, 
    page: number = 1, 
    limit: number = 20, 
    search?: string
  ): Promise<{ contacts: Contact[]; total: number; page: number; limit: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    
    let countQuery = 'SELECT COUNT(*) as total FROM contacts WHERE user_id = ?';
    let dataQuery = 'SELECT * FROM contacts WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      countQuery += ' AND (name LIKE ? OR phone LIKE ?)';
      dataQuery += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(searchPattern, searchPattern);
    }
    
    dataQuery += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    
    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;
    
    const [rows] = await pool.query<ContactRow[]>(dataQuery, [...params, limit, offset]);
    
    const contacts = rows.map(row => ({
      ...row,
      tags: parseTags(row.tags)
    }));

    return {
      contacts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  async findById(id: string, userId: string): Promise<Contact | null> {
    const [rows] = await pool.query<ContactRow[]>(
      'SELECT * FROM contacts WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (rows.length === 0) return null;
    return {
      ...rows[0],
      tags: parseTags(rows[0].tags)
    };
  },

  async findByPhone(phone: string, userId: string): Promise<Contact | null> {
    const cleanPhone = phone.replace(/\D/g, '');
    const [rows] = await pool.query<ContactRow[]>(
      'SELECT * FROM contacts WHERE user_id = ? AND REPLACE(phone, "+", "") LIKE ?',
      [userId, `%${cleanPhone}%`]
    );
    if (rows.length === 0) return null;
    return {
      ...rows[0],
      tags: parseTags(rows[0].tags)
    };
  },

  async search(term: string, userId: string): Promise<Contact[]> {
    const [rows] = await pool.query<ContactRow[]>(
      'SELECT * FROM contacts WHERE user_id = ? AND (name LIKE ? OR phone LIKE ?) ORDER BY name ASC',
      [userId, `%${term}%`, `%${term}%`]
    );
    return rows.map(row => ({
      ...row,
      tags: parseTags(row.tags)
    }));
  },

  async create(userId: string, contact: Omit<Contact, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Contact> {
    const id = uuidv4();
    await pool.query<ResultSetHeader>(
      'INSERT INTO contacts (id, user_id, name, phone, tags) VALUES (?, ?, ?, ?, ?)',
      [id, userId, contact.name, contact.phone, JSON.stringify(contact.tags || [])]
    );
    return { id, user_id: userId, ...contact, tags: contact.tags || [] };
  },

  async createMany(userId: string, contacts: Omit<Contact, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]): Promise<number> {
    if (contacts.length === 0) return 0;
    
    const values = contacts.map(c => [
      uuidv4(),
      userId,
      c.name,
      c.phone,
      JSON.stringify(c.tags || [])
    ]);

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO contacts (id, user_id, name, phone, tags) VALUES ?',
      [values]
    );
    
    return result.affectedRows;
  },

  async update(id: string, userId: string, contact: Partial<Contact>): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    if (contact.name !== undefined) {
      updates.push('name = ?');
      values.push(contact.name);
    }
    if (contact.phone !== undefined) {
      updates.push('phone = ?');
      values.push(contact.phone);
    }
    if (contact.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(contact.tags));
    }

    if (updates.length === 0) return false;

    values.push(id, userId);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE contacts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    
    return result.affectedRows > 0;
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM contacts WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  },

  async deleteMany(ids: string[], userId: string): Promise<number> {
    if (ids.length === 0) return 0;
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM contacts WHERE id IN (?) AND user_id = ?',
      [ids, userId]
    );
    return result.affectedRows;
  },

  async count(userId: string): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM contacts WHERE user_id = ?',
      [userId]
    );
    return rows[0].count;
  },

  async addTag(id: string, userId: string, tag: string): Promise<boolean> {
    const contact = await this.findById(id, userId);
    if (!contact) return false;
    
    if (!contact.tags.includes(tag)) {
      contact.tags.push(tag);
      return this.update(id, userId, { tags: contact.tags });
    }
    return true;
  },

  async removeTag(id: string, userId: string, tag: string): Promise<boolean> {
    const contact = await this.findById(id, userId);
    if (!contact) return false;
    
    contact.tags = contact.tags.filter(t => t !== tag);
    return this.update(id, userId, { tags: contact.tags });
  }
};
