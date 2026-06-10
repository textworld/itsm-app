import test from 'node:test';
import assert from 'node:assert/strict';

import {
  approveAnnouncement,
  createAnnouncement,
  rejectAnnouncement,
  submitAnnouncement,
  toggleAnnouncementPinned,
  updateAnnouncement,
  withdrawAnnouncement
} from '../announcementService.js';
import { ANNOUNCEMENT_STATUS } from '../../utils/announcements.js';

const now = '2026-06-10T15:00:00.000Z';
const admin = { id: 'u_admin_1', name: '系统管理员', role: 'ADMIN' };
const otherAdmin = { id: 'u_admin_2', name: '审批管理员', role: 'ADMIN' };
const l1 = { id: 'u_l1_1', name: '李一线', role: 'L1' };
const context = {
  systems: [{ value: 'ERP_CORE', label: 'ERP 核心系统' }],
  adminUsers: [admin, otherAdmin],
  supportUsers: [l1]
};
const input = {
  title: '支付网关异常',
  affectedSystemCodes: ['ERP_CORE'],
  faultDescriptionHtml: '<p>支付失败率升高</p>',
  progressHtml: '<p>已切换备用链路</p>',
  estimatedRecoveryAt: '2026-06-10T16:30:00.000Z',
  handlerIds: ['u_l1_1'],
  approverId: 'u_admin_2',
  display: { scrollSpeed: 40, durationSeconds: 1800, pinned: false }
};

test('createAnnouncement saves a draft with pending snapshot and operation log', () => {
  const result = createAnnouncement({ announcements: [] }, input, admin, context, { now });

  assert.equal(result.ok, true);
  assert.equal(result.announcement.status, ANNOUNCEMENT_STATUS.DRAFT);
  assert.equal(result.announcement.pendingSnapshot.title, '支付网关异常');
  assert.equal(result.announcement.operationLogs[0].action, 'CREATE');
  assert.equal(result.config.announcements.length, 1);
});

test('submit then approve publishes the pending snapshot and records approval', () => {
  const created = createAnnouncement({ announcements: [] }, input, admin, context, { now });
  const submitted = submitAnnouncement(created.config, created.announcement.id, admin, { now: '2026-06-10T15:05:00.000Z' });
  const approved = approveAnnouncement(submitted.config, created.announcement.id, otherAdmin, '同意发布', { now: '2026-06-10T15:10:00.000Z' });

  assert.equal(submitted.announcement.status, ANNOUNCEMENT_STATUS.PENDING_APPROVAL);
  assert.equal(approved.ok, true);
  assert.equal(approved.announcement.status, ANNOUNCEMENT_STATUS.PUBLISHED);
  assert.equal(approved.announcement.publishedSnapshot.title, '支付网关异常');
  assert.equal(approved.announcement.pendingSnapshot, null);
  assert.equal(approved.announcement.approvalRecords[0].action, 'APPROVE');
  assert.equal(approved.announcement.publishedAt, '2026-06-10T15:10:00.000Z');
});

test('only selected admin approver can approve or reject', () => {
  const created = createAnnouncement({ announcements: [] }, input, admin, context, { now });
  const submitted = submitAnnouncement(created.config, created.announcement.id, admin, { now });
  const rejected = approveAnnouncement(submitted.config, created.announcement.id, admin, '越权审批', { now });

  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, '仅指定审批人可审批');
});

test('rejectAnnouncement returns to rejected and keeps opinion', () => {
  const created = createAnnouncement({ announcements: [] }, input, admin, context, { now });
  const submitted = submitAnnouncement(created.config, created.announcement.id, admin, { now });
  const rejected = rejectAnnouncement(submitted.config, created.announcement.id, otherAdmin, '补充影响范围', { now });

  assert.equal(rejected.ok, true);
  assert.equal(rejected.announcement.status, ANNOUNCEMENT_STATUS.REJECTED);
  assert.equal(rejected.announcement.approvalRecords[0].opinion, '补充影响范围');
});

test('published update creates update pending approval while current published snapshot remains visible', () => {
  const created = createAnnouncement({ announcements: [] }, input, admin, context, { now });
  const submitted = submitAnnouncement(created.config, created.announcement.id, admin, { now });
  const approved = approveAnnouncement(submitted.config, created.announcement.id, otherAdmin, '同意', { now });
  const updated = updateAnnouncement(
    approved.config,
    created.announcement.id,
    { ...input, title: '支付网关异常更新', progressHtml: '<p>数据库连接已恢复</p>' },
    admin,
    context,
    { now: '2026-06-10T15:30:00.000Z' }
  );

  assert.equal(updated.ok, true);
  assert.equal(updated.announcement.status, ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL);
  assert.equal(updated.announcement.publishedSnapshot.title, '支付网关异常');
  assert.equal(updated.announcement.pendingSnapshot.title, '支付网关异常更新');
});

test('rejected published update restores active top-level fields from published snapshot', () => {
  const created = createAnnouncement({ announcements: [] }, input, admin, context, { now });
  const submitted = submitAnnouncement(created.config, created.announcement.id, admin, { now });
  const approved = approveAnnouncement(submitted.config, created.announcement.id, otherAdmin, '同意', { now });
  const updated = updateAnnouncement(
    approved.config,
    created.announcement.id,
    {
      ...input,
      title: '支付网关异常更新',
      affectedSystemCodes: ['ERP_CORE'],
      handlerIds: ['u_l1_1'],
      approverId: 'u_admin_2'
    },
    admin,
    context,
    { now: '2026-06-10T15:30:00.000Z' }
  );
  const rejected = rejectAnnouncement(updated.config, created.announcement.id, otherAdmin, '暂不更新', { now: '2026-06-10T15:35:00.000Z' });

  assert.equal(rejected.ok, true);
  assert.equal(rejected.announcement.status, ANNOUNCEMENT_STATUS.PUBLISHED);
  assert.equal(rejected.announcement.pendingSnapshot, null);
  assert.equal(rejected.announcement.publishedSnapshot.title, '支付网关异常');
  assert.equal(rejected.announcement.title, '支付网关异常');
  assert.deepEqual(rejected.announcement.affectedSystems, rejected.announcement.publishedSnapshot.affectedSystems);
  assert.deepEqual(rejected.announcement.handlers, rejected.announcement.publishedSnapshot.handlers);
  assert.deepEqual(rejected.announcement.approver, rejected.announcement.publishedSnapshot.approver);
});

test('withdraw and pin toggle record operation logs', () => {
  const created = createAnnouncement({ announcements: [] }, input, admin, context, { now });
  const submitted = submitAnnouncement(created.config, created.announcement.id, admin, { now });
  const approved = approveAnnouncement(submitted.config, created.announcement.id, otherAdmin, '同意', { now });
  const pinned = toggleAnnouncementPinned(approved.config, created.announcement.id, admin, true, { now: '2026-06-10T15:20:00.000Z' });
  const withdrawn = withdrawAnnouncement(pinned.config, created.announcement.id, admin, '故障恢复', { now: '2026-06-10T15:40:00.000Z' });

  assert.equal(pinned.announcement.publishedSnapshot.display.pinned, true);
  assert.equal(withdrawn.announcement.status, ANNOUNCEMENT_STATUS.WITHDRAWN);
  assert.equal(withdrawn.announcement.withdrawnAt, '2026-06-10T15:40:00.000Z');
  assert.ok(withdrawn.announcement.operationLogs.some((log) => log.action === 'WITHDRAW'));
});
