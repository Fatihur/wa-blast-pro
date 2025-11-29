import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  console.log('Initializing database...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('Executing schema...');
    await connection.query(schema);
    
    console.log('\n✓ Database initialized successfully!');
    console.log('\nTables created:');
    console.log('  - users');
    console.log('  - password_resets');
    console.log('  - contacts (per-user)');
    console.log('  - groups (per-user)');
    console.log('  - group_contacts');
    console.log('  - blast_jobs (per-user)');
    console.log('  - blast_recipients');
    console.log('  - message_templates');
    console.log('  - settings');
    
    console.log('\n✓ Database is ready to use.');
    console.log('\nNote: Each user will have their own contacts, groups, and blast jobs.');

  } catch (error: any) {
    console.error('Error initializing database:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

initDatabase();
