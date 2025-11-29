import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Group {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  contactIds: string[];
  created_at?: Date;
  updated_at?: Date;
}

interface GroupRow extends RowDataPacket {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export const groupRepository = {
  async findAll(userId: string): Promise<Group[]> {
    const [groups] = await pool.query<GroupRow[]>(
      'SELECT * FROM `groups` WHERE user_id = ? ORDER BY name ASC',
      [userId]
    );

    const result: Group[] = [];
    for (const group of groups) {
      const contactIds = await this.getContactIds(group.id);
      result.push({
        id: group.id,
        user_id: group.user_id,
        name: group.name,
        description: group.description || undefined,
        contactIds,
        created_at: group.created_at,
        updated_at: group.updated_at
      });
    }
    return result;
  },

  async findById(id: string, userId: string): Promise<Group | null> {
    const [rows] = await pool.query<GroupRow[]>(
      'SELECT * FROM `groups` WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (rows.length === 0) return null;

    const contactIds = await this.getContactIds(id);
    return {
      id: rows[0].id,
      user_id: rows[0].user_id,
      name: rows[0].name,
      description: rows[0].description || undefined,
      contactIds,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at
    };
  },

  async getContactIds(groupId: string): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT contact_id FROM group_contacts WHERE group_id = ?',
      [groupId]
    );
    return rows.map(r => r.contact_id);
  },

  async create(userId: string, group: { name: string; description?: string }): Promise<Group> {
    const id = uuidv4();
    await pool.query<ResultSetHeader>(
      'INSERT INTO `groups` (id, user_id, name, description) VALUES (?, ?, ?, ?)',
      [id, userId, group.name, group.description || null]
    );
    return { id, user_id: userId, name: group.name, description: group.description, contactIds: [] };
  },

  async update(id: string, userId: string, group: { name?: string; description?: string }): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    if (group.name !== undefined) {
      updates.push('name = ?');
      values.push(group.name);
    }
    if (group.description !== undefined) {
      updates.push('description = ?');
      values.push(group.description);
    }

    if (updates.length === 0) return false;

    values.push(id, userId);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE \`groups\` SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    
    return result.affectedRows > 0;
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM `groups` WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  },

  async addContact(groupId: string, contactId: string): Promise<boolean> {
    try {
      await pool.query<ResultSetHeader>(
        'INSERT IGNORE INTO group_contacts (group_id, contact_id) VALUES (?, ?)',
        [groupId, contactId]
      );
      return true;
    } catch {
      return false;
    }
  },

  async addContacts(groupId: string, contactIds: string[]): Promise<number> {
    if (contactIds.length === 0) return 0;
    
    const values = contactIds.map(cid => [groupId, cid]);
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO group_contacts (group_id, contact_id) VALUES ?',
      [values]
    );
    return result.affectedRows;
  },

  async removeContact(groupId: string, contactId: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM group_contacts WHERE group_id = ? AND contact_id = ?',
      [groupId, contactId]
    );
    return result.affectedRows > 0;
  },

  async removeAllContacts(groupId: string): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM group_contacts WHERE group_id = ?',
      [groupId]
    );
    return result.affectedRows;
  },

  async count(userId: string): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM `groups` WHERE user_id = ?',
      [userId]
    );
    return rows[0].count;
  },

  async getMemberCount(groupId: string): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM group_contacts WHERE group_id = ?',
      [groupId]
    );
    return rows[0].count;
  }
};
