import test from 'node:test';
import assert from 'node:assert/strict';

import { PROCESSING_SUB_STATUS, STATUS } from '../../constants/ticketStatus.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import {
  dispatchCreateTicketEvent,
  dispatchTicketEvent,
  getTicketById,
  updateUserAvailability
} from '../store.js';
import { reseedDb } from '../db.js';
import { saveScheduleConfig } from '../adminConfigStore.js';

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
});

test('keeps a submitted ticket pending when configured assignees are offline', () => {
  saveBaseSchedule(['u_l1_1']);
  updateUserAvailability('u_l1_1', 'OFFLINE');

  const result = dispatchCreateTicketEvent(EVENTS.SUBMIT, buildTicketPayload('offline fallback'), requesterUser);

  assert.equal(result.ok, true);
  assert.equal(result.ticket.status, STATUS.PENDING);
  assert.equal(result.ticket.assigneeL1Id, null);
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
    priority: 'P4',
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
