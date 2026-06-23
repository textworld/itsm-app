import { randomUUID } from 'node:crypto';

import {
  ANNOUNCEMENT_STATUS,
  actorFromUser,
  buildAnnouncementSnapshot,
  validateAnnouncementInput
} from '../utils/announcements.js';

const PENDING_STATUSES = new Set([
  ANNOUNCEMENT_STATUS.PENDING_APPROVAL,
  ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
]);

const SUBMITTABLE_STATUSES = new Set([
  ANNOUNCEMENT_STATUS.DRAFT,
  ANNOUNCEMENT_STATUS.REJECTED
]);

const EDITABLE_STATUSES = new Set([
  ANNOUNCEMENT_STATUS.DRAFT,
  ANNOUNCEMENT_STATUS.REJECTED,
  ANNOUNCEMENT_STATUS.PUBLISHED
]);

const WITHDRAWABLE_STATUSES = new Set([
  ANNOUNCEMENT_STATUS.PUBLISHED,
  ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
]);

const PINNABLE_STATUSES = new Set([
  ANNOUNCEMENT_STATUS.PUBLISHED,
  ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
]);

export function createAnnouncement(config = {}, input = {}, user, context = {}, options = {}) {
  const validation = validateAnnouncementInput(input, context);
  if (!validation.ok) return failure('公告内容校验失败', { errors: validation.errors, config });

  const snapshot = buildAnnouncementSnapshot(validation.value);
  if (!canCreate(user, snapshot)) return failure('无权创建公告', { config });

  const timestamp = resolveNow(options);
  const submit = input.submit === true;
  const actor = actorFromUser(user);
  const announcement = {
    id: options.id || `announcement_${randomUUID()}`,
    status: submit ? ANNOUNCEMENT_STATUS.PENDING_APPROVAL : ANNOUNCEMENT_STATUS.DRAFT,
    title: snapshot.title,
    affectedSystems: cloneArray(snapshot.affectedSystems),
    handlers: cloneArray(snapshot.handlers),
    approver: cloneObject(snapshot.approver),
    creator: actor,
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: submit ? timestamp : null,
    publishedAt: null,
    withdrawnAt: null,
    pendingSnapshot: snapshot,
    publishedSnapshot: null,
    approvalRecords: [],
    operationLogs: [
      buildOperationLog('CREATE', user, timestamp, '创建公告'),
      ...(submit ? [buildOperationLog('SUBMIT', user, timestamp, '提交审批')] : [])
    ]
  };

  return success(replaceAnnouncement(config, announcement), announcement);
}

export function updateAnnouncement(config = {}, announcementId, input = {}, user, context = {}, options = {}) {
  const current = findAnnouncement(config, announcementId);
  if (!current) return failure('公告不存在', { config });
  if (!EDITABLE_STATUSES.has(current.status)) return failure('当前状态不可编辑', { config, announcement: current });
  if (!canEdit(user, current)) return failure('无权编辑公告', { config, announcement: current });

  const validation = validateAnnouncementInput(input, context);
  if (!validation.ok) return failure('公告内容校验失败', { errors: validation.errors, config, announcement: current });

  const timestamp = resolveNow(options);
  const snapshot = buildAnnouncementSnapshot(validation.value);
  const isPublishedUpdate = current.status === ANNOUNCEMENT_STATUS.PUBLISHED
    || current.status === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL;
  if (isPublishedUpdate && !current.publishedSnapshot) return failure('公告无已发布内容', { config, announcement: current });

  const summarySnapshot = isPublishedUpdate ? current.publishedSnapshot : snapshot;
  const submit = input.submit === true;
  const nextStatus = isPublishedUpdate
    ? ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
    : submit
      ? ANNOUNCEMENT_STATUS.PENDING_APPROVAL
      : ANNOUNCEMENT_STATUS.DRAFT;
  const action = isPublishedUpdate ? 'UPDATE' : 'EDIT';
  const logs = [
    buildOperationLog(action, user, timestamp, isPublishedUpdate ? '编辑已发布公告' : '编辑公告'),
    ...(!isPublishedUpdate && submit ? [buildOperationLog('SUBMIT', user, timestamp, '提交审批')] : [])
  ];

  const updated = {
    ...cloneAnnouncement(current),
    status: nextStatus,
    title: summarySnapshot.title,
    affectedSystems: cloneArray(summarySnapshot.affectedSystems),
    handlers: cloneArray(summarySnapshot.handlers),
    approver: cloneObject(summarySnapshot.approver),
    updatedAt: timestamp,
    submittedAt: nextStatus === ANNOUNCEMENT_STATUS.PENDING_APPROVAL ? timestamp : current.submittedAt || null,
    pendingSnapshot: snapshot,
    operationLogs: [...(current.operationLogs || []).map(cloneObject), ...logs]
  };

  return success(replaceAnnouncement(config, updated), updated);
}

export function submitAnnouncement(config = {}, announcementId, user, options = {}) {
  const current = findAnnouncement(config, announcementId);
  if (!current) return failure('公告不存在', { config });
  if (!SUBMITTABLE_STATUSES.has(current.status)) return failure('当前状态不可提交审批', { config, announcement: current });
  if (!canEdit(user, current)) return failure('无权提交公告', { config, announcement: current });
  if (!current.pendingSnapshot) return failure('公告无待审批内容', { config, announcement: current });

  const timestamp = resolveNow(options);
  const updated = {
    ...cloneAnnouncement(current),
    status: ANNOUNCEMENT_STATUS.PENDING_APPROVAL,
    updatedAt: timestamp,
    submittedAt: timestamp,
    operationLogs: [
      ...(current.operationLogs || []).map(cloneObject),
      buildOperationLog('SUBMIT', user, timestamp, '提交审批')
    ]
  };

  return success(replaceAnnouncement(config, updated), updated);
}

export function approveAnnouncement(config = {}, announcementId, user, opinion = '', options = {}) {
  const current = findAnnouncement(config, announcementId);
  if (!current) return failure('公告不存在', { config });
  if (!PENDING_STATUSES.has(current.status)) return failure('当前状态不可审批', { config, announcement: current });
  if (!canApprove(user, current)) return failure('仅指定审批人可审批', { config, announcement: current });
  if (!current.pendingSnapshot) return failure('公告无待审批内容', { config, announcement: current });
  const isPublishedUpdate = current.status === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL;
  if (isPublishedUpdate && !current.publishedSnapshot) return failure('公告无已发布内容', { config, announcement: current });

  const timestamp = resolveNow(options);
  const approvalRecord = buildApprovalRecord('APPROVE', user, opinion, timestamp);
  const publishedSnapshot = cloneSnapshot(current.pendingSnapshot);
  if (isPublishedUpdate) {
    publishedSnapshot.display = {
      ...(publishedSnapshot.display || {}),
      pinned: current.publishedSnapshot.display?.pinned === true
    };
  }
  const updated = {
    ...cloneAnnouncement(current),
    status: ANNOUNCEMENT_STATUS.PUBLISHED,
    title: current.pendingSnapshot.title,
    affectedSystems: cloneArray(current.pendingSnapshot.affectedSystems),
    handlers: cloneArray(current.pendingSnapshot.handlers),
    approver: cloneObject(current.pendingSnapshot.approver),
    updatedAt: timestamp,
    publishedAt: timestamp,
    pendingSnapshot: null,
    publishedSnapshot,
    approvalRecords: [...(current.approvalRecords || []).map(cloneObject), approvalRecord],
    operationLogs: [
      ...(current.operationLogs || []).map(cloneObject),
      buildOperationLog('APPROVE', user, timestamp, opinion || '审批通过')
    ]
  };

  return success(replaceAnnouncement(config, updated), updated);
}

export function rejectAnnouncement(config = {}, announcementId, user, opinion = '', options = {}) {
  const current = findAnnouncement(config, announcementId);
  if (!current) return failure('公告不存在', { config });
  if (!PENDING_STATUSES.has(current.status)) return failure('当前状态不可驳回', { config, announcement: current });
  if (!canApprove(user, current)) return failure('仅指定审批人可审批', { config, announcement: current });
  if (!current.pendingSnapshot) return failure('公告无待审批内容', { config, announcement: current });

  const timestamp = resolveNow(options);
  const isPublishedUpdate = current.status === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL;
  const activeSnapshot = isPublishedUpdate ? current.publishedSnapshot : null;
  if (isPublishedUpdate && !activeSnapshot) return failure('公告无已发布内容', { config, announcement: current });

  const approvalRecord = buildApprovalRecord('REJECT', user, opinion, timestamp);
  const updated = {
    ...cloneAnnouncement(current),
    status: isPublishedUpdate ? ANNOUNCEMENT_STATUS.PUBLISHED : ANNOUNCEMENT_STATUS.REJECTED,
    ...(activeSnapshot ? {
      title: activeSnapshot.title,
      affectedSystems: cloneArray(activeSnapshot.affectedSystems),
      handlers: cloneArray(activeSnapshot.handlers),
      approver: cloneObject(activeSnapshot.approver)
    } : {}),
    updatedAt: timestamp,
    pendingSnapshot: isPublishedUpdate ? null : cloneSnapshot(current.pendingSnapshot),
    approvalRecords: [...(current.approvalRecords || []).map(cloneObject), approvalRecord],
    operationLogs: [
      ...(current.operationLogs || []).map(cloneObject),
      buildOperationLog('REJECT', user, timestamp, opinion || '审批驳回')
    ]
  };

  return success(replaceAnnouncement(config, updated), updated);
}

export function withdrawAnnouncement(config = {}, announcementId, user, reason = '', options = {}) {
  const current = findAnnouncement(config, announcementId);
  if (!current) return failure('公告不存在', { config });
  if (!isAdmin(user)) return failure('仅管理员可撤回公告', { config, announcement: current });
  if (!WITHDRAWABLE_STATUSES.has(current.status)) return failure('当前状态不可撤回', { config, announcement: current });

  const timestamp = resolveNow(options);
  const updated = {
    ...cloneAnnouncement(current),
    status: ANNOUNCEMENT_STATUS.WITHDRAWN,
    updatedAt: timestamp,
    withdrawnAt: timestamp,
    pendingSnapshot: null,
    operationLogs: [
      ...(current.operationLogs || []).map(cloneObject),
      buildOperationLog('WITHDRAW', user, timestamp, reason || '撤回公告')
    ]
  };

  return success(replaceAnnouncement(config, updated), updated);
}

export function toggleAnnouncementPinned(config = {}, announcementId, user, pinned, options = {}) {
  const current = findAnnouncement(config, announcementId);
  if (!current) return failure('公告不存在', { config });
  if (!isAdmin(user)) return failure('仅管理员可置顶公告', { config, announcement: current });
  if (!PINNABLE_STATUSES.has(current.status)) return failure('当前状态不可置顶', { config, announcement: current });
  if (!current.publishedSnapshot) return failure('公告未发布不可置顶', { config, announcement: current });

  const timestamp = resolveNow(options);
  const publishedSnapshot = cloneSnapshot(current.publishedSnapshot);
  publishedSnapshot.display = {
    ...(publishedSnapshot.display || {}),
    pinned: pinned === true
  };

  const updated = {
    ...cloneAnnouncement(current),
    updatedAt: timestamp,
    publishedSnapshot,
    operationLogs: [
      ...(current.operationLogs || []).map(cloneObject),
      buildOperationLog('PIN_TOGGLE', user, timestamp, pinned === true ? '置顶公告' : '取消置顶')
    ]
  };

  return success(replaceAnnouncement(config, updated), updated);
}

function canCreate(user, snapshot) {
  return isAdmin(user) || isHandler(user, snapshot);
}

function canEdit(user, announcement) {
  return isAdmin(user)
    || isHandler(user, announcement.pendingSnapshot)
    || isHandler(user, announcement.publishedSnapshot)
    || isHandler(user, announcement);
}

function canApprove(user, announcement) {
  const approver = announcement.pendingSnapshot?.approver || announcement.approver;
  return isAdmin(user) && Boolean(approver?.id) && String(user.id) === String(approver.id);
}

function isAdmin(user) {
  return user?.role === 'ADMIN';
}

function isHandler(user, value) {
  return Boolean(user?.id) && (value?.handlers || []).some((handler) => String(handler.id) === String(user.id));
}

function findAnnouncement(config, announcementId) {
  return (Array.isArray(config?.announcements) ? config.announcements : [])
    .find((announcement) => String(announcement.id) === String(announcementId));
}

function replaceAnnouncement(config = {}, announcement) {
  const announcements = Array.isArray(config.announcements) ? config.announcements : [];
  const index = announcements.findIndex((item) => String(item.id) === String(announcement.id));
  const nextAnnouncements = announcements.map(cloneAnnouncement);
  if (index >= 0) {
    nextAnnouncements[index] = announcement;
  } else {
    nextAnnouncements.push(announcement);
  }
  return {
    ...config,
    announcements: nextAnnouncements
  };
}

function buildApprovalRecord(action, user, opinion, timestamp) {
  return {
    id: `approval_${randomUUID()}`,
    action,
    operator: actorFromUser(user),
    opinion: String(opinion || '').trim(),
    handledAt: timestamp
  };
}

function buildOperationLog(action, user, timestamp, message) {
  return {
    id: `log_${randomUUID()}`,
    action,
    operator: actorFromUser(user),
    message,
    createdAt: timestamp
  };
}

function resolveNow(options = {}) {
  return options.now || new Date().toISOString();
}

function success(config, announcement) {
  return { ok: true, config, announcement };
}

function failure(reason, extra = {}) {
  return { ok: false, reason, ...extra };
}

function cloneAnnouncement(announcement = {}) {
  return {
    ...announcement,
    affectedSystems: cloneArray(announcement.affectedSystems),
    handlers: cloneArray(announcement.handlers),
    approver: cloneObject(announcement.approver),
    creator: cloneObject(announcement.creator),
    pendingSnapshot: cloneSnapshot(announcement.pendingSnapshot),
    publishedSnapshot: cloneSnapshot(announcement.publishedSnapshot),
    approvalRecords: cloneArray(announcement.approvalRecords),
    operationLogs: cloneArray(announcement.operationLogs)
  };
}

function cloneSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    ...snapshot,
    affectedSystems: cloneArray(snapshot.affectedSystems),
    handlers: cloneArray(snapshot.handlers),
    approver: cloneObject(snapshot.approver),
    display: { ...(snapshot.display || {}) }
  };
}

function cloneArray(value) {
  return Array.isArray(value) ? value.map(cloneObject) : [];
}

function cloneObject(value) {
  return value && typeof value === 'object' ? { ...value } : value;
}
