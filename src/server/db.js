import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { withDualStatuses } from '../constants/ticketStatus.js';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'itsm.sqlite');
const mockDir = path.join(process.cwd(), 'src', 'mock');

function readMockJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(mockDir, filename), 'utf8'));
}

function createDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS defects (
      id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      user_id TEXT NOT NULL,
      ticket_id TEXT NOT NULL,
      read_at TEXT NOT NULL,
      PRIMARY KEY (user_id, ticket_id)
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      stored_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      uploader_id TEXT,
      uploader_name TEXT
    );
  `);

  seedDatabase(db);
  return db;
}

function seedDatabase(db, { force = false } = {}) {
  const shouldSeed =
    force ||
    db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0 ||
    db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count === 0 ||
    db.prepare('SELECT COUNT(*) AS count FROM defects').get().count === 0;

  if (!shouldSeed) {
    return;
  }

  const reset = db.transaction(() => {
    const initialUsers = readMockJson('initialUsers.json');
    const initialTickets = readMockJson('initialTickets.json');
    const initialDefects = readMockJson('initialDefects.json');

    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM tickets').run();
    db.prepare('DELETE FROM defects').run();
    db.prepare('DELETE FROM message_reads').run();
    db.prepare('DELETE FROM uploads').run();

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password, data)
      VALUES (@id, @username, @password, @data)
    `);
    const insertTicket = db.prepare(`
      INSERT INTO tickets (id, updated_at, data)
      VALUES (@id, @updated_at, @data)
    `);
    const insertDefect = db.prepare(`
      INSERT INTO defects (id, updated_at, data)
      VALUES (@id, @updated_at, @data)
    `);

    for (const user of initialUsers) {
      insertUser.run({
        id: user.id,
        username: user.username,
        password: user.password,
        data: JSON.stringify(user)
      });
    }

    for (const ticket of initialTickets.map(withDualStatuses)) {
      insertTicket.run({
        id: ticket.id,
        updated_at: ticket.updatedAt || ticket.createdAt || new Date().toISOString(),
        data: JSON.stringify(ticket)
      });
    }

    for (const defect of initialDefects) {
      insertDefect.run({
        id: defect.defectId,
        updated_at: defect.updatedAt || defect.createdAt || new Date().toISOString(),
        data: JSON.stringify(defect)
      });
    }
  });

  reset();
}

export function getDb() {
  if (!globalThis.__itsmDb) {
    globalThis.__itsmDb = createDatabase();
  }
  return globalThis.__itsmDb;
}

export function reseedDb() {
  seedDatabase(getDb(), { force: true });
}

export { dbPath };
