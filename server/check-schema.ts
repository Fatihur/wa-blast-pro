import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkSchema() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'wa_blast_pro'
  });

  console.log('\n=== Contacts Table ===');
  const [contacts] = await conn.query('DESCRIBE contacts');
  (contacts as any[]).forEach(r => console.log(`  ${r.Field}: ${r.Type}`));

  console.log('\n=== Groups Table ===');
  const [groups] = await conn.query('DESCRIBE `groups`');
  (groups as any[]).forEach(r => console.log(`  ${r.Field}: ${r.Type}`));

  console.log('\n=== Blast Jobs Table ===');
  const [jobs] = await conn.query('DESCRIBE blast_jobs');
  (jobs as any[]).forEach(r => console.log(`  ${r.Field}: ${r.Type}`));

  await conn.end();
}

checkSchema();
