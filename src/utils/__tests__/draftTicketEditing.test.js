import test from 'node:test';
import assert from 'node:assert/strict';

import { STATUS } from '../../constants/ticketStatus.js';
import { PRIORITIES } from '../../constants/priorities.js';
import {
  buildDraftTicketFormValues,
  buildDraftTicketUpdate
} from '../draftTicketEditing.js';

test('草稿工单可生成编辑表单初始值', () => {
  const values = buildDraftTicketFormValues({
    toolType: 'DATA_EXTRACT',
    title: '原始标题',
    priority: PRIORITIES.P2,
    systemCode: 'ERP',
    ticketClassification: { optionId: 'module_policy' },
    reporterPhone: '13800138000',
    reporterEmail: 'draft@example.com',
    reportForOthers: true,
    reportedUserName: '李四',
    reportedUserPhone: '13900139000',
    descriptionHtml: '<p>草稿描述</p>'
  });

  assert.deepEqual(values, {
    toolType: 'DATA_EXTRACT',
    title: '原始标题',
    priority: PRIORITIES.P2,
    systemCategory: 'OLD',
    systemName: 'ERP',
    ticketClassificationOptionId: 'module_policy',
    reporterPhone: '13800138000',
    reporterEmail: 'draft@example.com',
    reportForOthers: true,
    reportedUserName: '李四',
    reportedUserPhone: '13900139000',
    descriptionDoc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '草稿描述' }]
        }
      ]
    },
    descriptionHtml: '<p>草稿描述</p>'
  });
});

test('草稿工单保存时会更新工单要素并追加描述历史', () => {
  const updatedAt = '2026-04-24T12:00:00.000Z';
  const nextTicket = buildDraftTicketUpdate({
    ticket: {
      id: 'TKT-1',
      status: STATUS.DRAFT,
      requesterStatus: STATUS.DRAFT,
      supportStatus: STATUS.DRAFT,
      toolType: 'DATA_EXTRACT',
      title: '原始标题',
      priority: PRIORITIES.P3,
      systemCode: 'ERP',
      systemName: 'ERP系统',
      reporterPhone: '13800138000',
      reporterEmail: 'draft@example.com',
      reportForOthers: true,
      reportedUserName: '李四',
      reportedUserPhone: '13900139000',
      description: '原始描述',
      descriptionHtml: '<p>原始描述</p>',
      descriptionHistory: [
        {
          id: 'desc_TKT-1_1',
          version: 1,
          description: '原始描述',
          descriptionHtml: '<p>原始描述</p>',
          editedAt: '2026-04-24T10:00:00.000Z',
          editorId: 'u_requester_1',
          editorName: '张三 (提单人)',
          reason: '提交工单初始版本'
        }
      ]
    },
    values: {
      toolType: 'DATA_EXTRACT',
      title: '修改后的标题',
      priority: PRIORITIES.P1,
      systemName: 'OA',
      ticketClassification: {
        fieldLabel: '模块',
        dictionaryType: 'SYSTEM_MODULE',
        dictionaryName: '模块词典',
        optionId: 'module_claim',
        optionCode: 'CLAIM',
        optionName: '理赔模块'
      },
      reporterPhone: '13800138001',
      reporterEmail: 'updated@example.com',
      reportForOthers: false,
      reportedUserName: '不会保留',
      reportedUserPhone: '不会保留',
      descriptionHtml: '<p>修改后的描述</p>'
    },
    attachments: [{ id: 'att_1', name: '截图.png', type: 'image/png', size: 1, base64: 'data:image/png;base64,abc' }],
    user: { id: 'u_requester_1', name: '张三 (提单人)' },
    updatedAt
  });

  assert.equal(nextTicket.status, STATUS.DRAFT);
  assert.equal(nextTicket.title, '修改后的标题');
  assert.equal(nextTicket.priority, PRIORITIES.P1);
  assert.equal(nextTicket.systemCode, 'OA');
  assert.equal(nextTicket.ticketClassification.optionName, '理赔模块');
  assert.equal(nextTicket.reportForOthers, false);
  assert.equal(nextTicket.reportedUserName, '');
  assert.equal(nextTicket.reportedUserPhone, '');
  assert.equal(nextTicket.description, '修改后的描述');
  assert.equal(nextTicket.descriptionDoc.type, 'doc');
  assert.equal(nextTicket.attachments.length, 1);
  assert.equal(nextTicket.updatedAt, updatedAt);
  assert.equal(nextTicket.descriptionHistory.length, 2);
  assert.equal(nextTicket.descriptionHistory[1].reason, '草稿阶段修改工单要素');
  assert.equal(nextTicket.descriptionHistory[1].descriptionDoc.type, 'doc');
});

test('草稿工单保存时允许表单必填项为空', () => {
  const nextTicket = buildDraftTicketUpdate({
    ticket: {
      id: 'TKT-DRAFT-EMPTY',
      status: STATUS.DRAFT,
      requesterStatus: STATUS.DRAFT,
      supportStatus: STATUS.DRAFT,
      title: '原始标题',
      priority: PRIORITIES.P3,
      systemCode: 'ERP_CORE',
      reporterPhone: '13800138000',
      reportForOthers: false,
      description: '原始描述',
      descriptionHistory: []
    },
    values: {
      title: '',
      reporterPhone: '',
      reporterEmail: '',
      reportForOthers: true,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph' }]
      }
    },
    attachments: [],
    user: { id: 'u_requester_1', name: '张三 (提单人)' },
    updatedAt: '2026-04-25T12:00:00.000Z'
  });

  assert.equal(nextTicket.status, STATUS.DRAFT);
  assert.equal(nextTicket.title, '');
  assert.equal(nextTicket.reporterPhone, '');
  assert.equal(nextTicket.reportedUserName, '');
  assert.equal(nextTicket.reportedUserPhone, '');
});
