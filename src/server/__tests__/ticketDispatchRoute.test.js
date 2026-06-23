import test from 'node:test';
import assert from 'node:assert/strict';

import { POST as dispatchPost } from '../../../app/api/tickets/[id]/dispatch/route.js';
import { STATUS } from '../../constants/ticketStatus.js';
import { ROLES } from '../../constants/roles.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import {
  dispatchCreateTicketEvent,
  dispatchTicketEvent,
  getTicketById,
  updateTicketCustomTags,
  updateUserAvailability
} from '../store.js';
import { reseedDb } from '../db.js';

const requesterUser = { id: 'u_requester_1', name: '张三', role: 'REQUESTER' };
const l1User = { id: 'u_l1_1', name: '李一线', role: 'L1' };

test.beforeEach(() => {
  reseedDb();
});

test('动态路由 params 为 Promise 时仍可连续保存草稿工单', async () => {
  const draftResult = dispatchCreateTicketEvent(
    EVENTS.CREATE_DRAFT,
    {
      title: '草稿再次保存',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
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
      priority: 'P3',
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

test('自定义标签通过权限矩阵更新而不是状态机事件', () => {
  const ticketResult = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      id: 'TKT-20260429-0099',
      title: '自定义标签工单',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '标签描述' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  const result = updateTicketCustomTags(
    ticketResult.ticket.id,
    ['  数据问题 ', '数据问题', '复盘'],
    l1User
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.ticket.customTagsByUser.u_l1_1, ['数据问题', '复盘']);
});
test('backend automatic tech transfer randomly assigns another support user before dispatching the state-machine event', () => {
  const originalRandom = Math.random;
  Math.random = () => 0.99;

  try {
    const ticketResult = dispatchCreateTicketEvent(
      EVENTS.SUBMIT,
      {
        id: 'TKT-AUTO-DISPATCH-1',
        title: 'Backend auto dispatch',
        toolType: 'DATA_EXTRACT',
        priority: 'P3',
        systemName: 'ERP_CORE',
        reporterPhone: '13800138000',
        reporterEmail: '',
        reportForOthers: false,
        descriptionDoc: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'auto dispatch' }] }]
        },
        attachments: []
      },
      requesterUser
    );

    dispatchTicketEvent(
      ticketResult.ticket.id,
      EVENTS.ACCEPT,
      {
        assigneeL1Id: 'u_l1_1',
        assigneeL1Name: 'support'
      },
      { id: 'u_l1_1', name: 'support', role: ROLES.L1 }
    );

    const result = dispatchTicketEvent(
      ticketResult.ticket.id,
      EVENTS.TRANSFER_TECH,
      {
        targetRole: ROLES.L1,
        communicated: false,
        autoAssign: true,
        targetSystemCategory: 'NEW',
        targetSystemCode: 'OPS_MONITOR',
        targetSystemName: 'OPS Monitor'
      },
      { id: 'u_l1_1', name: 'support', role: ROLES.L1 }
    );

    assert.equal(result.ok, true);
    assert.equal(result.ticket.assigneeL1Id, 'u_l1_23');
    assert.ok(result.ticket.assigneeL1Name);
    assert.equal(result.ticket.techTransfer.assigneeId, 'u_l1_23');
    assert.equal(result.ticket.techTransfer.communicated, false);
  } finally {
    Math.random = originalRandom;
  }
});

test('offline support users cannot accept new ticket assignments', () => {
  updateUserAvailability('u_l1_1', 'OFFLINE');
  const ticketResult = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      id: 'TKT-OFFLINE-ACCEPT',
      title: 'Offline accept',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'offline accept' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  const result = dispatchTicketEvent(
    ticketResult.ticket.id,
    EVENTS.ACCEPT,
    {
      assigneeL1Id: 'u_l1_1',
      assigneeL1Name: 'support'
    },
    { id: 'u_l1_1', name: 'support', role: ROLES.L1 }
  );

  assert.equal(result.ok, false);
  assert.match(result.reason, /offline|下线|涓嬬嚎/i);
});

test('automatic tech transfer skips offline support users', () => {
  updateUserAvailability('u_l1_23', 'OFFLINE');
  const originalRandom = Math.random;
  Math.random = () => 0.99;

  try {
    const ticketResult = dispatchCreateTicketEvent(
      EVENTS.SUBMIT,
      {
        id: 'TKT-OFFLINE-AUTO-DISPATCH',
        title: 'Offline auto dispatch',
        toolType: 'DATA_EXTRACT',
        priority: 'P3',
        systemName: 'ERP_CORE',
        reporterPhone: '13800138000',
        reporterEmail: '',
        reportForOthers: false,
        descriptionDoc: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'offline auto dispatch' }] }]
        },
        attachments: []
      },
      requesterUser
    );

    dispatchTicketEvent(
      ticketResult.ticket.id,
      EVENTS.ACCEPT,
      {
        assigneeL1Id: 'u_l1_1',
        assigneeL1Name: 'support'
      },
      { id: 'u_l1_1', name: 'support', role: ROLES.L1 }
    );

    const result = dispatchTicketEvent(
      ticketResult.ticket.id,
      EVENTS.TRANSFER_TECH,
      {
        targetRole: ROLES.L1,
        communicated: false,
        autoAssign: true,
        targetSystemCategory: 'NEW',
        targetSystemCode: 'OPS_MONITOR',
        targetSystemName: 'OPS Monitor'
      },
      { id: 'u_l1_1', name: 'support', role: ROLES.L1 }
    );

    assert.equal(result.ok, true);
    assert.equal(result.ticket.assigneeL1Id, 'u_l1_22');
  } finally {
    Math.random = originalRandom;
  }
});

test('offline L2 users cannot self-assign unassigned tickets by submitting review', () => {
  updateUserAvailability('u_l2_1', 'OFFLINE');
  const ticketResult = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      id: 'TKT-OFFLINE-L2-REVIEW',
      title: 'Offline L2 review',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'offline l2 review' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  dispatchTicketEvent(
    ticketResult.ticket.id,
    EVENTS.ACCEPT,
    {
      assigneeL1Id: 'u_l1_1',
      assigneeL1Name: 'support'
    },
    { id: 'u_l1_1', name: 'support', role: ROLES.L1 }
  );
  dispatchTicketEvent(
    ticketResult.ticket.id,
    EVENTS.REQUEST_L2_SUPPORT,
    {
      assigneeL2Id: null,
      assigneeL2Name: null,
      l2SupportRequested: true
    },
    { id: 'u_l1_1', name: 'support', role: ROLES.L1 }
  );

  const result = dispatchTicketEvent(
    ticketResult.ticket.id,
    EVENTS.L1_REVIEW,
    {
      l2Conclusion: 'done',
      assigneeL2Id: 'u_l2_1',
      assigneeL2Name: 'ops'
    },
    { id: 'u_l2_1', name: 'ops', role: ROLES.L2 }
  );

  assert.equal(result.ok, false);
  assert.match(result.reason, /offline/i);
});
