const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'interview_copilot.db');
console.log(`[Database] Initializing SQLite database at: ${DB_PATH}`);

const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    candidate_name TEXT,
    seniority TEXT,
    filename TEXT,
    job_description TEXT,
    resume_text TEXT,
    analysis_json TEXT,
    question_bank_json TEXT,
    status TEXT DEFAULT 'CREATED',
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id TEXT NOT NULL,
    speaker TEXT DEFAULT 'Candidate',
    text TEXT NOT NULL,
    language TEXT DEFAULT 'English',
    source TEXT,
    timestamp TEXT,
    FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS asked_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id TEXT NOT NULL,
    question TEXT NOT NULL,
    reasoning TEXT,
    source TEXT,
    timestamp TEXT,
    FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS consent_logs (
    id TEXT PRIMARY KEY,
    interview_id TEXT,
    candidate_name TEXT,
    seniority TEXT,
    timestamp TEXT,
    action TEXT,
    candidate_informed INTEGER DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_transcripts_interview_id ON transcripts(interview_id);
  CREATE INDEX IF NOT EXISTS idx_asked_questions_interview_id ON asked_questions(interview_id);
`);

console.log('[Database] SQLite schema verified and ready.');

module.exports = db;
