import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'database.db');

let db = null;

export async function getDb() {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await initializeDatabase(db);
  return db;
}

async function initializeDatabase(db) {
  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  // Check if old database table exists and lacks the 'account_name' or 'error' column
  const tableInfo = await db.all("PRAGMA table_info(smtp_accounts)");
  const hasAccountName = tableInfo.some(col => col.name === 'account_name');
  const hasErrorCol = tableInfo.some(col => col.name === 'error');
  if (tableInfo.length > 0 && (!hasAccountName || !hasErrorCol)) {
    console.log("Migrating database: dropping old smtp_accounts table to upgrade schema...");
    await db.exec(`DROP TABLE IF EXISTS smtp_accounts`);
  }

  // Create SMTP Accounts Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS smtp_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      secure INTEGER NOT NULL DEFAULT 0, -- 1 for true, 0 for false
      enabled INTEGER NOT NULL DEFAULT 1, -- 1 for enabled, 0 for disabled
      last_verified TEXT,
      verification_status TEXT DEFAULT 'unverified', -- 'Active', 'Inactive', 'Failed Verification'
      error TEXT
    )
  `);

  // Create Email Templates Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_html INTEGER NOT NULL DEFAULT 0, -- 1 for true, 0 for false
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Scheduled Tasks Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_html INTEGER NOT NULL DEFAULT 0,
      scheduled_time TEXT NOT NULL, -- ISO date string or timestamp
      status TEXT DEFAULT 'pending', -- 'pending', 'sending', 'completed', 'cancelled'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Send Logs Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      sender_email TEXT NOT NULL,
      recipient TEXT NOT NULL,
      status TEXT NOT NULL, -- 'SUCCESS' or 'FAILED'
      scheduled_time TEXT,
      start_time TEXT, -- ISO or ms precision
      end_time TEXT,   -- ISO or ms precision
      duration INTEGER, -- ms
      smtp_response TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE SET NULL
    )
  `);

  console.log('SQLite Database initialized successfully.');
}
