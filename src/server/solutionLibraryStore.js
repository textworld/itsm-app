import { ROLES } from '../constants/roles.js';
import { DATA_FIX_SCHEME_CONFIG_KEY, validateDataFixSchemeConfig } from '../utils/adminConfigValidation.js';
import { shortId } from '../utils/idGenerator.js';
import {
  SOLUTION_CHANGE_TYPE,
  SOLUTION_REFERENCE_CHANNEL,
  buildSolutionSnapshot,
  canReferenceSolution,
  filterSolutions,
  validateSolutionInput
} from '../utils/solutionLibrary.js';
import { getDb } from './db.js';
import { getTicketById } from './store.js';

function parseRow(row) {
  return row ? JSON.parse(row.data) : null;
}

function nowIso() {
  return new Date().toISOString();
}

function actorFromUser(user) {
  return user ? { id: user.id, name: user.name, role: user.role } : null;
}

function getLegacyDataFixSchemeConfig() {
  const row = getDb().prepare('SELECT data FROM app_configs WHERE key = ?').get(DATA_FIX_SCHEME_CONFIG_KEY);
  return parseRow(row) || { schemes: [], updatedAt: null, updatedBy: null };
}

function upsertSolution(solution) {
  getDb().prepare(`
    INSERT INTO solutions (id, code, title, enabled, version_no, updated_at, data)
    VALUES (@id, @code, @title, @enabled, @version_no, @updated_at, @data)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      title = excluded.title,
      enabled = excluded.enabled,
      version_no = excluded.version_no,
      updated_at = excluded.updated_at,
      data = excluded.data
  `).run({
    id: solution.id,
    code: solution.code,
    title: solution.title,
    enabled: solution.enabled === false ? 0 : 1,
    version_no: solution.versionNo,
    updated_at: solution.updatedAt,
    data: JSON.stringify(solution)
  });

  return solution;
}

function insertSolutionVersion(solution, changeType, user) {
  const createdAt = nowIso();
  const snapshot = buildSolutionSnapshot(solution);
  const version = {
    id: shortId('solver'),
    solutionId: solution.id,
    versionNo: solution.versionNo,
    changeType,
    snapshot,
    operator: actorFromUser(user),
    createdAt
  };

  getDb().prepare(`
    INSERT INTO solution_versions (id, solution_id, version_no, change_type, created_at, data)
    VALUES (@id, @solution_id, @version_no, @change_type, @created_at, @data)
  `).run({
    id: version.id,
    solution_id: version.solutionId,
    version_no: version.versionNo,
    change_type: version.changeType,
    created_at: version.createdAt,
    data: JSON.stringify(version)
  });

  return version;
}

function insertSolutionReference(reference) {
  getDb().prepare(`
    INSERT INTO solution_references (id, solution_id, ticket_id, version_no, quoted_at, data)
    VALUES (@id, @solution_id, @ticket_id, @version_no, @quoted_at, @data)
  `).run({
    id: reference.id,
    solution_id: reference.solutionId,
    ticket_id: reference.ticketId,
    version_no: reference.versionNo,
    quoted_at: reference.quotedAt,
    data: JSON.stringify(reference)
  });

  return reference;
}

export function getSolutionById(id) {
  return parseRow(getDb().prepare('SELECT data FROM solutions WHERE id = ?').get(id));
}

export function getSolutionByCode(code) {
  return parseRow(getDb().prepare('SELECT data FROM solutions WHERE code = ?').get(String(code || '').trim().toUpperCase()));
}

function listAllSolutions() {
  return getDb()
    .prepare('SELECT data FROM solutions ORDER BY updated_at DESC, id DESC')
    .all()
    .map(parseRow);
}

function listSolutionVersions(solutionId) {
  return getDb()
    .prepare('SELECT data FROM solution_versions WHERE solution_id = ? ORDER BY version_no DESC')
    .all(solutionId)
    .map(parseRow);
}

function listSolutionReferences(solutionId) {
  return getDb()
    .prepare('SELECT data FROM solution_references WHERE solution_id = ? ORDER BY quoted_at DESC')
    .all(solutionId)
    .map(parseRow);
}

export function listSolutionReferencesPage(solutionId, options = {}) {
  const solution = getSolutionById(solutionId);
  if (!solution) return { ok: false, reason: '方案不存在' };

  const keyword = String(options.keyword || '').trim().toLocaleLowerCase();
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 10));
  const enriched = listSolutionReferences(solutionId).map(enrichSolutionReference);
  const filtered = keyword
    ? enriched.filter((reference) => buildReferenceSearchText(reference).includes(keyword))
    : enriched;
  const start = (page - 1) * pageSize;

  return {
    ok: true,
    references: filtered.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total: filtered.length
    }
  };
}

function getSolutionVersion(solutionId, versionNo) {
  return parseRow(
    getDb()
      .prepare('SELECT data FROM solution_versions WHERE solution_id = ? AND version_no = ?')
      .get(solutionId, Number(versionNo))
  );
}

export function listSolutions(filters = {}) {
  return filterSolutions(listAllSolutions(), filters);
}

export function listReferenceableSolutions(ticket = {}, user = null, filters = {}) {
  const ticketFilters = {
    ...filters,
    systemCode: filters.systemCode || ticket.systemCode,
    problemTypeId: filters.problemTypeId || ticket.ticketClassification?.optionId,
    ticketType: filters.ticketType || ticket.toolType
  };

  return filterSolutions(
    listAllSolutions().filter((solution) => canReferenceSolution(solution, user)),
    ticketFilters
  );
}

export function getSolutionDetail(id) {
  const solution = getSolutionById(id);
  if (!solution) return { ok: false, reason: '方案不存在' };
  return {
    ok: true,
    solution,
    versions: listSolutionVersions(id),
    references: listSolutionReferences(id)
  };
}

export function createSolution(input, user, options = {}) {
  const validation = validateSolutionInput(input, options.context || {});
  if (!validation.ok) {
    return { ok: false, reason: '方案校验失败', errors: validation.errors };
  }
  if (getSolutionByCode(validation.value.code)) {
    return { ok: false, reason: '方案编码已存在' };
  }

  const now = nowIso();
  const solution = {
    id: options.id || shortId('solution'),
    ...validation.value,
    versionNo: 1,
    stats: { referenceCount: 0, lastReferencedAt: null },
    createdAt: now,
    createdBy: actorFromUser(user),
    updatedAt: now,
    updatedBy: actorFromUser(user)
  };

  upsertSolution(solution);
  insertSolutionVersion(solution, options.changeType || SOLUTION_CHANGE_TYPE.CREATE, user);
  return { ok: true, solution };
}

export function updateSolution(id, input, user, options = {}) {
  const current = getSolutionById(id);
  if (!current) return { ok: false, reason: '方案不存在' };

  const validation = validateSolutionInput(input, options.context || {});
  if (!validation.ok) {
    return { ok: false, reason: '方案校验失败', errors: validation.errors };
  }
  const duplicate = getSolutionByCode(validation.value.code);
  if (duplicate && duplicate.id !== id) {
    return { ok: false, reason: '方案编码已存在' };
  }

  const now = nowIso();
  const solution = {
    ...current,
    ...validation.value,
    enabled: input.enabled === undefined ? current.enabled !== false : validation.value.enabled,
    versionNo: current.versionNo + 1,
    stats: current.stats || { referenceCount: 0, lastReferencedAt: null },
    updatedAt: now,
    updatedBy: actorFromUser(user)
  };

  upsertSolution(solution);
  insertSolutionVersion(solution, options.changeType || SOLUTION_CHANGE_TYPE.UPDATE, user);
  return { ok: true, solution };
}

export function deleteSolution(id) {
  const current = getSolutionById(id);
  if (!current) return { ok: false, reason: '方案不存在' };
  getDb().prepare('DELETE FROM solutions WHERE id = ?').run(id);
  return { ok: true, solution: current };
}

export function setSolutionEnabled(id, enabled, user) {
  const current = getSolutionById(id);
  if (!current) return { ok: false, reason: '方案不存在' };

  const now = nowIso();
  const solution = {
    ...current,
    enabled: enabled === true,
    versionNo: current.versionNo + 1,
    updatedAt: now,
    updatedBy: actorFromUser(user)
  };
  upsertSolution(solution);
  insertSolutionVersion(solution, enabled ? SOLUTION_CHANGE_TYPE.ENABLE : SOLUTION_CHANGE_TYPE.DISABLE, user);
  return { ok: true, solution };
}

export function bulkSetSolutionEnabled(ids = [], enabled, user) {
  const solutions = [];
  for (const id of ids) {
    const result = setSolutionEnabled(id, enabled, user);
    if (result.ok) solutions.push(result.solution);
  }
  return { ok: true, solutions };
}

export function rollbackSolution(id, versionNo, user) {
  const current = getSolutionById(id);
  if (!current) return { ok: false, reason: '方案不存在' };

  const targetVersion = getSolutionVersion(id, versionNo);
  if (!targetVersion) return { ok: false, reason: '历史版本不存在' };

  const snapshot = targetVersion.snapshot || {};
  const now = nowIso();
  const solution = {
    ...current,
    code: snapshot.code,
    title: snapshot.title,
    enabled: snapshot.enabled !== false,
    description: snapshot.description || '',
    detailHtml: snapshot.detailHtml || '',
    detailText: snapshot.detailText || '',
    insuranceTypeIds: snapshot.classification?.insuranceTypeIds || [],
    relatedInternalSchemeIds: snapshot.classification?.relatedInternalSchemeIds || [],
    ticketTypes: snapshot.classification?.ticketTypes || [],
    systemCodes: snapshot.classification?.systemCodes || [],
    problemTypeIds: snapshot.classification?.problemTypeIds || [],
    thirdPartyDataFixScheme: snapshot.thirdPartyDataFixScheme || null,
    permissions: snapshot.permissions || current.permissions,
    versionNo: current.versionNo + 1,
    updatedAt: now,
    updatedBy: actorFromUser(user)
  };

  upsertSolution(solution);
  insertSolutionVersion(solution, SOLUTION_CHANGE_TYPE.ROLLBACK, user);
  return { ok: true, solution };
}

export function referenceSolution({ solutionId, ticketId, channel = SOLUTION_REFERENCE_CHANNEL.MESSAGE_REPLY } = {}, user) {
  const solution = getSolutionById(solutionId);
  if (!solution) return { ok: false, reason: '方案不存在', status: 404 };
  if (!canReferenceSolution(solution, user)) return { ok: false, reason: '无权引用该方案', status: 403 };

  const quotedAt = nowIso();
  const snapshot = buildSolutionSnapshot(solution);
  const reference = {
    id: shortId('solref'),
    solutionId: solution.id,
    solutionCode: solution.code,
    solutionTitle: solution.title,
    versionNo: solution.versionNo,
    snapshot,
    ticketId,
    messageId: shortId('msg'),
    operator: actorFromUser(user),
    quotedAt,
    channel
  };

  const messageItem = {
    id: reference.messageId,
    authorId: user?.id || '',
    authorName: user?.name || '',
    authorRole: user?.role || '',
    content: buildReferenceMessageContent(snapshot),
    attachments: [],
    createdAt: quotedAt,
    solutionReference: {
      referenceId: reference.id,
      solutionId: solution.id,
      solutionCode: solution.code,
      solutionTitle: solution.title,
      versionNo: solution.versionNo
    }
  };
  const systemLogMessage = {
    id: shortId('msg'),
    authorId: 'system',
    authorName: '系统',
    authorRole: 'SYSTEM',
    content: `【系统】${user?.name || '用户'}引用标准解决方案《${solution.title}》v${solution.versionNo}`,
    attachments: [],
    createdAt: quotedAt,
    system: true
  };

  reference.messageId = messageItem.id;
  insertSolutionReference(reference);
  upsertSolution({
    ...solution,
    stats: {
      ...(solution.stats || {}),
      referenceCount: Number(solution.stats?.referenceCount || 0) + 1,
      lastReferencedAt: quotedAt
    },
    updatedAt: solution.updatedAt
  });

  return { ok: true, reference, messageItem, systemLogMessage };
}

export function migrateDataFixSchemesToSolutions(user) {
  const config = getLegacyDataFixSchemeConfig();
  const schemes = Array.isArray(config.schemes) ? config.schemes : [];
  const created = [];

  for (const scheme of schemes) {
    const code = buildDataFixSolutionCode(scheme);
    if (getSolutionByCode(code)) continue;

    const result = createSolution(
      {
        code,
        title: scheme.title,
        description: scheme.description,
        detail: scheme.description,
        enabled: true,
        ticketTypes: ['DATA_FIX'],
        referencePermission: 'COMPANY'
      },
      user,
      { id: shortId('solution'), changeType: SOLUTION_CHANGE_TYPE.IMPORT }
    );
    if (result.ok) created.push(result.solution);
  }

  return { ok: true, createdCount: created.length, solutions: created };
}

export function listDataFixSchemeCompatibleSolutions(user) {
  migrateDataFixSchemesToSolutions(user);
  const supportUser = user?.role === ROLES.L1 || user?.role === ROLES.L2
    ? user
    : { ...(user || {}), role: ROLES.L1 };
  const schemes = listAllSolutions()
    .filter((solution) => solution.enabled !== false)
    .filter((solution) => canReferenceSolution(solution, supportUser))
    .map((solution) => ({
      id: solution.id,
      title: solution.title,
      description: solution.description,
      solutionId: solution.id,
      solutionCode: solution.code,
      versionNo: solution.versionNo
    }));

  return { ok: true, deprecated: true, schemes };
}

export function saveDataFixSchemeCompatibleConfig(input, user) {
  const validation = validateDataFixSchemeConfig(input);
  if (!validation.ok) {
    return { ok: false, reason: '数据修正方案配置校验失败', errors: validation.errors };
  }

  const saved = [];
  for (const scheme of validation.value.schemes) {
    const code = buildDataFixSolutionCode(scheme);
    const current = getSolutionByCode(code);
    const payload = {
      code,
      title: scheme.title,
      description: scheme.description,
      detail: scheme.description,
      enabled: true,
      ticketTypes: ['DATA_FIX'],
      referencePermission: 'COMPANY'
    };
    const result = current
      ? updateSolution(current.id, payload, user, { changeType: SOLUTION_CHANGE_TYPE.IMPORT })
      : createSolution(payload, user, { changeType: SOLUTION_CHANGE_TYPE.IMPORT });
    if (result.ok) saved.push(result.solution);
  }

  return {
    ok: true,
    deprecated: true,
    config: {
      schemes: saved.map((solution) => ({
        id: solution.id,
        title: solution.title,
        description: solution.description,
        solutionCode: solution.code,
        versionNo: solution.versionNo
      })),
      updatedAt: nowIso(),
      updatedBy: actorFromUser(user)
    }
  };
}

function buildReferenceMessageContent(snapshot) {
  return [
    `引用方案：${snapshot.title} v${snapshot.versionNo}`,
    snapshot.description ? `方案描述：${snapshot.description}` : '',
    snapshot.detailText ? `详细说明：${snapshot.detailText}` : ''
  ].filter(Boolean).join('\n');
}

function enrichSolutionReference(reference) {
  const ticket = getTicketById(reference.ticketId);
  return {
    ...reference,
    ticket: ticket
      ? {
          id: ticket.id,
          title: ticket.title || '',
          status: ticket.status || '',
          requesterName: ticket.requesterName || '',
          requesterId: ticket.requesterId || '',
          toolType: ticket.toolType || '',
          systemCode: ticket.systemCode || ''
        }
      : {
          id: reference.ticketId,
          title: '',
          status: '',
          requesterName: '',
          requesterId: '',
          toolType: '',
          systemCode: ''
        }
  };
}

function buildReferenceSearchText(reference) {
  return [
    reference.id,
    reference.ticketId,
    reference.solutionCode,
    reference.solutionTitle,
    reference.versionNo ? `v${reference.versionNo}` : '',
    reference.operator?.name,
    reference.operator?.id,
    reference.ticket?.id,
    reference.ticket?.title,
    reference.ticket?.requesterName,
    reference.ticket?.requesterId,
    reference.ticket?.status,
    reference.ticket?.toolType,
    reference.ticket?.systemCode
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

function buildDataFixSolutionCode(scheme = {}) {
  const raw = String(scheme.id || scheme.title || shortId('scheme')).trim();
  const normalized = raw.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return `DF-${normalized || 'SCHEME'}`;
}
