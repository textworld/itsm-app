import test from 'node:test';
import assert from 'node:assert/strict';

import { getDb, reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('solution library tables store current rows, versions, and references', () => {
  const db = getDb();
  db.prepare(`
    INSERT INTO solutions (id, code, title, enabled, version_no, updated_at, data)
    VALUES (@id, @code, @title, @enabled, @version_no, @updated_at, @data)
  `).run({
    id: 'sol_1',
    code: 'SOL-001',
    title: '保单状态修正',
    enabled: 1,
    version_no: 1,
    updated_at: '2026-06-11T00:00:00.000Z',
    data: JSON.stringify({ id: 'sol_1', title: '保单状态修正' })
  });

  db.prepare(`
    INSERT INTO solution_versions (id, solution_id, version_no, change_type, created_at, data)
    VALUES (@id, @solution_id, @version_no, @change_type, @created_at, @data)
  `).run({
    id: 'ver_1',
    solution_id: 'sol_1',
    version_no: 1,
    change_type: 'CREATE',
    created_at: '2026-06-11T00:00:00.000Z',
    data: JSON.stringify({ snapshot: { id: 'sol_1', versionNo: 1 } })
  });

  db.prepare(`
    INSERT INTO solution_references (id, solution_id, ticket_id, version_no, quoted_at, data)
    VALUES (@id, @solution_id, @ticket_id, @version_no, @quoted_at, @data)
  `).run({
    id: 'ref_1',
    solution_id: 'sol_1',
    ticket_id: 'TKT-001',
    version_no: 1,
    quoted_at: '2026-06-11T00:00:00.000Z',
    data: JSON.stringify({ snapshot: { title: '保单状态修正' } })
  });

  assert.equal(db.prepare('SELECT data FROM solutions WHERE id = ?').get('sol_1') !== undefined, true);
  assert.equal(db.prepare('SELECT data FROM solution_versions WHERE solution_id = ? ORDER BY version_no DESC').all('sol_1').length, 1);
  assert.equal(db.prepare('SELECT data FROM solution_references WHERE solution_id = ? ORDER BY quoted_at DESC').all('sol_1').length, 1);
});
