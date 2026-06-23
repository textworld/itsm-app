import test from 'node:test';
import assert from 'node:assert/strict';

import { PROCESSING_SUB_STATUS, STATUS } from '../../constants/ticketStatus.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import {
  dispatchCreateTicketEvent,
  dispatchTicketEvent,
  getTicketById,
  listTicketDispatchLogs,
  updateUserAvailability
} from '../store.js';
import { reseedDb } from '../db.js';
import { saveScheduleConfig } from '../adminConfigStore.js';
import { GET as dispatchLogsGet } from '../../../app/api/workflow/tickets/[id]/dispatch-logs/route.js';

const requesterUser = { id: 'u_requester_1', name: 'Requester', role: 'REQUESTER' };
const adminUser = { id: 'u_admin_1', name: 'Admin', role: 'ADMIN' };

test.beforeEach(() => {
  reseedDb();
});

test('auto-assigns a submitted ticket through ACCEPT using the configured base schedule', () => {
  saveBaseSchedule(['u_l1_1', 'u_l1_2']);

  const result = dispatchCreateTicketEvent(EVENTS.SUBMIT, buildTicketPayload('auto submit'), requesterUser);
  const savedTicket = getTicketById(result.ticket.id);

  assert.equal(result.ok, true);
  assert.equal(result.ticket.status, STATUS.PROCESSING);
  assert.equal(result.ticket.processingSubStatus, PROCESSING_SUB_STATUS.L1_INVESTIGATION);
  assert.equal(result.ticket.assigneeL1Id, 'u_l1_1');
  assert.equal(savedTicket.status, STATUS.PROCESSING);
  assert.equal(savedTicket.timeline.at(-1).action, EVENTS.ACCEPT);
  assert.equal(savedTicket.scheduleDispatch.ruleType, 'BASE_SCHEDULE');

  const dispatchLogs = listTicketDispatchLogs(result.ticket.id);
  assert.equal(dispatchLogs.length, 1);
  assert.equal(dispatchLogs[0].ticketId, result.ticket.id);
  assert.equal(dispatchLogs[0].status, 'SUCCESS');
  assert.equal(dispatchLogs[0].event, EVENTS.SUBMIT);
  assert.equal(dispatchLogs[0].assigneeId, 'u_l1_1');
  assert.equal(dispatchLogs[0].ruleType, 'BASE_SCHEDULE');
  assert.equal(dispatchLogs[0].data.route.sequenceIndex, 0);
});

test('records automatic assignment as a state-machine ACCEPT transition', () => {
  saveBaseSchedule(['u_l1_1']);

  const result = dispatchCreateTicketEvent(EVENTS.SUBMIT, buildTicketPayload('state machine accept'), requesterUser);

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.ticket.timeline.map((entry) => entry.action),
    [EVENTS.SUBMIT, EVENTS.ACCEPT]
  );
  assert.equal(result.ticket.timeline.at(-1).fromStatus, STATUS.PENDING);
  assert.equal(result.ticket.timeline.at(-1).toStatus, STATUS.PROCESSING);
  assert.equal(result.ticket.timeline.at(-1).operatorId, 'u_l1_1');
});

test('keeps a submitted ticket pending when configured assignees are offline', () => {
  saveBaseSchedule(['u_l1_1']);
  updateUserAvailability('u_l1_1', 'OFFLINE');

  const result = dispatchCreateTicketEvent(EVENTS.SUBMIT, buildTicketPayload('offline fallback'), requesterUser);

  assert.equal(result.ok, true);
  assert.equal(result.ticket.status, STATUS.PENDING);
  assert.equal(result.ticket.assigneeL1Id, null);

  const dispatchLogs = listTicketDispatchLogs(result.ticket.id);
  assert.equal(dispatchLogs.length, 1);
  assert.equal(dispatchLogs[0].ticketId, result.ticket.id);
  assert.equal(dispatchLogs[0].status, 'SKIPPED');
  assert.equal(dispatchLogs[0].event, EVENTS.SUBMIT);
  assert.equal(dispatchLogs[0].data.reason, 'NO_AVAILABLE_ASSIGNEE');
});

test('auto-assigns an OA generated formal ticket through ACCEPT', () => {
  saveBaseSchedule(['u_l1_1']);
  const created = dispatchCreateTicketEvent(
    EVENTS.SUBMIT_TO_OA,
    buildTicketPayload('oa ticket'),
    requesterUser
  );

  const result = dispatchTicketEvent(
    created.ticket.id,
    EVENTS.OA_ITSM_GENERATE_TICKET,
    {
      action: 'GENERATE_TICKET',
      opinion: 'approved',
      attachments: []
    },
    adminUser
  );
  const savedTicket = getTicketById(created.ticket.id);

  assert.equal(result.ok, true);
  assert.equal(result.ticket.status, STATUS.PROCESSING);
  assert.equal(result.ticket.assigneeL1Id, 'u_l1_1');
  assert.equal(savedTicket.formalTicketCreated, true);
  assert.equal(savedTicket.timeline.at(-1).action, EVENTS.ACCEPT);
});

test('dispatch logs route returns ticket dispatch logs for administrators', async () => {
  saveBaseSchedule(['u_l1_1']);
  const result = dispatchCreateTicketEvent(EVENTS.SUBMIT, buildTicketPayload('admin dispatch logs'), requesterUser);

  const response = await dispatchLogsGet(
    buildMockRequestForUser('u_admin_1'),
    { params: Promise.resolve({ id: result.ticket.id }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.logs.length, 1);
  assert.equal(payload.logs[0].ticketId, result.ticket.id);
  assert.equal(payload.logs[0].status, 'SUCCESS');
  assert.equal(payload.logs[0].ruleType, 'BASE_SCHEDULE');
});

test('dispatch logs route rejects non-administrator users', async () => {
  saveBaseSchedule(['u_l1_1']);
  const result = dispatchCreateTicketEvent(EVENTS.SUBMIT, buildTicketPayload('forbidden dispatch logs'), requesterUser);

  const response = await dispatchLogsGet(
    buildMockRequestForUser('u_l1_1'),
    { params: Promise.resolve({ id: result.ticket.id }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.ok, false);
  assert.equal(payload.reason, '无管理员权限');
});

function saveBaseSchedule(userIds) {
  const result = saveScheduleConfig(
    {
      groups: [
        {
          id: 'grp_auto',
          name: 'Auto assignment',
          systemCodes: ['ERP_CORE'],
          baseSchedule: { userIds },
          insuranceTeams: [],
          flexibleRules: []
        }
      ]
    },
    adminUser
  );

  assert.equal(result.ok, true);
}

function buildTicketPayload(title) {
  return {
    title,
    toolType: 'DATA_EXTRACT',
    priority: 'P3',
    systemName: 'ERP_CORE',
    reporterPhone: '13800138000',
    reporterEmail: '',
    reportForOthers: false,
    descriptionDoc: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: title }] }]
    },
    attachments: []
  };
}

function buildMockRequestForUser(userId) {
  return {
    cookies: {
      get: (name) => (name === 'itsm_session_user_id' ? { value: userId } : null)
    }
  };
}
