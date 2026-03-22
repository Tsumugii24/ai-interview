import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Create users table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    balance INTEGER DEFAULT 0
  )
`);

// Add missing columns if they don't exist (migrations)
['email', 'phone'].forEach(col => {
  try { db.prepare(`ALTER TABLE users ADD COLUMN ${col} TEXT`).run(); } catch(e) {}
});

try { db.prepare("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'Free'").run(); } catch(e) {}
try { db.prepare("ALTER TABLE users ADD COLUMN nextRefresh TEXT").run(); } catch(e) {}

// For existing users returning NULL plan
db.prepare("UPDATE users SET plan = 'Free' WHERE plan IS NULL").run();

// For existing users returning NULL nextRefresh — set to 1st of next month
const now = new Date();
const defaultRefresh = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0)).toISOString();
db.prepare("UPDATE users SET nextRefresh = ? WHERE nextRefresh IS NULL").run(defaultRefresh);

// Create resumes table
db.exec(`
  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER UNIQUE NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

// Create records table for saved interviews
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    duration TEXT,
    elapsedSeconds INTEGER,
    score INTEGER,
    status TEXT,
    transcript TEXT,
    transcriptEntries TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',
    startedAt TEXT,
    endedAt TEXT,
    aiReportStatus TEXT DEFAULT 'not_requested',
    aiReport TEXT,
    aiReportGeneratedAt TEXT,
    createdAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

[
  "ALTER TABLE records ADD COLUMN elapsedSeconds INTEGER",
  "ALTER TABLE records ADD COLUMN transcriptEntries TEXT DEFAULT '[]'",
  "ALTER TABLE records ADD COLUMN startedAt TEXT",
  "ALTER TABLE records ADD COLUMN endedAt TEXT",
  "ALTER TABLE records ADD COLUMN aiReportStatus TEXT DEFAULT 'not_requested'",
  "ALTER TABLE records ADD COLUMN aiReport TEXT",
  "ALTER TABLE records ADD COLUMN aiReportGeneratedAt TEXT",
].forEach(statement => {
  try { db.prepare(statement).run(); } catch (e) {}
});

db.prepare("UPDATE records SET transcriptEntries = '[]' WHERE transcriptEntries IS NULL").run();
db.prepare("UPDATE records SET tags = '[]' WHERE tags IS NULL").run();
db.prepare("UPDATE records SET aiReportStatus = 'not_requested' WHERE aiReportStatus IS NULL").run();
db.prepare("UPDATE records SET aiReportStatus = 'not_requested' WHERE aiReportStatus IN ('pending', 'processing') AND (aiReport IS NULL OR aiReport = '')").run();

export default db;
