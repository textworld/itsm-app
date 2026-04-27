import test from 'node:test';
import assert from 'node:assert/strict';

import { PRIORITIES } from '../../constants/priorities.js';
import { PROCESSING_SUB_STATUS, STATUS } from '../../constants/ticketStatus.js';
import { EVENTS, applyTransition } from '../ticketStateMachine.js';

const requesterUser = { id: 'u_requester_1', name: '张三', role: 'REQUESTER' };
const l1User = { id: 'u_l1_1', name: '李工', role: 'L1' };

test('CREATE_DRAFT 通过状态机创建草稿且不进入待受理', () => {
  const nextTicket = applyTransition(
    null,
    EVENTS.CREATE_DRAFT,
    {
      id: 'draft_state_1',
      title: '暂存草稿',
      toolType: 'DATA_EXTRACT',
      priority: PRIORITIES.P4,
      systemName: 'ERP',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '草稿描述' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.DRAFT);
  assert.equal(nextTicket.requesterStatus, STATUS.DRAFT);
  assert.equal(nextTicket.supportStatus, STATUS.DRAFT);
  assert.equal(nextTicket.id, 'draft_state_1');
  assert.equal(nextTicket.description, '草稿描述');
  assert.equal(nextTicket.timeline.length, 1);
  assert.equal(nextTicket.timeline[0].action, EVENTS.CREATE_DRAFT);
});

test('SUBMIT 通过状态机创建待受理工单', () => {
  const nextTicket = applyTransition(
    null,
    EVENTS.SUBMIT,
    {
      id: 'TKT-STATE-1',
      title: '导出任务失败',
      toolType: 'DATA_EXTRACT',
      priority: PRIORITIES.P2,
      systemName: 'ERP',
      reporterPhone: '13800138000',
      reporterEmail: 'zhangsan@example.com',
      reportForOthers: false,
      description: '导出报错',
      descriptionHtml: '<p>导出报错</p>',
      attachments: []
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.PENDING);
  assert.equal(nextTicket.requesterStatus, STATUS.PENDING);
  assert.equal(nextTicket.supportStatus, STATUS.PENDING);
  assert.equal(nextTicket.id, 'TKT-STATE-1');
  assert.equal(nextTicket.timeline.length, 1);
  assert.equal(nextTicket.timeline[0].action, EVENTS.SUBMIT);
});

test('UPDATE_DRAFT 通过状态机保持草稿状态并更新工单要素', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-DRAFT-1',
      status: STATUS.DRAFT,
      requesterStatus: STATUS.DRAFT,
      supportStatus: STATUS.DRAFT,
      toolType: 'DATA_EXTRACT',
      title: '原始标题',
      priority: PRIORITIES.P4,
      systemCode: 'ERP',
      systemName: 'ERP系统',
      reporterPhone: '13800138000',
      reporterEmail: 'old@example.com',
      reportForOthers: false,
      reportedUserName: '',
      reportedUserPhone: '',
      description: '原始描述',
      descriptionHtml: '<p>原始描述</p>',
      descriptionHistory: [],
      attachments: []
    },
    EVENTS.UPDATE_DRAFT,
    {
      values: {
        toolType: 'DATA_EXTRACT',
        title: '修改后的标题',
        priority: PRIORITIES.P1,
        systemName: 'OA',
        reporterPhone: '13800138001',
        reporterEmail: 'new@example.com',
        reportForOthers: false,
        reportedUserName: '',
        reportedUserPhone: '',
        descriptionHtml: '<p>修改后的描述</p>'
      },
      attachments: [{ id: 'att_1', name: '截图.png', size: 1, type: 'image/png', base64: 'data:image/png;base64,abc' }]
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.DRAFT);
  assert.equal(nextTicket.title, '修改后的标题');
  assert.equal(nextTicket.priority, PRIORITIES.P1);
  assert.equal(nextTicket.description, '修改后的描述');
  assert.equal(nextTicket.descriptionHistory.length, 1);
});

test('SUBMIT 通过状态机允许草稿再次提交到待受理', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-DRAFT-2',
      status: STATUS.DRAFT,
      requesterStatus: STATUS.DRAFT,
      supportStatus: STATUS.DRAFT,
      toolType: 'DATA_EXTRACT',
      title: '草稿待提交工单',
      priority: PRIORITIES.P2,
      systemCode: 'ERP',
      systemName: 'ERP系统',
      reporterPhone: '13800138009',
      reporterEmail: 'draft@example.com',
      reportForOthers: false,
      description: '草稿描述',
      descriptionHtml: '<p>草稿描述</p>',
      descriptionHistory: [
        {
          id: 'desc_TKT-DRAFT-2_1',
          version: 1,
          description: '草稿描述',
          descriptionHtml: '<p>草稿描述</p>',
          editedAt: '2026-04-24T10:00:00.000Z',
          editorId: requesterUser.id,
          editorName: requesterUser.name,
          reason: '提交工单初始版本'
        }
      ],
      timeline: []
    },
    EVENTS.SUBMIT,
    {},
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.PENDING);
  assert.equal(nextTicket.requesterStatus, STATUS.PENDING);
  assert.equal(nextTicket.supportStatus, STATUS.PENDING);
  assert.equal(nextTicket.title, '草稿待提交工单');
  assert.equal(nextTicket.description, '草稿描述');
  assert.equal(nextTicket.descriptionHistory.length, 1);
  assert.equal(nextTicket.timeline.at(-1).action, EVENTS.SUBMIT);
});

test('AI_RESOLVE 通过状态机允许草稿直接办结并标注大模型解决', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-DRAFT-AI-1',
      status: STATUS.DRAFT,
      requesterStatus: STATUS.DRAFT,
      supportStatus: STATUS.DRAFT,
      title: '草稿智能解答',
      priority: PRIORITIES.P3,
      systemCode: 'ERP_CORE',
      systemName: 'ERP 核心系统',
      reporterPhone: '13800138000',
      reportForOthers: false,
      description: '系统登录失败',
      descriptionHistory: [],
      timeline: []
    },
    EVENTS.AI_RESOLVE,
    {
      aiResolution: {
        answer: '请清理浏览器缓存后重试。',
        messages: [{ role: 'assistant', content: '请清理浏览器缓存后重试。' }]
      }
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.CLOSED);
  assert.equal(nextTicket.requesterStatus, STATUS.CLOSED);
  assert.equal(nextTicket.supportStatus, STATUS.CLOSED);
  assert.equal(nextTicket.aiResolved, true);
  assert.equal(nextTicket.aiResolution.answer, '请清理浏览器缓存后重试。');
  assert.equal(nextTicket.timeline.at(-1).action, EVENTS.AI_RESOLVE);
});

test('UPDATE_INFO_SUPPLEMENT 通过状态机保持信息补充状态并写入描述历史', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-INFO-1',
      status: STATUS.INFO_SUPPLEMENT,
      requesterStatus: STATUS.INFO_SUPPLEMENT,
      supportStatus: STATUS.INFO_SUPPLEMENT,
      description: '旧描述',
      descriptionHtml: '<p>旧描述</p>',
      descriptionHistory: []
    },
    EVENTS.UPDATE_INFO_SUPPLEMENT,
    {
      descriptionHtml: '<p>补充后的描述</p>'
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.INFO_SUPPLEMENT);
  assert.equal(nextTicket.requesterStatus, STATUS.INFO_SUPPLEMENT);
  assert.equal(nextTicket.description, '补充后的描述');
  assert.equal(nextTicket.descriptionHistory.length, 1);
});

test('TAG_DEFECT 和 UPDATE_LINKED_DEFECT 通过状态机更新处理中工单附属信息', () => {
  const baseTicket = {
    id: 'TKT-PROCESSING-1',
    status: STATUS.PROCESSING,
    requesterStatus: STATUS.PROCESSING,
    supportStatus: STATUS.PROCESSING,
    processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    defectTag: null,
    linkedDefect: null
  };

  const taggedTicket = applyTransition(
    baseTicket,
    EVENTS.TAG_DEFECT,
    {
      defectTag: {
        type: '产品缺陷',
        description: '分页异常',
        taggedAt: '2026-04-24T15:00:00.000Z',
        taggedBy: '李工'
      }
    },
    l1User
  );

  const linkedTicket = applyTransition(
    taggedTicket,
    EVENTS.UPDATE_LINKED_DEFECT,
    {
      linkedDefect: {
        defectId: 'BUG-2026-0001',
        title: '列表分页错乱',
        module: '工单列表',
        priority: 'P1',
        isNew: false
      }
    },
    l1User
  );

  assert.equal(linkedTicket.status, STATUS.PROCESSING);
  assert.equal(linkedTicket.processingSubStatus, PROCESSING_SUB_STATUS.L1_INVESTIGATION);
  assert.equal(linkedTicket.defectTag.type, '产品缺陷');
  assert.equal(linkedTicket.linkedDefect.defectId, 'BUG-2026-0001');
});

test('UPDATE_SUMMARY 通过状态机保持处理中状态并更新总结字段', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-SUMMARY-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      summary: '',
      summarySyncedToCorpus: false
    },
    EVENTS.UPDATE_SUMMARY,
    {
      summary: '处理完成，总结如下',
      summarySyncedToCorpus: true
    },
    l1User
  );

  assert.equal(nextTicket.status, STATUS.PROCESSING);
  assert.equal(nextTicket.summary, '处理完成，总结如下');
  assert.equal(nextTicket.summarySyncedToCorpus, true);
});
