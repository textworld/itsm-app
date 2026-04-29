import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { withDualStatuses } from '../constants/ticketStatus.js';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'itsm.sqlite');
const jsonDbPath = path.join(dataDir, 'itsm-fallback.json');
const mockDir = path.join(process.cwd(), 'src', 'mock');

function readMockJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(mockDir, filename), 'utf8'));
}

function createDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });

  let db;
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  } catch (error) {
    console.warn(
      `SQLite native binding unavailable, using JSON fallback store: ${String(error.message).split('\n')[0]}`
    );
    db = new JsonFallbackDatabase(jsonDbPath);
  }

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

class JsonFallbackDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.tables = this.load();
  }

  pragma() {}

  exec() {}

  transaction(fn) {
    return (...args) => fn(...args);
  }

  prepare(sql) {
    return new JsonFallbackStatement(this, normalizeSql(sql));
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      return {
        ...createEmptyTables(),
        ...JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
      };
    }
    return createEmptyTables();
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.tables, null, 2));
  }
}

class JsonFallbackStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  get(...args) {
    if (this.sql.includes('select count(*) as count from users')) {
      return { count: this.db.tables.users.length };
    }
    if (this.sql.includes('select count(*) as count from tickets')) {
      return { count: this.db.tables.tickets.length };
    }
    if (this.sql.includes('select count(*) as count from defects')) {
      return { count: this.db.tables.defects.length };
    }
    if (this.sql.includes('select data from tickets where id = ?')) {
      return this.db.tables.tickets.find((row) => row.id === args[0]) || undefined;
    }
    if (
      this.sql.includes('select data from users where username = ?') &&
      this.sql.includes('password = ?')
    ) {
      const [username, password, role] = args;
      return this.db.tables.users.find((row) => {
        const user = JSON.parse(row.data);
        return row.username === username && row.password === password && user.role === role;
      }) || undefined;
    }
    if (this.sql.includes('select data from users where id = ?')) {
      return this.db.tables.users.find((row) => row.id === args[0]) || undefined;
    }
    if (this.sql.includes('from uploads') && this.sql.includes('where id = ?')) {
      return this.db.tables.uploads.find((row) => row.id === args[0]) || undefined;
    }
    return undefined;
  }

  all(...args) {
    if (this.sql.includes('select data from tickets order by updated_at desc')) {
      return [...this.db.tables.tickets].sort(compareUpdatedRows);
    }
    if (this.sql.includes('select data from defects order by updated_at desc')) {
      return [...this.db.tables.defects].sort(compareUpdatedRows);
    }
    if (this.sql.includes('select ticket_id, read_at from message_reads where user_id = ?')) {
      return this.db.tables.message_reads
        .filter((row) => row.user_id === args[0])
        .map((row) => ({ ticket_id: row.ticket_id, read_at: row.read_at }));
    }
    return [];
  }

  run(params = {}) {
    if (this.sql.startsWith('delete from users')) {
      this.db.tables.users = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from tickets where id = ?')) {
      const ticketId = params;
      this.db.tables.tickets = this.db.tables.tickets.filter((row) => row.id !== ticketId);
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from tickets')) {
      this.db.tables.tickets = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from defects')) {
      this.db.tables.defects = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from message_reads')) {
      this.db.tables.message_reads = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from uploads')) {
      this.db.tables.uploads = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into users')) {
      upsertById(this.db.tables.users, {
        id: params.id,
        username: params.username,
        password: params.password,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into tickets')) {
      upsertById(this.db.tables.tickets, {
        id: params.id,
        updated_at: params.updated_at,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into defects')) {
      upsertById(this.db.tables.defects, {
        id: params.id,
        updated_at: params.updated_at,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into message_reads')) {
      const nextRow = {
        user_id: params.user_id,
        ticket_id: params.ticket_id,
        read_at: params.read_at
      };
      const index = this.db.tables.message_reads.findIndex(
        (row) => row.user_id === nextRow.user_id && row.ticket_id === nextRow.ticket_id
      );
      if (index >= 0) {
        this.db.tables.message_reads[index] = nextRow;
      } else {
        this.db.tables.message_reads.push(nextRow);
      }
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into uploads')) {
      upsertById(this.db.tables.uploads, {
        id: params.id,
        stored_name: params.stored_name,
        original_name: params.original_name,
        mime_type: params.mime_type,
        size: params.size,
        created_at: params.created_at,
        uploader_id: params.uploader_id,
        uploader_name: params.uploader_name
      });
      this.db.persist();
      return { changes: 1 };
    }
    return { changes: 0 };
  }
}

function createEmptyTables() {
  return {
    users: [],
    tickets: [],
    defects: [],
    message_reads: [],
    uploads: []
  };
}

function normalizeSql(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function upsertById(rows, nextRow) {
  const index = rows.findIndex((row) => row.id === nextRow.id);
  if (index >= 0) {
    rows[index] = nextRow;
  } else {
    rows.push(nextRow);
  }
}

function compareUpdatedRows(left, right) {
  const updatedDiff =
    new Date(right.updated_at || right.created_at || 0).getTime() -
    new Date(left.updated_at || left.created_at || 0).getTime();
  if (updatedDiff !== 0) return updatedDiff;
  return String(right.id || '').localeCompare(String(left.id || ''));
}
