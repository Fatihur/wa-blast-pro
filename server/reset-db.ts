import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resetDatabase() {
  console.log('Resetting database...\n');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    // Drop and recreate database
    console.log('Dropping existing database...');
    await conn.query('DROP DATABASE IF EXISTS wa_blast_pro');
    await conn.query('CREATE DATABASE wa_blast_pro');
    await conn.query('USE wa_blast_pro');
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Remove the CREATE DATABASE and USE statements since we already did that
    schema = schema.replace(/CREATE DATABASE IF NOT EXISTS wa_blast_pro;/g, '');
    schema = schema.replace(/USE wa_blast_pro;/g, '');
    
    console.log('Executing schema...');
    await conn.query(schema);
    
    console.log('\n✓ Database reset successfully!');
    console.log('\nVerifying user_id columns...');
    
    // Verify
    const [contacts] = await conn.query('DESCRIBE wa_blast_pro.contacts');
    const hasUserIdContacts = (contacts as any[]).some(c => c.Field === 'user_id');
    console.log(`  contacts.user_id: ${hasUserIdContacts ? '✓' : '✗'}`);
    
    const [groups] = await conn.query('DESCRIBE wa_blast_pro.`groups`');
    const hasUserIdGroups = (groups as any[]).some(c => c.Field === 'user_id');
    console.log(`  groups.user_id: ${hasUserIdGroups ? '✓' : '✗'}`);
    
    const [jobs] = await conn.query('DESCRIBE wa_blast_pro.blast_jobs');
    const hasUserIdJobs = (jobs as any[]).some(c => c.Field === 'user_id');
    console.log(`  blast_jobs.user_id: ${hasUserIdJobs ? '✓' : '✗'}`);

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

resetDatabase();
