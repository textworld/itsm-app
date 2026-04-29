import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES } from '../../../constants/roles.js';
import { PROCESSING_SUB_STATUS, STATUS } from '../../../constants/ticketStatus.js';
import { filterTicketsBySearch } from '../../../utils/ticketListFilters.js';

test('filterTicketsBySearch 支持按工单编号和标题筛选', () => {
  const tickets = [
    { id: 'TKT-001', title: '登录失败' },
    { id: 'TKT-002', title: '报表导出异常' },
    { id: 'draft_003', title: '草稿待提交' }
  ];

  assert.deepEqual(filterTicketsBySearch(tickets, { ticketId: '002' }).map((ticket) => ticket.id), ['TKT-002']);
  assert.deepEqual(filterTicketsBySearch(tickets, { title: '登录' }).map((ticket) => ticket.id), ['TKT-001']);
  assert.deepEqual(filterTicketsBySearch(tickets, { ticketId: 'DRAFT', title: '提交' }).map((ticket) => ticket.id), ['draft_003']);
});

test('filterTicketsBySearch supports extended ticket fields', () => {
  const now = new Date('2026-04-29T10:00:00.000Z').getTime();
  const user = { id: 'u_l1_1', role: ROLES.L1 };
  const messageReads = {
    'u_l1_1:TKT-001': '2026-04-28T08:00:00.000Z'
  };
  const tickets = [
    {
      id: 'TKT-001',
      title: 'ERP login issue',
      priority: 'P1',
      toolType: 'CONSULT',
      status: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      systemCode: 'ERP_CORE',
      systemName: 'ERP Core',
      requesterName: 'Alice',
      assigneeL1Name: 'Bob',
      reporterPhone: '13800000000',
      customTagsByUser: { u_l1_1: ['vip'] },
      createdAt: '2026-04-28T07:00:00.000Z',
      updatedAt: '2026-04-28T09:00:00.000Z',
      expiresAt: '2026-04-28T07:30:00.000Z',
      defectTag: { type: 'bug' },
      linkedDefect: { defectId: 'DEF-001' },
      messages: [
        {
          authorId: 'requester_1',
          createdAt: '2026-04-28T09:00:00.000Z'
        }
      ]
    },
    {
      id: 'TKT-002',
      title: 'CRM permission request',
      priority: 'P3',
      toolType: 'PERMISSION',
      status: STATUS.PENDING,
      supportStatus: STATUS.PENDING,
      systemCode: 'CRM_CENTER',
      systemName: 'CRM Center',
      requesterName: 'Carol',
      assigneeL1Name: '',
      reporterPhone: '13900000000',
      customTagsByUser: {},
      createdAt: '2026-04-20T07:00:00.000Z',
      updatedAt: '2026-04-21T09:00:00.000Z',
      expiresAt: '2026-04-29T12:00:00.000Z',
      defectTag: null,
      linkedDefect: null,
      messages: []
    }
  ];

  const result = filterTicketsBySearch(
    tickets,
    {
      priority: 'P1',
      toolType: 'CONSULT',
      status: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      systemKeyword: 'erp',
      requesterName: 'ali',
      assigneeName: 'bob',
      reporterPhone: '138',
      customTag: 'vip',
      createdRange: ['2026-04-28', '2026-04-28'],
      updatedRange: ['2026-04-28', '2026-04-28'],
      hasUnread: 'yes',
      isOverdue: 'yes',
      hasDefectTag: 'yes',
      hasLinkedDefect: 'yes'
    },
    { user, messageReads, now }
  );

  assert.deepEqual(result.map((ticket) => ticket.id), ['TKT-001']);
});

test('filterTicketsBySearch can match negative yes/no filters', () => {
  const tickets = [
    {
      id: 'TKT-001',
      title: 'linked defect',
      status: STATUS.PENDING,
      supportStatus: STATUS.PENDING,
      createdAt: '2026-04-29T07:00:00.000Z',
      expiresAt: '2026-04-29T12:00:00.000Z',
      defectTag: { type: 'bug' },
      linkedDefect: { defectId: 'DEF-001' },
      messages: []
    },
    {
      id: 'TKT-002',
      title: 'normal ticket',
      status: STATUS.PENDING,
      supportStatus: STATUS.PENDING,
      createdAt: '2026-04-29T07:00:00.000Z',
      expiresAt: '2026-04-29T12:00:00.000Z',
      defectTag: null,
      linkedDefect: null,
      messages: []
    }
  ];

  const result = filterTicketsBySearch(
    tickets,
    { hasDefectTag: 'no', hasLinkedDefect: 'no', hasUnread: 'no', isOverdue: 'no' },
    { user: { id: 'u_l1_1', role: ROLES.L1 }, now: new Date('2026-04-29T10:00:00.000Z').getTime() }
  );

  assert.deepEqual(result.map((ticket) => ticket.id), ['TKT-002']);
});
