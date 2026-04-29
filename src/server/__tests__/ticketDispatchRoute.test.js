import test from 'node:test';
import assert from 'node:assert/strict';

import { POST as dispatchPost } from '../../../app/api/tickets/[id]/dispatch/route.js';
import { STATUS } from '../../constants/ticketStatus.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { dispatchCreateTicketEvent, dispatchTicketEvent, getTicketById } from '../store.js';
import { reseedDb } from '../db.js';

const requesterUser = { id: 'u_requester_1', name: '张三', role: 'REQUESTER' };

test.beforeEach(() => {
  reseedDb();
});

test('动态路由 params 为 Promise 时仍可连续保存草稿工单', async () => {
  const draftResult = dispatchCreateTicketEvent(
    EVENTS.CREATE_DRAFT,
    {
      title: '草稿再次保存',
      toolType: 'DATA_EXTRACT',
      priority: 'P4',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      reporterEmail: 'draft@example.com',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '草稿描述' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  const firstResponse = await dispatchDraftUpdate(
    draftResult.ticket.id,
    '草稿首次保存成功',
    '首次保存后的描述'
  );
  const firstPayload = await firstResponse.json();

  assert.equal(firstResponse.status, 200);
  assert.equal(firstPayload.ok, true);
  assert.equal(firstPayload.ticket.status, STATUS.DRAFT);
  assert.equal(firstPayload.ticket.title, '草稿首次保存成功');

  const secondResponse = await dispatchDraftUpdate(
    draftResult.ticket.id,
    '草稿再次保存成功',
    '再次保存后的描述'
  );
  const secondPayload = await secondResponse.json();

  assert.equal(secondResponse.status, 200);
  assert.equal(secondPayload.ok, true);
  assert.equal(secondPayload.ticket.status, STATUS.DRAFT);
  assert.equal(secondPayload.ticket.title, '草稿再次保存成功');
});

function dispatchDraftUpdate(ticketId, title, description) {
  return dispatchPost(
    buildMockRequest({
      event: EVENTS.UPDATE_DRAFT,
      payload: {
        values: {
          toolType: 'DATA_EXTRACT',
          title,
          priority: 'P3',
          systemName: 'ERP_CORE',
          reporterPhone: '13800138000',
          reporterEmail: 'draft@example.com',
          reportForOthers: false,
          reportedUserName: '',
          reportedUserPhone: '',
          descriptionDoc: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }]
          }
        },
        attachments: []
      }
    }),
    { params: Promise.resolve({ id: ticketId }) }
  );
}

function buildMockRequest(body) {
  return {
    cookies: {
      get: (name) => (name === 'itsm_session_user_id' ? { value: requesterUser.id } : null)
    },
    json: async () => body
  };
}

test('creating a subtask dispatch creates a child ticket using the parent ticket number', () => {
  const parentResult = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      id: 'TKT-20260429-0001',
      title: '父工单',
      toolType: 'DATA_EXTRACT',
      priority: 'P4',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '父工单描述' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  dispatchTicketEvent(
    parentResult.ticket.id,
    EVENTS.ACCEPT,
    {
      assigneeL1Id: 'u_l1_1',
      assigneeL1Name: 'support'
    },
    { id: 'u_l1_1', name: 'support', role: 'L1' }
  );

  const result = dispatchTicketEvent(
    parentResult.ticket.id,
    EVENTS.CREATE_SUBTASK,
    {
      subtask: {
        systemCategory: 'NEW',
        systemCode: 'OPS_MONITOR',
        systemName: '运维监控中心',
        description: '协助排查告警',
        assigneeId: '',
        assigneeName: ''
      }
    },
    { id: 'u_l1_1', name: 'support', role: 'L1' }
  );
  const childTicket = getTicketById('TKT-20260429-0001-1');

  assert.equal(result.ok, true);
  assert.equal(result.ticket.subtasks[0].id, 'TKT-20260429-0001-1');
  assert.equal(childTicket.id, 'TKT-20260429-0001-1');
  assert.equal(childTicket.parentTicketId, parentResult.ticket.id);
  assert.equal(childTicket.isSubtask, true);
  assert.equal(childTicket.subtaskStatus, 'PENDING');
});
