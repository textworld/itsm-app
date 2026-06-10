import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANNOUNCEMENT_STATUS,
  buildAnnouncementSnapshot,
  filterAnnouncements,
  getActiveAnnouncements,
  normalizeAnnouncementInput,
  validateAnnouncementInput
} from '../announcements.js';

const systems = [
  { value: 'ERP_CORE', code: 'ERP_CORE', label: 'ERP 核心系统', name: 'ERP 核心系统' },
  { value: 'CRM', code: 'CRM', label: '客户中心', name: '客户中心' }
];

const adminUsers = [
  { id: 'u_admin_1', name: '系统管理员', role: 'ADMIN' }
];

const supportUsers = [
  { id: 'u_l1_1', name: '李一线', role: 'L1' },
  { id: 'u_l2_1', name: '王二线', role: 'L2' }
];

const validInput = {
  title: '支付网关异常',
  affectedSystemCodes: ['erp_core'],
  faultDescriptionHtml: '<p>支付失败率升高</p>',
  progressHtml: '<p>已切换备用链路</p>',
  estimatedRecoveryAt: '2026-06-10T16:30:00.000Z',
  handlerIds: ['u_l1_1'],
  approverId: 'u_admin_1',
  display: {
    scrollSpeed: 40,
    durationSeconds: 1800,
    pinned: true,
    visibleFrom: '2026-06-10T15:00:00.000Z',
    visibleUntil: '2026-06-10T18:00:00.000Z'
  }
};

test('validateAnnouncementInput rejects required fields and invalid role selections', () => {
  const result = validateAnnouncementInput(
    {
      title: '',
      affectedSystemCodes: [],
      faultDescriptionHtml: '<p> </p>',
      progressHtml: '',
      estimatedRecoveryAt: '',
      handlerIds: ['u_admin_1'],
      approverId: 'u_l1_1',
      display: { scrollSpeed: 0, durationSeconds: -1 }
    },
    { systems, adminUsers: supportUsers, supportUsers: adminUsers }
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((item) => item.message), [
    '请输入公告标题',
    '请选择故障影响系统',
    '请输入故障描述',
    '请输入当前处置进度',
    '请选择预计恢复时间',
    '审批人必须是管理员',
    '故障处置负责人必须是一线或二线支持',
    '滚动速度必须大于 0',
    '展示时长必须大于 0'
  ]);
});

test('normalizeAnnouncementInput resolves systems, handlers, approver and rich text plain text', () => {
  const result = validateAnnouncementInput(validInput, { systems, adminUsers, supportUsers });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.affectedSystems, [{ code: 'ERP_CORE', name: 'ERP 核心系统' }]);
  assert.deepEqual(result.value.handlers, [{ id: 'u_l1_1', name: '李一线', role: 'L1' }]);
  assert.deepEqual(result.value.approver, { id: 'u_admin_1', name: '系统管理员', role: 'ADMIN' });
  assert.equal(result.value.faultDescriptionText, '支付失败率升高');
  assert.equal(result.value.progressText, '已切换备用链路');
});

test('buildAnnouncementSnapshot returns the displayable content subset', () => {
  const normalized = normalizeAnnouncementInput(validInput, { systems, adminUsers, supportUsers });
  const snapshot = buildAnnouncementSnapshot(normalized);

  assert.equal(snapshot.title, '支付网关异常');
  assert.equal(snapshot.affectedSystems[0].code, 'ERP_CORE');
  assert.equal(snapshot.display.pinned, true);
  assert.equal(snapshot.approver.id, 'u_admin_1');
});

test('getActiveAnnouncements filters hidden rows and sorts pinned first then latest published', () => {
  const active = getActiveAnnouncements(
    [
      {
        id: 'old',
        status: ANNOUNCEMENT_STATUS.PUBLISHED,
        publishedAt: '2026-06-10T10:00:00.000Z',
        publishedSnapshot: { ...buildAnnouncementSnapshot(normalizeAnnouncementInput(validInput, { systems, adminUsers, supportUsers })), display: { pinned: false, visibleFrom: null, visibleUntil: null } }
      },
      {
        id: 'pinned',
        status: ANNOUNCEMENT_STATUS.PUBLISHED,
        publishedAt: '2026-06-10T09:00:00.000Z',
        publishedSnapshot: { ...buildAnnouncementSnapshot(normalizeAnnouncementInput(validInput, { systems, adminUsers, supportUsers })), display: { pinned: true, visibleFrom: null, visibleUntil: null } }
      },
      {
        id: 'withdrawn',
        status: ANNOUNCEMENT_STATUS.WITHDRAWN,
        publishedAt: '2026-06-10T12:00:00.000Z',
        publishedSnapshot: buildAnnouncementSnapshot(normalizeAnnouncementInput(validInput, { systems, adminUsers, supportUsers }))
      }
    ],
    '2026-06-10T12:00:00.000Z'
  );

  assert.deepEqual(active.map((item) => item.id), ['pinned', 'old']);
});

test('filterAnnouncements searches keyword, status, system and publish date range', () => {
  const rows = [
    {
      id: 'a1',
      title: '支付网关异常',
      status: ANNOUNCEMENT_STATUS.PUBLISHED,
      affectedSystems: [{ code: 'ERP_CORE', name: 'ERP 核心系统' }],
      publishedAt: '2026-06-10T10:00:00.000Z'
    },
    {
      id: 'a2',
      title: '客户中心抖动',
      status: ANNOUNCEMENT_STATUS.REJECTED,
      affectedSystems: [{ code: 'CRM', name: '客户中心' }],
      publishedAt: null
    }
  ];

  assert.deepEqual(
    filterAnnouncements(rows, {
      keyword: '支付',
      status: ANNOUNCEMENT_STATUS.PUBLISHED,
      systemCode: 'ERP_CORE',
      publishedFrom: '2026-06-10T00:00:00.000Z',
      publishedTo: '2026-06-10T23:59:59.999Z'
    }).map((item) => item.id),
    ['a1']
  );
});
