import { applyTransition, canTransition, EVENTS } from '../state-machine/ticketStateMachine.js';
import { withDualStatuses } from '../constants/ticketStatus.js';
import { generateTicketId, shortId } from '../utils/idGenerator.js';
import { buildCustomTagUpdate } from '../utils/customTicketTags.js';
import { routeRandomTechTransferAssignee } from '../utils/techTransferRouting.js';
import { TICKET_ACTIONS, canPerformTicketAction } from '../permissions/ticketPermissionMatrix.js';
import { getDb, reseedDb } from './db.js';
import {
  findEnabledDictionaryOption,
  getSystemConfig,
  getTicketClassificationDictionaryName
} from './adminConfigStore.js';
import { normalizeSystemCode, resolveSelectedSystem } from '../constants/systems.js';

const USER_AVAILABILITY_STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE'
};

function parseRow(row) {
  return row ? JSON.parse(row.data) : null;
}

function normalizeTicket(ticket) {
  return withDualStatuses(ticket);
}

function upsertTicket(ticket) {
  const db = getDb();
  const normalized = normalizeTicket(ticket);

  db.prepare(`
    INSERT INTO tickets (id, updated_at, data)
    VALUES (@id, @updated_at, @data)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      data = excluded.data
  `).run({
    id: normalized.id,
    updated_at: normalized.updatedAt || new Date().toISOString(),
    data: JSON.stringify(normalized)
  });

  return normalized;
}

function deleteTicketById(ticketId) {
  const db = getDb();
  db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId);
}

function upsertDefect(defect) {
  const db = getDb();

  db.prepare(`
    INSERT INTO defects (id, updated_at, data)
    VALUES (@id, @updated_at, @data)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      data = excluded.data
  `).run({
    id: defect.defectId,
    updated_at: defect.updatedAt || defect.createdAt || new Date().toISOString(),
    data: JSON.stringify(defect)
  });

  return defect;
}

export function listTickets() {
  const db = getDb();
  return db
    .prepare('SELECT data FROM tickets ORDER BY updated_at DESC, id DESC')
    .all()
    .map(parseRow)
    .map(normalizeTicket);
}

export function getTicketById(ticketId) {
  const db = getDb();
  const row = db.prepare('SELECT data FROM tickets WHERE id = ?').get(ticketId);
  return row ? normalizeTicket(parseRow(row)) : null;
}

export function listOaApplications() {
  return listTickets()
    .filter((ticket) => ticket.oaApplication?.oaId)
    .map((ticket) => {
      const oaApplication = ticket.oaApplication || {};
      return {
        ...oaApplication,
        ticketId: ticket.id,
        title: ticket.title,
        toolType: ticket.toolType,
        requesterName: ticket.requesterName,
        ticketStatus: ticket.status,
        oaStatus: oaApplication.status,
        formalTicketCreated: ticket.formalTicketCreated === true,
        oaLocked: ticket.oaLocked === true
      };
    });
}

export function getTicketByOaId(oaId) {
  return listTickets().find((ticket) => ticket.oaApplication?.oaId === oaId) || null;
}

export function addMessageToTicket(ticketId, message) {
  const ticket = getTicketById(ticketId);
  if (!ticket) return null;

  return upsertTicket({
    ...ticket,
    messages: [...(ticket.messages || []), message],
    updatedAt: new Date().toISOString()
  });
}

export function updateTicketCustomTags(ticketId, tags, user) {
  const ticket = getTicketById(ticketId);
  if (!ticket) {
    return { ok: false, reason: '工单不存在' };
  }

  if (!canPerformTicketAction(ticket, user, TICKET_ACTIONS.UPDATE_CUSTOM_TAGS)) {
    return { ok: false, reason: '当前状态或角色无权执行该操作' };
  }

  const nextTicket = buildCustomTagUpdate(ticket, tags, user);
  return {
    ok: true,
    ticket: upsertTicket(nextTicket)
  };
}

export function dispatchTicketEvent(ticketId, event, payload, user) {
  const ticket = getTicketById(ticketId);
  if (!ticket) {
    return { ok: false, reason: '工单不存在' };
  }

  let nextPayload;
  try {
    nextPayload = prepareTicketEventPayload(ticket, event, payload, user);
  } catch (error) {
    return { ok: false, reason: error.message || '工单数据校验失败' };
  }
  const assignmentCheck = validateTicketAssignmentTargets(ticket, event, nextPayload, user);
  if (!assignmentCheck.ok) {
    return assignmentCheck;
  }
  const check = canTransition(ticket, event, user, nextPayload);
  if (!check.ok) {
    return { ok: false, reason: check.reason };
  }

  try {
    if (event === EVENTS.CREATE_SUBTASK) {
      const childCheck = canTransition(null, EVENTS.CREATE_SUBTASK_TICKET, user, nextPayload.subtaskTicket);
      if (!childCheck.ok) {
        return { ok: false, reason: childCheck.reason };
      }

      const nextParentTicket = applyTransition(ticket, event, nextPayload, user);
      const childTicket = applyTransition(null, EVENTS.CREATE_SUBTASK_TICKET, nextPayload.subtaskTicket, user);
      const savedParentTicket = upsertTicket(nextParentTicket);
      const savedChildTicket = upsertTicket(childTicket);
      return {
        ok: true,
        ticket: savedParentTicket,
        tickets: [savedParentTicket, savedChildTicket]
      };
    }

    const nextTicket = applyTransition(ticket, event, nextPayload, user);
    const savedTicket = upsertTicket(nextTicket);
    const relatedTickets = [savedTicket];
    if (savedTicket.isSubtask) {
      const parentTicket = syncParentSubtaskSummary(savedTicket);
      if (parentTicket) relatedTickets.push(parentTicket);
    }
    if (savedTicket.id !== ticketId) {
      deleteTicketById(ticketId);
    }
    return {
      ok: true,
      ticket: savedTicket,
      tickets: relatedTickets
    };
  } catch (error) {
    return { ok: false, reason: error.message || '状态流转失败' };
  }
}

export function dispatchCreateTicketEvent(event, payload, user) {
  let nextPayload;
  try {
    nextPayload = prepareCreateTicketPayload(event, payload);
  } catch (error) {
    return { ok: false, reason: error.message || '工单数据校验失败' };
  }
  const check = canTransition(null, event, user, nextPayload);
  if (!check.ok) {
    return { ok: false, reason: check.reason };
  }

  try {
    const nextTicket = applyTransition(null, event, nextPayload, user);
    return {
      ok: true,
      ticket: upsertTicket(nextTicket)
    };
  } catch (error) {
    return { ok: false, reason: error.message || '状态流转失败' };
  }
}

export function listDefects() {
  const db = getDb();
  return db
    .prepare('SELECT data FROM defects ORDER BY updated_at DESC, id DESC')
    .all()
    .map(parseRow);
}

export function createDefect(defect) {
  return upsertDefect(defect);
}

export function findUserByCredentials(username, password, role) {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT data FROM users WHERE username = ? AND password = ? AND json_extract(data, \'$.role\') = ?'
    )
    .get(username, password, role);

  if (!row) {
    return null;
  }

  const user = parseRow(row);
  return sanitizeUser(user);
}

export function listUsers() {
  const db = getDb();
  return db
    .prepare('SELECT data FROM users ORDER BY username ASC')
    .all()
    .map(parseRow)
    .map(sanitizeUser);
}

export function listAssignableSupportUsers(role = null) {
  return listActiveSupportAssignees(role).map((user) => ({
    ...user,
    availabilityStatus: USER_AVAILABILITY_STATUS.ONLINE
  }));
}

export function updateUserAvailability(userId, availabilityStatus) {
  const normalizedStatus = normalizeAvailabilityStatus(availabilityStatus);
  if (!normalizedStatus) {
    return { ok: false, reason: 'Invalid account availability status' };
  }

  const db = getDb();
  const row = db.prepare('SELECT data FROM users WHERE id = ?').get(userId);
  if (!row) {
    return { ok: false, reason: 'Account does not exist' };
  }

  const user = {
    ...parseRow(row),
    availabilityStatus: normalizedStatus
  };
  db.prepare('UPDATE users SET data = @data WHERE id = @id').run({
    id: user.id,
    data: JSON.stringify(user)
  });

  return { ok: true, user: sanitizeUser(user) };
}

export function createUserAccount(input = {}, options = {}) {
  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  const name = String(input.name || username || '').trim();
  const role = String(input.role || '').trim();
  const allowAdmin = options.allowAdmin === true;

  if (!username) {
    return { ok: false, reason: '请输入账号' };
  }
  if (password.length < 6) {
    return { ok: false, reason: '密码至少 6 位' };
  }
  if (!['REQUESTER', 'L1', 'L2', 'ADMIN'].includes(role)) {
    return { ok: false, reason: '请选择人员类型' };
  }
  if (role === 'ADMIN' && !allowAdmin) {
    return { ok: false, reason: '公开注册不能创建管理员账号' };
  }
  if (listUsers().some((user) => user.username === username)) {
    return { ok: false, reason: '账号已存在' };
  }

  const user = {
    id: shortId('user'),
    username,
    name,
    role,
    department: '',
    availabilityStatus: USER_AVAILABILITY_STATUS.ONLINE
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO users (id, username, password, data)
    VALUES (@id, @username, @password, @data)
  `).run({
    id: user.id,
    username,
    password,
    data: JSON.stringify(user)
  });

  return { ok: true, user: sanitizeUser(user) };
}

export function getUserById(userId) {
  const db = getDb();
  const row = db.prepare('SELECT data FROM users WHERE id = ?').get(userId);
  if (!row) return null;
  return sanitizeUser(parseRow(row));
}

export function markMessageRead(userId, ticketId, readAt = new Date().toISOString()) {
  const db = getDb();
  db.prepare(`
    INSERT INTO message_reads (user_id, ticket_id, read_at)
    VALUES (@user_id, @ticket_id, @read_at)
    ON CONFLICT(user_id, ticket_id) DO UPDATE SET
      read_at = excluded.read_at
  `).run({
    user_id: userId,
    ticket_id: ticketId,
    read_at: readAt
  });
}

export function getMessageReadsForUser(userId) {
  const db = getDb();
  const rows = db
    .prepare('SELECT ticket_id, read_at FROM message_reads WHERE user_id = ?')
    .all(userId);

  return rows.reduce((accumulator, row) => {
    accumulator[`${userId}:${row.ticket_id}`] = row.read_at;
    return accumulator;
  }, {});
}

export function resetDatabase() {
  reseedDb();
}

export function exportTicketsJson() {
  return JSON.stringify(listTickets(), null, 2);
}

export function makeExportFilename(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `itsm-tickets-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
}

function prepareCreateTicketPayload(event, payload = {}) {
  const normalizedPayload = enrichSystemSnapshot(payload);
  if (event === EVENTS.CREATE_DRAFT) {
    return {
      ...normalizedPayload,
      id: isInternalDraftId(normalizedPayload.id) ? normalizedPayload.id : shortId('draft')
    };
  }

  if (event === EVENTS.SUBMIT || isOaCreateEvent(event)) {
    return {
      ...normalizedPayload,
      id: isFormalTicketId(normalizedPayload.id) ? normalizedPayload.id : generateTicketId(listTickets())
    };
  }

  return normalizedPayload;
}

function prepareTicketEventPayload(ticket, event, payload = {}, user = null) {
  const normalizedPayload = enrichSystemSnapshot(payload);
  if (event === EVENTS.CREATE_SUBTASK) {
    const subtaskPayload = enrichSystemSnapshot(normalizedPayload.subtask || {});
    const subtaskId = subtaskPayload.id || generateSubtaskTicketId(ticket, listTickets());
    const subtask = {
      ...subtaskPayload,
      id: subtaskId,
      parentTicketId: ticket.id,
      status: 'PENDING'
    };
    return {
      ...normalizedPayload,
      subtask,
      subtaskTicket: {
        ...subtask,
        title: subtask.description || `子任务 ${subtaskId}`,
        priority: ticket.priority,
        requesterId: ticket.requesterId,
        requesterName: ticket.requesterName,
        reporterPhone: ticket.reporterPhone,
        reporterEmail: ticket.reporterEmail
      }
    };
  }

  if ((event === EVENTS.SUBMIT || event === EVENTS.AI_RESOLVE || isOaCreateEvent(event)) && isInternalDraftId(ticket.id)) {
    return {
      ...normalizedPayload,
      id: generateTicketId(listTickets()),
      draftId: ticket.id
    };
  }

  if (event === EVENTS.WITHDRAW && !isInternalDraftId(ticket.id)) {
    return {
      ...normalizedPayload,
      id: isInternalDraftId(normalizedPayload.id) ? normalizedPayload.id : shortId('draft')
    };
  }

  if (event === EVENTS.TRANSFER_TECH && shouldAutoAssignTechTransfer(normalizedPayload)) {
    const targetRole = normalizedPayload.targetRole || user?.role;
    const assignee = routeRandomTechTransferAssignee(
      targetRole,
      user?.id,
      Math.random,
      listActiveSupportAssignees(targetRole)
    );
    return {
      ...normalizedPayload,
      assigneeId: assignee.id,
      assigneeName: assignee.name
    };
  }

  return normalizedPayload;
}

function enrichSystemSnapshot(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const systems = getSystemConfig().systems;
  const systemCode = normalizeSystemCode(payload.systemCode || payload.systemName);
  const system = resolveSelectedSystem(systems, systemCode);
  const targetSystemCode = normalizeSystemCode(payload.targetSystemCode);
  const targetSystem = resolveSelectedSystem(systems, targetSystemCode);
  const values = payload.values && typeof payload.values === 'object'
    ? enrichSystemSnapshot(payload.values)
    : payload.values;
  const ticketClassification = normalizeTicketClassificationSnapshot(payload.ticketClassification, system);

  return {
    ...payload,
    ...(values ? { values } : {}),
    ...(system
      ? {
          systemCategory: payload.systemCategory || system.category,
          systemCode: system.code,
          systemName: system.name,
          systemDisplayName: payload.systemDisplayName || system.name,
          ...(ticketClassification ? { ticketClassification } : { ticketClassification: undefined })
        }
      : {}),
    ...(targetSystem
      ? {
          targetSystemCategory: payload.targetSystemCategory || targetSystem.category,
          targetSystemCode: targetSystem.code,
          targetSystemName: payload.targetSystemName || targetSystem.name
        }
      : {})
  };
}

function normalizeTicketClassificationSnapshot(input = {}, system = null) {
  const optionId = String(input?.optionId || input?.value || '').trim();
  if (!optionId) return null;

  const config = system?.ticketClassification;
  if (!config?.fieldLabel || !config?.dictionaryType) {
    throw new Error('当前系统未配置分类字段');
  }

  const dictionaryType = String(input.dictionaryType || config.dictionaryType || '').trim().toUpperCase();
  if (dictionaryType !== config.dictionaryType) {
    throw new Error('分类词典与系统配置不一致');
  }

  const option = findEnabledDictionaryOption(dictionaryType, optionId);
  if (!option) {
    throw new Error('分类选项不存在或已停用');
  }

  return {
    fieldLabel: config.fieldLabel,
    dictionaryType,
    dictionaryName: getTicketClassificationDictionaryName(dictionaryType),
    optionId: option.id,
    optionCode: option.code,
    optionName: option.name
  };
}

function shouldAutoAssignTechTransfer(payload = {}) {
  return payload.autoAssign === true || (payload.communicated === false && !payload.assigneeId);
}

function validateTicketAssignmentTargets(ticket, event, payload = {}, user = null) {
  const assignments = getTicketAssignmentTargets(ticket, event, payload, user);
  for (const assignment of assignments) {
    if (!assignment.assigneeId) {
      if (assignment.required) {
        return { ok: false, reason: 'No online assignee is available' };
      }
      continue;
    }

    if (!isUserAssignable(assignment.assigneeId, assignment.role)) {
      return { ok: false, reason: 'Offline accounts cannot be assigned tickets' };
    }
  }
  return { ok: true };
}

function getTicketAssignmentTargets(ticket, event, payload = {}, user = null) {
  if (event === EVENTS.ACCEPT) {
    return [{ assigneeId: payload.assigneeL1Id || user?.id, role: 'L1', required: true }];
  }
  if (event === EVENTS.TRANSFER_TECH) {
    return [{ assigneeId: payload.assigneeId, role: payload.targetRole || user?.role, required: payload.autoAssign === true }];
  }
  if (event === EVENTS.CREATE_SUBTASK) {
    return [{ assigneeId: payload.subtask?.assigneeId, role: payload.subtask?.assigneeRole }];
  }
  if (event === EVENTS.CLAIM_SUBTASK) {
    return [{ assigneeId: user?.id, role: user?.role, required: true }];
  }
  if (event === EVENTS.TRANSFER_SUBTASK) {
    return [{ assigneeId: payload.assigneeId, role: payload.assigneeRole }];
  }
  if (event === EVENTS.L1_REVIEW) {
    const assigneeId = payload.assigneeL2Id || user?.id;
    return ticket?.assigneeL2Id === assigneeId
      ? []
      : [{ assigneeId, role: 'L2', required: true }];
  }
  return [];
}

function listActiveSupportAssignees(role) {
  return listUsers()
    .filter((user) => ['L1', 'L2'].includes(user.role))
    .filter((user) => !role || user.role === role)
    .filter((user) => isUserOnline(user))
    .map(({ id, name, role: userRole }) => ({ id, name, role: userRole }));
}

function isUserAssignable(userId, role = null) {
  const user = getUserById(userId);
  if (!user) return false;
  if (role && user.role !== role) return false;
  return isUserOnline(user);
}

function syncParentSubtaskSummary(subtaskTicket) {
  if (!subtaskTicket?.isSubtask || !subtaskTicket.parentTicketId) return null;
  const parentTicket = getTicketById(subtaskTicket.parentTicketId);
  if (!parentTicket) return null;

  const nextParentTicket = {
    ...parentTicket,
    subtasks: (parentTicket.subtasks || []).map((subtask) =>
      subtask.id === subtaskTicket.id
        ? {
            ...subtask,
            systemCategory: subtaskTicket.systemCategory,
            systemCode: subtaskTicket.systemCode,
            systemName: subtaskTicket.systemName,
            assigneeId: subtaskTicket.assigneeL2Id || subtaskTicket.assigneeL1Id || null,
            assigneeName: subtaskTicket.assigneeL2Name || subtaskTicket.assigneeL1Name || null,
            status: subtaskTicket.subtaskStatus,
            noMainTicketActionRequired: subtaskTicket.noMainTicketActionRequired === true,
            updatedAt: subtaskTicket.updatedAt
          }
        : subtask
    ),
    updatedAt: new Date().toISOString()
  };
  return upsertTicket(nextParentTicket);
}

function generateSubtaskTicketId(parentTicket, tickets) {
  const prefix = `${parentTicket.id}-`;
  const ids = new Set([
    ...tickets.map((ticket) => ticket.id),
    ...(parentTicket.subtasks || []).map((subtask) => subtask.id)
  ]);
  let index = 1;
  while (ids.has(`${prefix}${index}`)) {
    index += 1;
  }
  return `${prefix}${index}`;
}

function isInternalDraftId(id) {
  return typeof id === 'string' && id.startsWith('draft_');
}

function isFormalTicketId(id) {
  return typeof id === 'string' && id.startsWith('TKT-');
}

function isOaCreateEvent(event) {
  return event === EVENTS.SUBMIT_TO_OA || event === EVENTS.SUBMIT_DATA_FIX_SCHEME_REVIEW;
}

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    department: user.department,
    availabilityStatus: normalizeAvailabilityStatus(user.availabilityStatus) || USER_AVAILABILITY_STATUS.ONLINE
  };
}

function isUserOnline(user) {
  return (normalizeAvailabilityStatus(user?.availabilityStatus) || USER_AVAILABILITY_STATUS.ONLINE) === USER_AVAILABILITY_STATUS.ONLINE;
}

function normalizeAvailabilityStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  if (status === USER_AVAILABILITY_STATUS.ONLINE || status === USER_AVAILABILITY_STATUS.OFFLINE) {
    return status;
  }
  return '';
}
