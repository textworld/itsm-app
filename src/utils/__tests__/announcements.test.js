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

test('normalizeAnnouncementInput deduplicates affected system codes after normalization', () => {
  const normalized = normalizeAnnouncementInput(
    { ...validInput, affectedSystemCodes: ['erp_core', 'ERP_CORE'] },
    { systems, adminUsers, supportUsers }
  );

  assert.deepEqual(normalized.affectedSystems, [{ code: 'ERP_CORE', name: 'ERP 核心系统' }]);
});

test('validateAnnouncementInput rejects non-numeric display values', () => {
  const result = validateAnnouncementInput(
    {
      ...validInput,
      display: {
        ...validInput.display,
        scrollSpeed: 'abc',
        durationSeconds: 'def'
      }
    },
    { systems, adminUsers, supportUsers }
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((item) => item.message), [
    '滚动速度必须大于 0',
    '展示时长必须大于 0'
  ]);
});

test('buildAnnouncementSnapshot returns the displayable content subset', () => {
  const normalized = normalizeAnnouncementInput(validInput, { systems, adminUsers, supportUsers });
  const snapshot = buildAnnouncementSnapshot(normalized);

  assert.equal(snapshot.title, '支付网关异常');
  assert.equal(snapshot.affectedSystems[0].code, 'ERP_CORE');
  assert.equal(snapshot.display.pinned, true);
  assert.equal(snapshot.approver.id, 'u_admin_1');
});

test('buildAnnouncementSnapshot is isolated from later normalized value mutation', () => {
  const normalized = normalizeAnnouncementInput(validInput, { systems, adminUsers, supportUsers });
  const snapshot = buildAnnouncementSnapshot(normalized);

  normalized.affectedSystems[0].name = '已变更系统';
  normalized.affectedSystems.push({ code: 'CRM', name: '客户中心' });
  normalized.handlers[0].name = '已变更负责人';
  normalized.handlers.push({ id: 'u_l2_1', name: '王二线', role: 'L2' });
  normalized.approver.name = '已变更审批人';
  normalized.display.pinned = false;
  normalized.display.scrollSpeed = 10;

  assert.deepEqual(snapshot.affectedSystems, [{ code: 'ERP_CORE', name: 'ERP 核心系统' }]);
  assert.deepEqual(snapshot.handlers, [{ id: 'u_l1_1', name: '李一线', role: 'L1' }]);
  assert.deepEqual(snapshot.approver, { id: 'u_admin_1', name: '系统管理员', role: 'ADMIN' });
  assert.equal(snapshot.display.pinned, true);
  assert.equal(snapshot.display.scrollSpeed, 40);
});

test('getActiveAnnouncements filters hidden rows and sorts pinned first then latest published', () => {
  const displayableSnapshot = buildAnnouncementSnapshot(normalizeAnnouncementInput(validInput, { systems, adminUsers, supportUsers }));
  const active = getActiveAnnouncements(
    [
      {
        id: 'old',
        status: ANNOUNCEMENT_STATUS.PUBLISHED,
        publishedAt: '2026-06-10T10:00:00.000Z',
        publishedSnapshot: { ...displayableSnapshot, display: { pinned: false, visibleFrom: null, visibleUntil: null } }
      },
      {
        id: 'pinned',
        status: ANNOUNCEMENT_STATUS.PUBLISHED,
        publishedAt: '2026-06-10T09:00:00.000Z',
        publishedSnapshot: { ...displayableSnapshot, display: { pinned: true, visibleFrom: null, visibleUntil: null } }
      },
      {
        id: 'missing-snapshot',
        status: ANNOUNCEMENT_STATUS.PUBLISHED,
        publishedAt: '2026-06-10T11:00:00.000Z',
        publishedSnapshot: null
      },
      {
        id: 'future-visible',
        status: ANNOUNCEMENT_STATUS.PUBLISHED,
        publishedAt: '2026-06-10T11:00:00.000Z',
        publishedSnapshot: { ...displayableSnapshot, display: { pinned: false, visibleFrom: '2026-06-10T13:00:00.000Z', visibleUntil: null } }
      },
      {
        id: 'expired',
        status: ANNOUNCEMENT_STATUS.PUBLISHED,
        publishedAt: '2026-06-10T11:00:00.000Z',
        publishedSnapshot: { ...displayableSnapshot, display: { pinned: false, visibleFrom: null, visibleUntil: '2026-06-10T11:59:59.999Z' } }
      },
      {
        id: 'withdrawn',
        status: ANNOUNCEMENT_STATUS.WITHDRAWN,
        publishedAt: '2026-06-10T12:00:00.000Z',
        publishedSnapshot: displayableSnapshot
      }
    ],
    '2026-06-10T12:00:00.000Z'
  );

  assert.deepEqual(active.map((item) => item.id), ['pinned', 'old']);
});

test('filterAnnouncements searches snapshot body text and falls back through snapshot systems', () => {
  const rows = [
    {
      id: 'item-body',
      title: '中性标题',
      status: ANNOUNCEMENT_STATUS.PUBLISHED,
      affectedSystems: [{ code: 'ERP_CORE', name: 'ERP 核心系统' }],
      faultDescriptionText: '行内故障描述命中',
      progressText: '行内处置进度',
      publishedAt: '2026-06-10T10:00:00.000Z'
    },
    {
      id: 'published-snapshot-body',
      title: '中性标题',
      status: ANNOUNCEMENT_STATUS.PUBLISHED,
      affectedSystems: [],
      publishedSnapshot: {
        title: '发布快照标题',
        affectedSystems: [{ code: 'CRM', name: '客户中心' }],
        faultDescriptionText: '发布快照故障描述命中',
        progressText: '发布快照处置进度'
      },
      publishedAt: '2026-06-10T11:00:00.000Z'
    },
    {
      id: 'pending-snapshot-body',
      title: '中性标题',
      status: ANNOUNCEMENT_STATUS.REJECTED,
      affectedSystems: [],
      publishedSnapshot: {
        title: '已发布快照标题',
        affectedSystems: []
      },
      pendingSnapshot: {
        title: '待审快照标题',
        affectedSystems: [{ code: 'ERP_CORE', name: 'ERP 核心系统' }],
        faultDescriptionText: '待审快照故障描述',
        progressText: '待审快照进度命中'
      },
      publishedAt: null
    }
  ];

  assert.deepEqual(
    filterAnnouncements(rows, { keyword: '行内故障' }).map((item) => item.id),
    ['item-body']
  );
  assert.deepEqual(
    filterAnnouncements(rows, { keyword: '发布快照故障' }).map((item) => item.id),
    ['published-snapshot-body']
  );
  assert.deepEqual(
    filterAnnouncements(rows, { keyword: '待审快照进度' }).map((item) => item.id),
    ['pending-snapshot-body']
  );
  assert.deepEqual(
    filterAnnouncements(rows, { systemCode: 'CRM' }).map((item) => item.id),
    ['published-snapshot-body']
  );
  assert.deepEqual(
    filterAnnouncements(rows, { systemCode: 'ERP_CORE' }).map((item) => item.id),
    ['item-body', 'pending-snapshot-body']
  );
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
    filterAnnouncements(rows, { keyword: '支付' }).map((item) => item.id),
    ['a1']
  );
  assert.deepEqual(
    filterAnnouncements(rows, { status: ANNOUNCEMENT_STATUS.PUBLISHED }).map((item) => item.id),
    ['a1']
  );
  assert.deepEqual(
    filterAnnouncements(rows, { systemCode: 'CRM' }).map((item) => item.id),
    ['a2']
  );
  assert.deepEqual(
    filterAnnouncements(rows, {
      publishedFrom: '2026-06-10T00:00:00.000Z',
      publishedTo: '2026-06-10T23:59:59.999Z'
    }).map((item) => item.id),
    ['a1']
  );
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
