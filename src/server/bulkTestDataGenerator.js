import fs from 'node:fs';
import path from 'node:path';

import { ROLES } from '../constants/roles.js';
import { PRIORITIES } from '../constants/priorities.js';
import { STATUS, SUPPORT_STATUSES } from '../constants/ticketStatus.js';
import { SYSTEM_CATEGORY, SYSTEM_LABELS } from '../constants/systems.js';
import { TOOL_TYPES } from '../constants/toolTypes.js';
import { EVENTS } from '../state-machine/ticketStateMachine.js';
import { createEmptyRichTextDoc } from '../utils/richText.js';
import { dispatchCreateTicketEvent, dispatchTicketEvent, listTickets, resetDatabase } from './store.js';

const DEFAULT_PER_STATUS = 3;
const DEFAULT_REQUESTER_STATUSES = [
  STATUS.DRAFT,
  STATUS.PENDING,
  STATUS.PROCESSING,
  STATUS.INFO_SUPPLEMENT,
  STATUS.CONFIRMING,
  STATUS.CLOSED
];
const REACHABLE_SUPPORT_STATUSES = [
  STATUS.PENDING,
  STATUS.PROCESSING,
  STATUS.INFO_SUPPLEMENT,
  STATUS.CONFIRMING,
  STATUS.CLOSED,
  STATUS.RETURNED
];
const SYSTEM_CODES = ['ERP_CORE', 'CRM_CENTER', 'OPS_MONITOR'];
const PRIORITY_VALUES = [PRIORITIES.P1, PRIORITIES.P2, PRIORITIES.P3, PRIORITIES.P4];

export function getReachableSupportStatuses() {
  return [...REACHABLE_SUPPORT_STATUSES];
}

export function generateBulkTestData({ perStatus = DEFAULT_PER_STATUS, reset = false } = {}) {
  if (reset) {
    resetDatabase();
  }

  const users = readInitialUsers();
  const requesters = users.filter((user) => user.role === ROLES.REQUESTER);
  const l1Users = users.filter((user) => user.role === ROLES.L1);
  const l2Users = users.filter((user) => user.role === ROLES.L2);
  const skippedSupportStatuses = SUPPORT_STATUSES.filter(
    (status) => !REACHABLE_SUPPORT_STATUSES.includes(status)
  );
  let serial = 1;

  for (const requester of requesters) {
    for (const status of DEFAULT_REQUESTER_STATUSES) {
      for (let index = 0; index < perStatus; index += 1) {
        serial = createRequesterStatusTicket({
          serial,
          requester,
          l1: l1Users[index % l1Users.length],
          l2: l2Users[index % l2Users.length],
          status,
          index
        });
      }
    }
  }

  for (const l1 of l1Users) {
    for (const status of REACHABLE_SUPPORT_STATUSES) {
      for (let index = 0; index < perStatus; index += 1) {
        serial = createL1StatusTicket({
          serial,
          requester: requesters[index % requesters.length],
          l1,
          l2: l2Users[index % l2Users.length],
          status,
          index
        });
      }
    }
  }

  for (const l2 of l2Users) {
    for (const status of REACHABLE_SUPPORT_STATUSES) {
      for (let index = 0; index < perStatus; index += 1) {
        serial = createL2StatusTicket({
          serial,
          requester: requesters[index % requesters.length],
          l1: l1Users[index % l1Users.length],
          l2,
          status,
          index
        });
      }
    }
  }

  return {
    perStatus,
    users,
    generatedTickets: listTickets().filter((ticket) => String(ticket.id || '').startsWith('TKT-BULK-') || String(ticket.id || '').startsWith('draft_bulk_')).length,
    skippedSupportStatuses
  };
}

function createRequesterStatusTicket({ serial, requester, l1, l2, status, index }) {
  if (status === STATUS.DRAFT) {
    createDraftTicket({
      id: makeDraftId(serial),
      requester,
      title: `批量测试-${requester.username}-草稿-${index + 1}`
    });
    return serial + 1;
  }

  const ticket = createSubmittedTicket({
    id: makeTicketId(serial),
    requester,
    title: `批量测试-${requester.username}-${status}-${index + 1}`
  });
  serial += 1;

  if (status === STATUS.PENDING) return serial;
  return moveTicketToStatus(ticket.id, status, { requester, l1, l2, assignL2: index % 2 === 0 });
}

function createL1StatusTicket({ serial, requester, l1, l2, status, index }) {
  const ticket = createSubmittedTicket({
    id: makeTicketId(serial),
    requester,
    title: `批量测试-${l1.username}-${status}-${index + 1}`,
    assigneeL1Id: status === STATUS.PENDING ? l1.id : null,
    assigneeL1Name: status === STATUS.PENDING ? l1.name : null
  });
  serial += 1;

  if (status === STATUS.PENDING) return serial;
  moveTicketToStatus(ticket.id, status, { requester, l1, l2, assignL2: false });
  return serial;
}

function createL2StatusTicket({ serial, requester, l1, l2, status, index }) {
  if (status === STATUS.PENDING) {
    createPendingL2Subtask({
      id: makeTicketId(serial),
      requester,
      l1,
      l2,
      title: `批量测试-${l2.username}-${status}-${index + 1}`
    });
    return serial + 1;
  }

  const ticket = createSubmittedTicket({
    id: makeTicketId(serial),
    requester,
    title: `批量测试-${l2.username}-${status}-${index + 1}`
  });
  serial += 1;

  moveTicketToStatus(ticket.id, status, { requester, l1, l2, assignL2: true });
  return serial;
}

function moveTicketToStatus(ticketId, targetStatus, { requester, l1, l2, assignL2 }) {
  acceptTicket(ticketId, l1);

  if (assignL2) {
    requestL2Support(ticketId, l1, l2);
  }

  if (targetStatus === STATUS.PROCESSING) return ticketId;

  if (targetStatus === STATUS.INFO_SUPPLEMENT) {
    dispatchOrThrow(ticketId, EVENTS.RETURN_FOR_INFO, {
      __timelineRemark: '批量测试数据：退回信息补充'
    }, l1);
    return ticketId;
  }

  if (assignL2) {
    dispatchOrThrow(ticketId, EVENTS.L1_REVIEW, {
      l2Conclusion: '<p>批量测试数据：二线排查结论</p>',
      assigneeL2Id: l2.id,
      assigneeL2Name: l2.name,
      __timelineRemark: '批量测试数据：二线提交一线复核'
    }, l2);
  }

  dispatchOrThrow(ticketId, EVENTS.INITIATE_CLOSURE, {
    summary: '<p>批量测试数据：处理总结</p>',
    summarySyncedToCorpus: true,
    __timelineRemark: '批量测试数据：发起办结'
  }, l1);

  if (targetStatus === STATUS.CONFIRMING) return ticketId;

  if (targetStatus === STATUS.CLOSED) {
    dispatchOrThrow(ticketId, EVENTS.VERIFY_YES, {
      satisfaction: { rating: 5, comment: '批量测试数据' },
      __timelineRemark: '批量测试数据：验证通过'
    }, requester);
    return ticketId;
  }

  if (targetStatus === STATUS.RETURNED) {
    dispatchOrThrow(ticketId, EVENTS.VERIFY_NO, {
      rejectionReason: '批量测试数据：验证未通过',
      __timelineRemark: '批量测试数据：验证驳回'
    }, requester);
    return ticketId;
  }

  return ticketId;
}

function createDraftTicket({ id, requester, title }) {
  return createTicketOrThrow(EVENTS.CREATE_DRAFT, buildTicketPayload({ id, requester, title }), requester);
}

function createSubmittedTicket({ id, requester, title, assigneeL1Id = null, assigneeL1Name = null }) {
  return createTicketOrThrow(
    EVENTS.SUBMIT,
    {
      ...buildTicketPayload({ id, requester, title }),
      assigneeL1Id,
      assigneeL1Name
    },
    requester
  );
}

function createPendingL2Subtask({ id, requester, l1, l2, title }) {
  return createTicketOrThrow(
    EVENTS.CREATE_SUBTASK_TICKET,
    {
      ...buildTicketPayload({ id, requester, title }),
      parentTicketId: null,
      assigneeId: l2.id,
      assigneeName: l2.name,
      assigneeRole: ROLES.L2
    },
    l1
  );
}

function acceptTicket(ticketId, l1) {
  dispatchOrThrow(ticketId, EVENTS.ACCEPT, {
    assigneeL1Id: l1.id,
    assigneeL1Name: l1.name,
    __timelineRemark: '批量测试数据：一线受理'
  }, l1);
}

function requestL2Support(ticketId, l1, l2) {
  dispatchOrThrow(ticketId, EVENTS.REQUEST_L2_SUPPORT, {
    assigneeL2Id: l2.id,
    assigneeL2Name: l2.name,
    l2SupportRequested: true,
    __timelineRemark: '批量测试数据：二线支持'
  }, l1);
}

function createTicketOrThrow(event, payload, user) {
  const result = dispatchCreateTicketEvent(event, payload, user);
  if (!result.ok) {
    throw new Error(`Failed to create ${payload.id}: ${result.reason}`);
  }
  return result.ticket;
}

function dispatchOrThrow(ticketId, event, payload, user) {
  const result = dispatchTicketEvent(ticketId, event, payload, user);
  if (!result.ok) {
    throw new Error(`Failed to dispatch ${event} for ${ticketId}: ${result.reason}`);
  }
  return result.ticket;
}

function buildTicketPayload({ id, requester, title }) {
  const systemCode = SYSTEM_CODES[Math.abs(hashString(id)) % SYSTEM_CODES.length];
  const priority = PRIORITY_VALUES[Math.abs(hashString(title)) % PRIORITY_VALUES.length];

  return {
    id,
    title,
    toolType: TOOL_TYPES.DATA_EXTRACT,
    priority,
    systemCategory: SYSTEM_CATEGORY.OLD,
    systemCode,
    systemName: SYSTEM_LABELS[systemCode] || systemCode,
    reporterPhone: '13800138000',
    reporterEmail: `${requester.username}@example.com`,
    reportForOthers: false,
    descriptionDoc: createDescriptionDoc(title),
    descriptionHtml: `<p>${title}</p>`,
    attachments: [],
    requesterId: requester.id,
    requesterName: requester.name,
    messages: []
  };
}

function createDescriptionDoc(text) {
  return {
    ...createEmptyRichTextDoc(),
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }]
      }
    ]
  };
}

function readInitialUsers() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src', 'mock', 'initialUsers.json'), 'utf8')
  );
}

function makeTicketId(serial) {
  return `TKT-BULK-${String(serial).padStart(5, '0')}`;
}

function makeDraftId(serial) {
  return `draft_bulk_${String(serial).padStart(5, '0')}`;
}

function hashString(value) {
  return Array.from(String(value)).reduce((total, char) => total + char.charCodeAt(0), 0);
}
