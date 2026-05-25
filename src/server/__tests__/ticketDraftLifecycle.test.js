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
import { saveSystemConfig } from '../adminConfigStore.js';

const requesterUser = { id: 'u_requester_1', name: '张三', role: 'REQUESTER' };

test.beforeEach(() => {
  reseedDb();
});

test('工单保存系统编码和中文名快照，后台改名不影响历史工单', () => {
  const firstResult = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      title: '系统名称快照',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '提交时记录系统中文名' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.ticket.systemCode, 'ERP_CORE');
  assert.equal(firstResult.ticket.systemName, 'ERP 核心系统');

  const saveResult = saveSystemConfig(
    {
      systems: [
        { id: 'sys_erp_core', code: 'ERP_CORE', name: 'ERP 改名后系统', category: 'OLD', visibleInSubmit: true }
      ]
    },
    { id: 'u_admin_1', name: '管理员', role: 'ADMIN' }
  );

  assert.equal(saveResult.ok, true);
  assert.equal(getTicketById(firstResult.ticket.id).systemName, 'ERP 核心系统');

  const secondResult = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      title: '系统名称新快照',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '改名后新工单使用新名称' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  assert.equal(secondResult.ok, true);
  assert.equal(secondResult.ticket.systemCode, 'ERP_CORE');
  assert.equal(secondResult.ticket.systemName, 'ERP 改名后系统');
});

test('提交工单时可选分类会保存词典快照且历史显示不受配置变化影响', () => {
  const saveResult = saveSystemConfig(
    {
      systems: [
        {
          id: 'sys_erp_core',
          code: 'ERP_CORE',
          name: 'ERP 核心系统',
          category: 'OLD',
          visibleInSubmit: true,
          ticketClassification: { fieldLabel: '模块', dictionaryType: 'SYSTEM_MODULE' }
        }
      ]
    },
    { id: 'u_admin_1', name: '管理员', role: 'ADMIN' }
  );
  assert.equal(saveResult.ok, true);

  const result = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      title: '分类快照',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      ticketClassification: { optionId: 'module_policy', dictionaryType: 'SYSTEM_MODULE' },
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '保存分类快照' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.ticket.ticketClassification, {
    fieldLabel: '模块',
    dictionaryType: 'SYSTEM_MODULE',
    dictionaryName: '模块词典',
    optionId: 'module_policy',
    optionCode: 'POLICY',
    optionName: '保单模块'
  });

  const renameResult = saveSystemConfig(
    {
      systems: [
        {
          id: 'sys_erp_core',
          code: 'ERP_CORE',
          name: 'ERP 核心系统',
          category: 'OLD',
          visibleInSubmit: true,
          ticketClassification: { fieldLabel: '业务模块', dictionaryType: 'SYSTEM_MODULE' }
        }
      ]
    },
    { id: 'u_admin_1', name: '管理员', role: 'ADMIN' }
  );
  assert.equal(renameResult.ok, true);
  assert.equal(getTicketById(result.ticket.id).ticketClassification.fieldLabel, '模块');
});

test('提交工单未选择分类时不保存空快照', () => {
  const result = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      title: '无分类快照',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '未选择分类' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  assert.equal(result.ok, true);
  assert.equal(result.ticket.ticketClassification, undefined);
});

test('提交工单拒绝篡改的分类词典和选项', () => {
  saveSystemConfig(
    {
      systems: [
        {
          id: 'sys_erp_core',
          code: 'ERP_CORE',
          name: 'ERP 核心系统',
          category: 'OLD',
          visibleInSubmit: true,
          ticketClassification: { fieldLabel: '模块', dictionaryType: 'SYSTEM_MODULE' }
        }
      ]
    },
    { id: 'u_admin_1', name: '管理员', role: 'ADMIN' }
  );

  const dictionaryResult = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      title: '篡改词典',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      ticketClassification: { optionId: 'ins_medical', dictionaryType: 'INSURANCE_TYPE' },
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '篡改词典' }] }] },
      attachments: []
    },
    requesterUser
  );

  assert.equal(dictionaryResult.ok, false);
  assert.equal(dictionaryResult.reason, '分类词典与系统配置不一致');

  const optionResult = dispatchCreateTicketEvent(
    EVENTS.SUBMIT,
    {
      title: '篡改选项',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      ticketClassification: { optionId: 'missing_option', dictionaryType: 'SYSTEM_MODULE' },
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '篡改选项' }] }] },
      attachments: []
    },
    requesterUser
  );

  assert.equal(optionResult.ok, false);
  assert.equal(optionResult.reason, '分类选项不存在或已停用');
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
