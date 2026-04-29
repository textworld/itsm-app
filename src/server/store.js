import { applyTransition, canTransition, EVENTS } from '../state-machine/ticketStateMachine.js';
import { withDualStatuses } from '../constants/ticketStatus.js';
import { generateTicketId, shortId } from '../utils/idGenerator.js';
import { buildCustomTagUpdate } from '../utils/customTicketTags.js';
import { TICKET_ACTIONS, canPerformTicketAction } from '../permissions/ticketPermissionMatrix.js';
import { getDb, reseedDb } from './db.js';

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

  const nextPayload = prepareTicketEventPayload(ticket, event, payload);
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
  const nextPayload = prepareCreateTicketPayload(event, payload);
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
  if (event === EVENTS.CREATE_DRAFT) {
    return {
      ...payload,
      id: isInternalDraftId(payload.id) ? payload.id : shortId('draft')
    };
  }

  if (event === EVENTS.SUBMIT) {
    return {
      ...payload,
      id: isFormalTicketId(payload.id) ? payload.id : generateTicketId(listTickets())
    };
  }

  return payload;
}

function prepareTicketEventPayload(ticket, event, payload = {}) {
  if (event === EVENTS.CREATE_SUBTASK) {
    const subtaskId = payload.subtask?.id || generateSubtaskTicketId(ticket, listTickets());
    const subtask = {
      ...(payload.subtask || {}),
      id: subtaskId,
      parentTicketId: ticket.id,
      status: 'PENDING'
    };
    return {
      ...payload,
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

  if ((event === EVENTS.SUBMIT || event === EVENTS.AI_RESOLVE) && isInternalDraftId(ticket.id)) {
    return {
      ...payload,
      id: generateTicketId(listTickets()),
      draftId: ticket.id
    };
  }

  if (event === EVENTS.WITHDRAW && !isInternalDraftId(ticket.id)) {
    return {
      ...payload,
      id: isInternalDraftId(payload.id) ? payload.id : shortId('draft')
    };
  }

  return payload;
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

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    department: user.department
  };
}
