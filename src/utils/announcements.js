import { richTextHasContent, richTextToPlainText, richTextValueToHtml } from './richText.js';

const SUPPORT_ROLES = new Set(['L1', 'L2']);

export const ANNOUNCEMENT_CONFIG_KEY = 'ANNOUNCEMENT_MANAGEMENT';

export const ANNOUNCEMENT_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  REJECTED: 'REJECTED',
  PUBLISHED: 'PUBLISHED',
  UPDATE_PENDING_APPROVAL: 'UPDATE_PENDING_APPROVAL',
  WITHDRAWN: 'WITHDRAWN'
};

export const ANNOUNCEMENT_STATUS_LABELS = {
  [ANNOUNCEMENT_STATUS.DRAFT]: '草稿',
  [ANNOUNCEMENT_STATUS.PENDING_APPROVAL]: '审批中',
  [ANNOUNCEMENT_STATUS.REJECTED]: '已驳回',
  [ANNOUNCEMENT_STATUS.PUBLISHED]: '已发布',
  [ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL]: '更新审批中',
  [ANNOUNCEMENT_STATUS.WITHDRAWN]: '已撤回'
};

export function normalizeAnnouncementInput(input = {}, context = {}) {
  const systemsByCode = new Map((context.systems || []).map((system) => {
    const code = normalizeCode(system.code || system.value);
    return [code, { code, name: String(system.name || system.label || code).trim() }];
  }));
  const adminById = new Map((context.adminUsers || []).map((user) => [String(user.id), user]));
  const supportById = new Map((context.supportUsers || []).map((user) => [String(user.id), user]));
  const affectedSystemCodes = [
    ...new Set(uniqueStrings(input.affectedSystemCodes || input.systemCodes)
      .map(normalizeCode)
      .filter(Boolean))
  ];
  const handlerIds = uniqueStrings(input.handlerIds);
  const approverId = String(input.approverId || input.approver?.id || '').trim();
  const faultDescriptionHtml = richTextValueToHtml(input.faultDescriptionDoc || input.faultDescriptionHtml || input.faultDescription);
  const progressHtml = richTextValueToHtml(input.progressDoc || input.progressHtml || input.progress);
  const display = input.display || {};

  return {
    title: String(input.title || '').trim(),
    affectedSystems: affectedSystemCodes
      .map((code) => systemsByCode.get(code) || { code, name: code })
      .filter((system) => system.code),
    faultDescriptionHtml,
    faultDescriptionText: richTextToPlainText(faultDescriptionHtml),
    progressHtml,
    progressText: richTextToPlainText(progressHtml),
    estimatedRecoveryAt: normalizeIsoTime(input.estimatedRecoveryAt),
    handlers: handlerIds
      .map((id) => supportById.get(id))
      .filter(Boolean)
      .map((user) => ({ id: user.id, name: user.name, role: user.role })),
    approver: adminById.has(approverId)
      ? actorFromUser(adminById.get(approverId), true)
      : approverId
        ? { id: approverId, name: '', role: '' }
        : null,
    display: {
      scrollSpeed: normalizePositiveNumber(display.scrollSpeed, 40),
      durationSeconds: normalizePositiveNumber(display.durationSeconds, 1800),
      pinned: display.pinned === true,
      visibleFrom: normalizeIsoTime(display.visibleFrom),
      visibleUntil: normalizeIsoTime(display.visibleUntil)
    }
  };
}

export function validateAnnouncementInput(input = {}, context = {}) {
  const value = normalizeAnnouncementInput(input, context);
  const errors = [];
  const requestedHandlerIds = uniqueStrings(input.handlerIds);
  const supportIds = new Set((context.supportUsers || [])
    .filter((user) => SUPPORT_ROLES.has(user.role))
    .map((user) => String(user.id)));

  if (!value.title) errors.push({ path: ['title'], message: '请输入公告标题' });
  if (!value.affectedSystems.length) errors.push({ path: ['affectedSystemCodes'], message: '请选择故障影响系统' });
  if (!richTextHasContent(value.faultDescriptionHtml)) errors.push({ path: ['faultDescriptionHtml'], message: '请输入故障描述' });
  if (!richTextHasContent(value.progressHtml)) errors.push({ path: ['progressHtml'], message: '请输入当前处置进度' });
  if (!value.estimatedRecoveryAt) errors.push({ path: ['estimatedRecoveryAt'], message: '请选择预计恢复时间' });
  if (!value.approver || value.approver.role !== 'ADMIN') errors.push({ path: ['approverId'], message: '审批人必须是管理员' });
  if (requestedHandlerIds.some((id) => !supportIds.has(id))) errors.push({ path: ['handlerIds'], message: '故障处置负责人必须是一线或二线支持' });
  if (isInvalidPositiveNumber(input.display?.scrollSpeed)) errors.push({ path: ['display', 'scrollSpeed'], message: '滚动速度必须大于 0' });
  if (isInvalidPositiveNumber(input.display?.durationSeconds)) errors.push({ path: ['display', 'durationSeconds'], message: '展示时长必须大于 0' });

  return { ok: errors.length === 0, errors, value };
}

export function buildAnnouncementSnapshot(value = {}) {
  return {
    title: value.title,
    affectedSystems: cloneObjectArray(value.affectedSystems),
    faultDescriptionHtml: value.faultDescriptionHtml || '',
    faultDescriptionText: value.faultDescriptionText || '',
    progressHtml: value.progressHtml || '',
    progressText: value.progressText || '',
    estimatedRecoveryAt: value.estimatedRecoveryAt || null,
    handlers: cloneObjectArray(value.handlers),
    approver: value.approver ? { ...value.approver } : null,
    display: {
      scrollSpeed: value.display?.scrollSpeed || 40,
      durationSeconds: value.display?.durationSeconds || 1800,
      pinned: value.display?.pinned === true,
      visibleFrom: value.display?.visibleFrom || null,
      visibleUntil: value.display?.visibleUntil || null
    }
  };
}

export function filterAnnouncements(announcements = [], filters = {}) {
  const keyword = normalizeSearch(filters.keyword);
  const status = String(filters.status || '').trim();
  const systemCode = normalizeCode(filters.systemCode);
  const fromTime = toTimestamp(filters.publishedFrom);
  const toTime = toTimestamp(filters.publishedTo);

  return (Array.isArray(announcements) ? announcements : []).filter((item) => {
    const searchText = normalizeSearch([
      item.title,
      item.publishedSnapshot?.title,
      item.pendingSnapshot?.title,
      item.faultDescriptionText,
      item.progressText,
      item.publishedSnapshot?.faultDescriptionText,
      item.publishedSnapshot?.progressText,
      item.pendingSnapshot?.faultDescriptionText,
      item.pendingSnapshot?.progressText
    ].filter(Boolean).join(' '));
    const publishedTime = toTimestamp(item.publishedAt);
    const systems = firstNonEmptyArray(
      item.affectedSystems,
      item.publishedSnapshot?.affectedSystems,
      item.pendingSnapshot?.affectedSystems
    );

    if (keyword && !searchText.includes(keyword)) return false;
    if (status && item.status !== status) return false;
    if (systemCode && !systems.some((system) => normalizeCode(system.code) === systemCode)) return false;
    if (fromTime && (!publishedTime || publishedTime < fromTime)) return false;
    if (toTime && (!publishedTime || publishedTime > toTime)) return false;
    return true;
  });
}

export function getActiveAnnouncements(announcements = [], now = new Date().toISOString()) {
  const nowTime = toTimestamp(now) || Date.now();
  return (Array.isArray(announcements) ? announcements : [])
    .filter((item) => item.status === ANNOUNCEMENT_STATUS.PUBLISHED || item.status === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL)
    .filter((item) => item.status !== ANNOUNCEMENT_STATUS.WITHDRAWN)
    .filter((item) => {
      const snapshot = item.publishedSnapshot;
      if (!snapshot) return false;
      const visibleFrom = toTimestamp(snapshot.display?.visibleFrom);
      const visibleUntil = toTimestamp(snapshot.display?.visibleUntil);
      if (visibleFrom && nowTime < visibleFrom) return false;
      if (visibleUntil && nowTime > visibleUntil) return false;
      return true;
    })
    .map((item) => ({ ...item, activeSnapshot: item.publishedSnapshot }))
    .sort((left, right) => {
      const leftPinned = left.activeSnapshot?.display?.pinned === true ? 1 : 0;
      const rightPinned = right.activeSnapshot?.display?.pinned === true ? 1 : 0;
      if (leftPinned !== rightPinned) return rightPinned - leftPinned;
      return (toTimestamp(right.publishedAt) || 0) - (toTimestamp(left.publishedAt) || 0);
    });
}

export function actorFromUser(user, includeRole = true) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name || user.username || user.id,
    ...(includeRole ? { role: user.role } : {})
  };
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeIsoTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function isInvalidPositiveNumber(value) {
  if (value === undefined) return false;
  const number = Number(value);
  return !Number.isFinite(number) || number <= 0;
}

function cloneObjectArray(value) {
  return Array.isArray(value) ? value.map((item) => ({ ...item })) : [];
}

function firstNonEmptyArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length > 0) || [];
}

function toTimestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase();
}
