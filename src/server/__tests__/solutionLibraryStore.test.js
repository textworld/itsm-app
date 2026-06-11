import test from 'node:test';
import assert from 'node:assert/strict';

import { getDb, reseedDb } from '../db.js';
import {
  bulkSetSolutionEnabled,
  createSolution,
  deleteSolution,
  getSolutionDetail,
  listDataFixSchemeCompatibleSolutions,
  listSolutions,
  migrateDataFixSchemesToSolutions,
  referenceSolution,
  rollbackSolution,
  setSolutionEnabled,
  updateSolution
} from '../solutionLibraryStore.js';

test.beforeEach(() => {
  reseedDb();
});

const admin = { id: 'u_admin', name: '系统管理员', role: 'ADMIN' };
const l1 = { id: 'u_l1', name: '一线工程师', role: 'L1' };

function buildSolutionInput(overrides = {}) {
  return {
    code: 'SOL-001',
    title: '保单状态修正',
    description: '处理保单状态异常',
    detailHtml: '<p>核对保单状态后刷新缓存</p>',
    insuranceTypeIds: ['ins_life'],
    systemCodes: ['ERP_CORE'],
    problemTypeIds: ['module_policy'],
    ticketTypes: ['DATA_FIX'],
    referencePermission: 'COMPANY',
    ...overrides
  };
}

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

test('solution store creates, updates, toggles, rolls back and preserves versions', () => {
  const created = createSolution(buildSolutionInput(), admin);
  assert.equal(created.ok, true);
  assert.equal(created.solution.versionNo, 1);

  const updated = updateSolution(created.solution.id, buildSolutionInput({
    title: '保单状态修正 v2',
    detailHtml: '<p>第二版处理步骤</p>'
  }), admin);
  assert.equal(updated.ok, true);
  assert.equal(updated.solution.versionNo, 2);

  const disabled = setSolutionEnabled(created.solution.id, false, admin);
  assert.equal(disabled.ok, true);
  assert.equal(disabled.solution.enabled, false);
  assert.equal(disabled.solution.versionNo, 3);

  const bulkEnabled = bulkSetSolutionEnabled([created.solution.id], true, admin);
  assert.equal(bulkEnabled.ok, true);
  assert.equal(bulkEnabled.solutions[0].enabled, true);
  assert.equal(bulkEnabled.solutions[0].versionNo, 4);

  const rolledBack = rollbackSolution(created.solution.id, 1, admin);
  assert.equal(rolledBack.ok, true);
  assert.equal(rolledBack.solution.title, '保单状态修正');
  assert.equal(rolledBack.solution.versionNo, 5);

  const detail = getSolutionDetail(created.solution.id);
  assert.equal(detail.ok, true);
  assert.deepEqual(
    detail.versions.map((version) => version.changeType),
    ['ROLLBACK', 'ENABLE', 'DISABLE', 'UPDATE', 'CREATE']
  );
});

test('solution references keep the referenced version snapshot after later edits', () => {
  const created = createSolution(buildSolutionInput(), admin).solution;
  const updated = updateSolution(created.id, buildSolutionInput({
    title: '保单状态修正 v2',
    detailHtml: '<p>第二版处理步骤</p>'
  }), admin).solution;

  const referenced = referenceSolution({
    solutionId: updated.id,
    ticketId: 'TKT-001',
    channel: 'MESSAGE_REPLY'
  }, l1);

  assert.equal(referenced.ok, true);
  assert.equal(referenced.reference.versionNo, 2);
  assert.equal(referenced.reference.snapshot.title, '保单状态修正 v2');
  assert.equal(referenced.messageItem.solutionReference.versionNo, 2);

  const editedAgain = updateSolution(updated.id, buildSolutionInput({
    title: '保单状态修正 v3',
    detailHtml: '<p>第三版处理步骤</p>'
  }), admin).solution;

  const detail = getSolutionDetail(updated.id);
  assert.equal(editedAgain.versionNo, 3);
  assert.equal(detail.references[0].versionNo, 2);
  assert.equal(detail.references[0].snapshot.title, '保单状态修正 v2');
  assert.equal(detail.solution.stats.referenceCount, 1);
});

test('deleting current solution keeps version and reference history', () => {
  const created = createSolution(buildSolutionInput(), admin).solution;
  referenceSolution({ solutionId: created.id, ticketId: 'TKT-001' }, l1);

  const deleted = deleteSolution(created.id, admin);
  assert.equal(deleted.ok, true);
  assert.equal(listSolutions().some((solution) => solution.id === created.id), false);

  const detail = getSolutionDetail(created.id);
  assert.equal(detail.ok, false);

  const db = getDb();
  assert.equal(db.prepare('SELECT data FROM solution_versions WHERE solution_id = ? ORDER BY version_no DESC').all(created.id).length, 1);
  assert.equal(db.prepare('SELECT data FROM solution_references WHERE solution_id = ? ORDER BY quoted_at DESC').all(created.id).length, 1);
});

test('legacy data-fix schemes migrate to solution library once and expose compatible list', () => {
  const first = migrateDataFixSchemesToSolutions(admin);
  const second = migrateDataFixSchemesToSolutions(admin);

  assert.equal(first.ok, true);
  assert.equal(first.createdCount > 0, true);
  assert.equal(second.createdCount, 0);

  const compatible = listDataFixSchemeCompatibleSolutions(l1);
  assert.equal(compatible.ok, true);
  assert.equal(compatible.schemes.length >= first.createdCount, true);
  assert.equal(Boolean(compatible.schemes[0].id), true);
  assert.equal(Boolean(compatible.schemes[0].title), true);
  assert.equal(Boolean(compatible.schemes[0].description), true);
  assert.equal(Boolean(compatible.schemes[0].solutionCode), true);
  assert.equal(Number.isInteger(compatible.schemes[0].versionNo), true);
});
