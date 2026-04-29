import test from 'node:test';
import assert from 'node:assert/strict';

import { STATUS } from '../../constants/ticketStatus.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import {
  dispatchCreateTicketEvent,
  dispatchTicketEvent,
  getTicketById,
  listTickets
} from '../store.js';
import { reseedDb } from '../db.js';

const requesterUser = { id: 'u_requester_1', name: '张三', role: 'REQUESTER' };

test.beforeEach(() => {
  reseedDb();
});

test('暂存草稿不生成正式工单号', () => {
  const result = dispatchCreateTicketEvent(
    EVENTS.CREATE_DRAFT,
    {
      title: '暂存问题',
      toolType: 'DATA_EXTRACT',
      priority: 'P4',
      systemName: 'ERP',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '先暂存' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  assert.equal(result.ok, true);
  assert.equal(result.ticket.status, STATUS.DRAFT);
  assert.match(result.ticket.id, /^draft_/);
  assert.doesNotMatch(result.ticket.id, /^TKT-/);
});

test('草稿提交时生成正式工单号并移除内部草稿记录', () => {
  const draftResult = dispatchCreateTicketEvent(
    EVENTS.CREATE_DRAFT,
    {
      id: 'draft_submit_1',
      title: '草稿转提交',
      toolType: 'DATA_EXTRACT',
      priority: 'P2',
      systemName: 'ERP',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '草稿提交' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  const submitResult = dispatchTicketEvent(draftResult.ticket.id, EVENTS.SUBMIT, {}, requesterUser);
  const tickets = listTickets();

  assert.equal(submitResult.ok, true);
  assert.equal(submitResult.ticket.status, STATUS.PENDING);
  assert.match(submitResult.ticket.id, /^TKT-\d{8}-\d{4}$/);
  assert.equal(getTicketById(draftResult.ticket.id), null);
  assert.equal(tickets.filter((ticket) => ticket.id === submitResult.ticket.id).length, 1);
});

test('草稿由大模型解决时生成正式工单号并进入已办结', () => {
  const draftResult = dispatchCreateTicketEvent(
    EVENTS.CREATE_DRAFT,
    {
      id: 'draft_ai_resolve_1',
      title: '草稿智能解决',
      toolType: 'CONSULT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '怎么重置密码' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  const resolvedResult = dispatchTicketEvent(
    draftResult.ticket.id,
    EVENTS.AI_RESOLVE,
    {
      aiResolution: {
        answer: '请在登录页点击忘记密码。',
        messages: [{ role: 'assistant', content: '请在登录页点击忘记密码。' }]
      }
    },
    requesterUser
  );

  assert.equal(resolvedResult.ok, true);
  assert.equal(resolvedResult.ticket.status, STATUS.CLOSED);
  assert.equal(resolvedResult.ticket.aiResolved, true);
  assert.match(resolvedResult.ticket.id, /^TKT-\d{8}-\d{4}$/);
  assert.equal(resolvedResult.ticket.draftId, draftResult.ticket.id);
  assert.equal(getTicketById(draftResult.ticket.id), null);
});

test('正式工单撤回到草稿箱时生成草稿编号并移除原正式编号记录', () => {
  const submitResult = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      title: '待撤回正式工单',
      toolType: 'DATA_EXTRACT',
      priority: 'P2',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '提交后撤回' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  const withdrawResult = dispatchTicketEvent(
    submitResult.ticket.id,
    EVENTS.WITHDRAW,
    { withdrawalReason: '信息填错' },
    requesterUser
  );

  assert.equal(withdrawResult.ok, true);
  assert.equal(withdrawResult.ticket.status, STATUS.DRAFT);
  assert.match(withdrawResult.ticket.id, /^draft_/);
  assert.doesNotMatch(withdrawResult.ticket.id, /^TKT-/);
  assert.equal(withdrawResult.ticket.originalTicketId, submitResult.ticket.id);
  assert.equal(getTicketById(submitResult.ticket.id), null);
  assert.equal(getTicketById(withdrawResult.ticket.id)?.id, withdrawResult.ticket.id);
});
