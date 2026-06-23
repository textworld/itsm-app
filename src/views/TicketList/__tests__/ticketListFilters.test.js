import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES } from '../../../constants/roles.js';
import { PROCESSING_SUB_STATUS, STATUS } from '../../../constants/ticketStatus.js';
import { filterTicketsBySearch } from '../../../utils/ticketListFilters.js';
import { TICKET_LIST_MODES, buildView, getVisibleTicketsForUser } from '../../../utils/ticketListView.js';

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

test('L1 workbench shows all pending tickets plus tickets assigned to the signed-in L1 user', () => {
  const tickets = [
    { id: 'TKT-MINE', toolType: 'DATA_EXTRACT', status: STATUS.PROCESSING, supportStatus: STATUS.PROCESSING, assigneeL1Id: 'u_l1_1' },
    { id: 'TKT-OTHER', toolType: 'DATA_EXTRACT', status: STATUS.PROCESSING, supportStatus: STATUS.PROCESSING, assigneeL1Id: 'u_l1_2' },
    { id: 'TKT-UNASSIGNED', toolType: 'DATA_EXTRACT', status: STATUS.PENDING, supportStatus: STATUS.PENDING, assigneeL1Id: null }
  ];
  const view = buildView(tickets, { id: 'u_l1_1', role: ROLES.L1 });

  assert.deepEqual(view.tabs[0].data.map((ticket) => ticket.id), ['TKT-MINE', 'TKT-UNASSIGNED']);
  assert.deepEqual(view.tabs.find((tab) => tab.key === STATUS.PENDING).data.map((ticket) => ticket.id), ['TKT-UNASSIGNED']);
});

test('L2 workbench only shows tickets currently assigned to the signed-in L2 user', () => {
  const tickets = [
    { id: 'TKT-001', status: STATUS.PENDING, supportStatus: STATUS.PENDING },
    {
      id: 'TKT-002',
      status: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L2_INVESTIGATION,
      assigneeL2Id: 'u_l2_2'
    },
    { id: 'TKT-003', status: STATUS.CLOSED, supportStatus: STATUS.CLOSED, assigneeL2Id: 'u_l2_1' }
  ];
  const view = buildView(tickets, { id: 'u_l2_1', role: ROLES.L2 });

  assert.equal(view.tabs[0].key, 'ALL');
  assert.equal(view.tabs[0].label, '全部');
  assert.deepEqual(view.tabs[0].data.map((ticket) => ticket.id), ['TKT-003']);
  assert.equal(view.defaultTab, 'ALL');
});

test('history view shows tickets once handled by the signed-in support user without status tabs', () => {
  const tickets = [
    {
      id: 'TKT-CURRENT',
      toolType: 'DATA_EXTRACT',
      status: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      assigneeL1Id: 'u_l1_1',
      assigneeHistory: [{ role: ROLES.L1, assigneeId: 'u_l1_1' }]
    },
    {
      id: 'TKT-TRANSFERRED',
      toolType: 'DATA_EXTRACT',
      status: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      assigneeL1Id: 'u_l1_2',
      assigneeHistory: [{ role: ROLES.L1, assigneeId: 'u_l1_1' }]
    },
    {
      id: 'TKT-TIMELINE',
      toolType: 'DATA_EXTRACT',
      status: STATUS.CLOSED,
      supportStatus: STATUS.CLOSED,
      assigneeL1Id: 'u_l1_3',
      timeline: [{ role: ROLES.L1, operatorId: 'u_l1_1' }]
    },
    {
      id: 'TKT-NEVER-MINE',
      toolType: 'DATA_EXTRACT',
      status: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      assigneeL1Id: 'u_l1_2'
    }
  ];
  const view = buildView(tickets, { id: 'u_l1_1', role: ROLES.L1 }, { mode: TICKET_LIST_MODES.HISTORY });

  assert.equal(view.hideTabs, true);
  assert.equal(view.tabs.length, 1);
  assert.deepEqual(view.tabs[0].data.map((ticket) => ticket.id), ['TKT-TRANSFERRED', 'TKT-TIMELINE']);
});

test('visible support tickets include current and historical assignments but exclude unrelated tickets', () => {
  const visibleTickets = getVisibleTicketsForUser(
    [
      { id: 'TKT-CURRENT', status: STATUS.PROCESSING, supportStatus: STATUS.PROCESSING, assigneeL2Id: 'u_l2_1' },
      { id: 'TKT-HISTORY', status: STATUS.PROCESSING, supportStatus: STATUS.PROCESSING, assigneeL2Id: 'u_l2_2', assigneeHistory: [{ role: ROLES.L2, assigneeId: 'u_l2_1' }] },
      { id: 'TKT-OTHER', status: STATUS.PROCESSING, supportStatus: STATUS.PROCESSING, assigneeL2Id: 'u_l2_2' }
    ],
    { id: 'u_l2_1', role: ROLES.L2 }
  );

  assert.deepEqual(visibleTickets.map((ticket) => ticket.id), ['TKT-CURRENT', 'TKT-HISTORY']);
});

test('visible tickets for an L1 support user include every pending ticket', () => {
  const visibleTickets = getVisibleTicketsForUser(
    [
      { id: 'TKT-PENDING', status: STATUS.PENDING, supportStatus: STATUS.PENDING, assigneeL1Id: null },
      { id: 'TKT-MINE', status: STATUS.PROCESSING, supportStatus: STATUS.PROCESSING, assigneeL1Id: 'u_l1_1' },
      { id: 'TKT-OTHER', status: STATUS.PROCESSING, supportStatus: STATUS.PROCESSING, assigneeL1Id: 'u_l1_2' }
    ],
    { id: 'u_l1_1', role: ROLES.L1 }
  );

  assert.deepEqual(visibleTickets.map((ticket) => ticket.id), ['TKT-PENDING', 'TKT-MINE']);
});

test('administrator can see all tickets in the current ticket list', () => {
  const tickets = [
    { id: 'TKT-REQUESTER', requesterId: 'u_requester_1', status: STATUS.PENDING, supportStatus: STATUS.PENDING },
    { id: 'TKT-L1', status: STATUS.PROCESSING, supportStatus: STATUS.PROCESSING, assigneeL1Id: 'u_l1_1' },
    { id: 'TKT-L2', status: STATUS.PROCESSING, supportStatus: STATUS.PROCESSING, assigneeL2Id: 'u_l2_1' },
    { id: 'TKT-DRAFT', status: STATUS.DRAFT, supportStatus: STATUS.DRAFT, requesterId: 'u_requester_2' }
  ];

  const user = { id: 'u_admin_1', role: ROLES.ADMIN };
  const visibleTickets = getVisibleTicketsForUser(tickets, user);
  const view = buildView(visibleTickets, user);

  assert.deepEqual(visibleTickets.map((ticket) => ticket.id), ['TKT-REQUESTER', 'TKT-L1', 'TKT-L2', 'TKT-DRAFT']);
  assert.deepEqual(view.tabs[0].data.map((ticket) => ticket.id), ['TKT-REQUESTER', 'TKT-L1', 'TKT-L2', 'TKT-DRAFT']);
  assert.equal(view.hideTabs, true);
});
