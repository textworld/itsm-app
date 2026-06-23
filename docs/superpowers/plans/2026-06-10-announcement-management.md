# Announcement Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build fault announcement management with admin approval, published yellow-banner display, update approval, withdrawal, history filters, approval records, and operation logs.

**Architecture:** Keep announcement rules in pure utility/service modules, persist the announcement config through the existing `app_configs` store pattern, expose thin Next route handlers, and mount a focused Ant Design admin view plus a global top banner component. Use the current project API convention `/api/admin/*` even though the design spec used `/api/config/admin/*`; the current code and tests already use `/api/admin/systems`, `/api/admin/schedules`, and related routes.

**Tech Stack:** Next.js App Router, React, Ant Design, Node built-in test runner, SQLite/JSON fallback through `src/server/db.js`, existing Tiptap rich text helpers.

---

## File Structure

- Create `src/utils/announcements.js`
  - Owns status constants, normalization, validation, filtering, and active-banner selection.
- Create `src/utils/__tests__/announcements.test.js`
  - Unit tests for validation, pending update behavior, and active sorting/filtering.
- Create `src/server/announcementService.js`
  - Owns state transitions: create, submit, approve, reject, update, withdraw, and pin toggle against a config object.
- Create `src/server/__tests__/announcementService.test.js`
  - Unit tests for workflow state transitions and logs.
- Modify `src/server/adminConfigStore.js`
  - Add `ANNOUNCEMENT_CONFIG_KEY`, admin/support user option helpers, persisted announcement config helpers, and wrappers around `announcementService`.
- Create `app/api/admin/announcements/route.js`
  - `GET` list/options and `POST` create/save/submit.
- Create `app/api/admin/announcements/[id]/route.js`
  - `PUT` edit draft/rejected/published update and `GET` detail if useful for the UI.
- Create `app/api/admin/announcements/[id]/submit/route.js`
  - Submit draft/rejected announcements.
- Create `app/api/admin/announcements/[id]/approve/route.js`
  - Approve pending new/update announcement.
- Create `app/api/admin/announcements/[id]/reject/route.js`
  - Reject pending new/update announcement.
- Create `app/api/admin/announcements/[id]/withdraw/route.js`
  - Withdraw visible or update-pending announcement.
- Create `app/api/admin/announcements/[id]/pin/route.js`
  - Toggle pinned status for published/update-pending announcements.
- Create `app/api/announcements/active/route.js`
  - Protected active-announcement endpoint for the top banner.
- Create `src/server/__tests__/announcementRoutes.test.js`
  - Route tests for authentication, permissions, approval, rejection, withdrawal, active filtering.
- Create `app/(protected)/announcements/page.jsx`
  - Admin-protected page rendering `AdminAnnouncementsPage`.
- Create `src/views/AdminAnnouncements/index.jsx`
  - Ant Design list, filters, create/edit drawer, detail drawer, approval modal, reject/withdraw modals.
- Create `src/views/AdminAnnouncements/__tests__/adminAnnouncementsView.test.js`
  - Source test ensuring the admin view calls the right APIs and renders required controls.
- Create `src/components/Layout/AnnouncementBanner.jsx`
  - Fetches active announcements and renders yellow scrolling/pinned banner.
- Modify `src/components/Layout/AppLayout.jsx`
  - Add menu entry, selected key, page title, and mount `AnnouncementBanner`.
- Modify `src/components/Layout/__tests__/appLayout.test.js`
  - Assert navigation and banner mount.
- Modify `src/index.css`
  - Add yellow banner and admin announcement classes.

---

## Task 1: Pure Announcement Utility

**Files:**
- Create: `src/utils/announcements.js`
- Create: `src/utils/__tests__/announcements.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/announcements.test.js`:

```javascript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test src/utils/__tests__/announcements.test.js
```

Expected: FAIL with an import/module error because `src/utils/announcements.js` does not exist.

- [ ] **Step 3: Add the minimal utility implementation**

Create `src/utils/announcements.js`:

```javascript
import { richTextHasContent, richTextToPlainText, richTextValueToHtml } from './richText.js';

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
  const affectedSystemCodes = uniqueStrings(input.affectedSystemCodes || input.systemCodes).map(normalizeCode);
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
  const supportIds = new Set((context.supportUsers || []).map((user) => String(user.id)));

  if (!value.title) errors.push({ path: ['title'], message: '请输入公告标题' });
  if (!value.affectedSystems.length) errors.push({ path: ['affectedSystemCodes'], message: '请选择故障影响系统' });
  if (!richTextHasContent(value.faultDescriptionHtml)) errors.push({ path: ['faultDescriptionHtml'], message: '请输入故障描述' });
  if (!richTextHasContent(value.progressHtml)) errors.push({ path: ['progressHtml'], message: '请输入当前处置进度' });
  if (!value.estimatedRecoveryAt) errors.push({ path: ['estimatedRecoveryAt'], message: '请选择预计恢复时间' });
  if (!value.approver || value.approver.role !== 'ADMIN') errors.push({ path: ['approverId'], message: '审批人必须是管理员' });
  if (requestedHandlerIds.some((id) => !supportIds.has(id))) errors.push({ path: ['handlerIds'], message: '故障处置负责人必须是一线或二线支持' });
  if (Number(input.display?.scrollSpeed) <= 0) errors.push({ path: ['display', 'scrollSpeed'], message: '滚动速度必须大于 0' });
  if (Number(input.display?.durationSeconds) <= 0) errors.push({ path: ['display', 'durationSeconds'], message: '展示时长必须大于 0' });

  return { ok: errors.length === 0, errors, value };
}

export function buildAnnouncementSnapshot(value = {}) {
  return {
    title: value.title,
    affectedSystems: value.affectedSystems || [],
    faultDescriptionHtml: value.faultDescriptionHtml || '',
    faultDescriptionText: value.faultDescriptionText || '',
    progressHtml: value.progressHtml || '',
    progressText: value.progressText || '',
    estimatedRecoveryAt: value.estimatedRecoveryAt || null,
    handlers: value.handlers || [],
    approver: value.approver || null,
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
      item.progressText
    ].filter(Boolean).join(' '));
    const publishedTime = toTimestamp(item.publishedAt);
    const systems = item.affectedSystems || item.publishedSnapshot?.affectedSystems || item.pendingSnapshot?.affectedSystems || [];

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

function toTimestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase();
}
```

- [ ] **Step 4: Run the utility test to verify it passes**

Run:

```bash
node --test src/utils/__tests__/announcements.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/announcements.js src/utils/__tests__/announcements.test.js
git commit -m "feat: add announcement validation utilities"
```

---

## Task 2: Announcement Workflow Service

**Files:**
- Create: `src/server/announcementService.js`
- Create: `src/server/__tests__/announcementService.test.js`

- [ ] **Step 1: Write the failing service test**

Create `src/server/__tests__/announcementService.test.js`:

```javascript
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
```

- [ ] **Step 2: Run the service test to verify it fails**

Run:

```bash
node --test src/server/__tests__/announcementService.test.js
```

Expected: FAIL with an import/module error because `src/server/announcementService.js` does not exist.

- [ ] **Step 3: Add the service implementation**

Create `src/server/announcementService.js`:

```javascript
import {
  ANNOUNCEMENT_STATUS,
  actorFromUser,
  buildAnnouncementSnapshot,
  validateAnnouncementInput
} from '../utils/announcements.js';

export function createAnnouncement(config = {}, input = {}, actor, context = {}, options = {}) {
  const validation = validateAnnouncementInput(input, context);
  if (!validation.ok) return { ok: false, reason: '公告校验失败', errors: validation.errors };
  if (!canCreate(actor, validation.value)) return { ok: false, reason: '无公告创建权限' };

  const now = resolveNow(options);
  const announcement = {
    id: options.id || `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    status: input.submit ? ANNOUNCEMENT_STATUS.PENDING_APPROVAL : ANNOUNCEMENT_STATUS.DRAFT,
    creator: actorFromUser(actor),
    approver: validation.value.approver,
    handlers: validation.value.handlers,
    affectedSystems: validation.value.affectedSystems,
    pendingSnapshot: buildAnnouncementSnapshot(validation.value),
    publishedSnapshot: null,
    publishedAt: null,
    withdrawnAt: null,
    createdAt: now,
    updatedAt: now,
    approvalRecords: [],
    operationLogs: [buildLog('CREATE', actor, '创建公告', now)]
  };
  if (input.submit) announcement.operationLogs.push(buildLog('SUBMIT', actor, '提交审批', now));

  return replaceAnnouncement(config, announcement);
}

export function updateAnnouncement(config = {}, id, input = {}, actor, context = {}, options = {}) {
  const current = findAnnouncement(config, id);
  if (!current) return { ok: false, reason: '公告不存在' };
  if (current.status === ANNOUNCEMENT_STATUS.WITHDRAWN) return { ok: false, reason: '已撤回公告不可编辑' };
  if (!canEdit(actor, current)) return { ok: false, reason: '无公告编辑权限' };

  const validation = validateAnnouncementInput(input, context);
  if (!validation.ok) return { ok: false, reason: '公告校验失败', errors: validation.errors };
  const now = resolveNow(options);
  const nextStatus = current.status === ANNOUNCEMENT_STATUS.PUBLISHED || current.status === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
    ? ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
    : ANNOUNCEMENT_STATUS.DRAFT;
  const next = {
    ...current,
    status: input.submit ? statusAfterSubmit(nextStatus) : nextStatus,
    approver: validation.value.approver,
    handlers: validation.value.handlers,
    affectedSystems: validation.value.affectedSystems,
    pendingSnapshot: buildAnnouncementSnapshot(validation.value),
    updatedAt: now,
    operationLogs: [
      ...(current.operationLogs || []),
      buildLog(nextStatus === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL ? 'UPDATE' : 'EDIT', actor, '编辑公告', now),
      ...(input.submit ? [buildLog('SUBMIT', actor, '提交审批', now)] : [])
    ]
  };
  return replaceAnnouncement(config, next);
}

export function submitAnnouncement(config = {}, id, actor, options = {}) {
  const current = findAnnouncement(config, id);
  if (!current) return { ok: false, reason: '公告不存在' };
  if (!canEdit(actor, current)) return { ok: false, reason: '无公告提交权限' };
  if (![ANNOUNCEMENT_STATUS.DRAFT, ANNOUNCEMENT_STATUS.REJECTED].includes(current.status)) {
    return { ok: false, reason: '当前状态不可提交审批' };
  }
  const now = resolveNow(options);
  return replaceAnnouncement(config, {
    ...current,
    status: ANNOUNCEMENT_STATUS.PENDING_APPROVAL,
    updatedAt: now,
    operationLogs: [...(current.operationLogs || []), buildLog('SUBMIT', actor, '提交审批', now)]
  });
}

export function approveAnnouncement(config = {}, id, actor, opinion = '', options = {}) {
  const current = findAnnouncement(config, id);
  if (!current) return { ok: false, reason: '公告不存在' };
  if (!canApprove(actor, current)) return { ok: false, reason: '仅指定审批人可审批' };
  if (![ANNOUNCEMENT_STATUS.PENDING_APPROVAL, ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL].includes(current.status)) {
    return { ok: false, reason: '当前状态不可审批' };
  }
  const now = resolveNow(options);
  return replaceAnnouncement(config, {
    ...current,
    status: ANNOUNCEMENT_STATUS.PUBLISHED,
    publishedSnapshot: current.pendingSnapshot,
    pendingSnapshot: null,
    publishedAt: now,
    updatedAt: now,
    approvalRecords: [...(current.approvalRecords || []), buildApprovalRecord('APPROVE', actor, opinion, now)],
    operationLogs: [...(current.operationLogs || []), buildLog('APPROVE', actor, opinion || '审批通过', now)]
  });
}

export function rejectAnnouncement(config = {}, id, actor, opinion = '', options = {}) {
  const current = findAnnouncement(config, id);
  if (!current) return { ok: false, reason: '公告不存在' };
  if (!canApprove(actor, current)) return { ok: false, reason: '仅指定审批人可审批' };
  if (![ANNOUNCEMENT_STATUS.PENDING_APPROVAL, ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL].includes(current.status)) {
    return { ok: false, reason: '当前状态不可驳回' };
  }
  const now = resolveNow(options);
  return replaceAnnouncement(config, {
    ...current,
    status: current.publishedSnapshot ? ANNOUNCEMENT_STATUS.PUBLISHED : ANNOUNCEMENT_STATUS.REJECTED,
    pendingSnapshot: current.publishedSnapshot ? null : current.pendingSnapshot,
    updatedAt: now,
    approvalRecords: [...(current.approvalRecords || []), buildApprovalRecord('REJECT', actor, opinion, now)],
    operationLogs: [...(current.operationLogs || []), buildLog('REJECT', actor, opinion || '审批驳回', now)]
  });
}

export function withdrawAnnouncement(config = {}, id, actor, reason = '', options = {}) {
  const current = findAnnouncement(config, id);
  if (!current) return { ok: false, reason: '公告不存在' };
  if (actor?.role !== 'ADMIN') return { ok: false, reason: '无公告撤回权限' };
  if (![ANNOUNCEMENT_STATUS.PUBLISHED, ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL].includes(current.status)) {
    return { ok: false, reason: '当前状态不可撤回' };
  }
  const now = resolveNow(options);
  return replaceAnnouncement(config, {
    ...current,
    status: ANNOUNCEMENT_STATUS.WITHDRAWN,
    withdrawnAt: now,
    updatedAt: now,
    operationLogs: [...(current.operationLogs || []), buildLog('WITHDRAW', actor, reason || '撤回公告', now)]
  });
}

export function toggleAnnouncementPinned(config = {}, id, actor, pinned, options = {}) {
  const current = findAnnouncement(config, id);
  if (!current) return { ok: false, reason: '公告不存在' };
  if (actor?.role !== 'ADMIN') return { ok: false, reason: '无公告置顶权限' };
  if (!current.publishedSnapshot) return { ok: false, reason: '未发布公告不可置顶' };
  const now = resolveNow(options);
  const publishedSnapshot = {
    ...current.publishedSnapshot,
    display: { ...(current.publishedSnapshot.display || {}), pinned: pinned === true }
  };
  return replaceAnnouncement(config, {
    ...current,
    publishedSnapshot,
    updatedAt: now,
    operationLogs: [...(current.operationLogs || []), buildLog('PIN', actor, pinned ? '置顶公告' : '取消置顶公告', now)]
  });
}

function findAnnouncement(config, id) {
  return (config.announcements || []).find((item) => item.id === id) || null;
}

function replaceAnnouncement(config, announcement) {
  const announcements = config.announcements || [];
  const exists = announcements.some((item) => item.id === announcement.id);
  const nextConfig = {
    ...config,
    announcements: exists
      ? announcements.map((item) => (item.id === announcement.id ? announcement : item))
      : [announcement, ...announcements],
    updatedAt: announcement.updatedAt,
    updatedBy: announcement.operationLogs?.at(-1)?.operator || null
  };
  return { ok: true, config: nextConfig, announcement };
}

function statusAfterSubmit(status) {
  return status === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
    ? ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
    : ANNOUNCEMENT_STATUS.PENDING_APPROVAL;
}

function canCreate(actor, value) {
  if (actor?.role === 'ADMIN') return true;
  return value.handlers.some((handler) => handler.id === actor?.id);
}

function canEdit(actor, announcement) {
  if (actor?.role === 'ADMIN') return true;
  return (announcement.handlers || []).some((handler) => handler.id === actor?.id);
}

function canApprove(actor, announcement) {
  return actor?.role === 'ADMIN' && announcement.approver?.id === actor.id;
}

function buildApprovalRecord(action, actor, opinion, handledAt) {
  return {
    id: `apr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    operator: actorFromUser(actor),
    opinion: String(opinion || '').trim(),
    handledAt
  };
}

function buildLog(action, actor, message, createdAt) {
  return {
    id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    operator: actorFromUser(actor),
    message: String(message || '').trim(),
    createdAt
  };
}

function resolveNow(options = {}) {
  return options.now || new Date().toISOString();
}
```

- [ ] **Step 4: Run service tests**

Run:

```bash
node --test src/server/__tests__/announcementService.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/announcementService.js src/server/__tests__/announcementService.test.js
git commit -m "feat: add announcement workflow service"
```

---

## Task 3: Persistence Helpers And Route APIs

**Files:**
- Modify: `src/server/adminConfigStore.js`
- Create: `app/api/admin/announcements/route.js`
- Create: `app/api/admin/announcements/[id]/route.js`
- Create: `app/api/admin/announcements/[id]/submit/route.js`
- Create: `app/api/admin/announcements/[id]/approve/route.js`
- Create: `app/api/admin/announcements/[id]/reject/route.js`
- Create: `app/api/admin/announcements/[id]/withdraw/route.js`
- Create: `app/api/admin/announcements/[id]/pin/route.js`
- Create: `app/api/announcements/active/route.js`
- Create: `src/server/__tests__/announcementRoutes.test.js`

- [ ] **Step 1: Write failing route tests**

Create `src/server/__tests__/announcementRoutes.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as adminAnnouncementsGet, POST as adminAnnouncementsPost } from '../../../app/api/admin/announcements/route.js';
import { PUT as adminAnnouncementPut } from '../../../app/api/admin/announcements/[id]/route.js';
import { POST as announcementSubmitPost } from '../../../app/api/admin/announcements/[id]/submit/route.js';
import { POST as announcementApprovePost } from '../../../app/api/admin/announcements/[id]/approve/route.js';
import { POST as announcementRejectPost } from '../../../app/api/admin/announcements/[id]/reject/route.js';
import { POST as announcementWithdrawPost } from '../../../app/api/admin/announcements/[id]/withdraw/route.js';
import { POST as announcementPinPost } from '../../../app/api/admin/announcements/[id]/pin/route.js';
import { GET as activeAnnouncementsGet } from '../../../app/api/announcements/active/route.js';
import { reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

const body = {
  title: '支付网关异常',
  affectedSystemCodes: ['ERP_CORE'],
  faultDescriptionHtml: '<p>支付失败率升高</p>',
  progressHtml: '<p>已切换备用链路</p>',
  estimatedRecoveryAt: '2026-06-10T16:30:00.000Z',
  handlerIds: ['u_l1_1'],
  approverId: 'u_admin_1',
  display: { scrollSpeed: 40, durationSeconds: 1800, pinned: false }
};

test('announcement admin route rejects unauthenticated users and returns option lists', async () => {
  const unauthenticated = await adminAnnouncementsGet(buildRequest({ userId: null }));
  assert.equal(unauthenticated.status, 401);

  const response = await adminAnnouncementsGet(buildRequest());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.announcements));
  assert.ok(payload.systems.some((item) => item.value === 'ERP_CORE'));
  assert.ok(payload.adminUsers.every((user) => user.role === 'ADMIN'));
  assert.ok(payload.supportUsers.every((user) => ['L1', 'L2'].includes(user.role)));
});

test('announcement route creates, submits, approves, pins and exposes active announcements', async () => {
  const createResponse = await adminAnnouncementsPost(buildRequest({ body: { ...body, submit: true } }));
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.equal(createPayload.announcement.status, 'PENDING_APPROVAL');

  const approveResponse = await announcementApprovePost(
    buildRequest({ body: { opinion: '同意发布' } }),
    { params: Promise.resolve({ id: createPayload.announcement.id }) }
  );
  const approvePayload = await approveResponse.json();

  assert.equal(approveResponse.status, 200);
  assert.equal(approvePayload.announcement.status, 'PUBLISHED');

  const pinResponse = await announcementPinPost(
    buildRequest({ body: { pinned: true } }),
    { params: Promise.resolve({ id: createPayload.announcement.id }) }
  );
  assert.equal(pinResponse.status, 200);

  const activeResponse = await activeAnnouncementsGet(buildRequest({ userId: 'u_requester_1' }));
  const activePayload = await activeResponse.json();
  assert.equal(activeResponse.status, 200);
  assert.equal(activePayload.announcements[0].id, createPayload.announcement.id);
  assert.equal(activePayload.announcements[0].activeSnapshot.display.pinned, true);
});

test('selected approver rule is enforced', async () => {
  const createResponse = await adminAnnouncementsPost(buildRequest({ body: { ...body, submit: true } }));
  const createPayload = await createResponse.json();

  const forbidden = await announcementApprovePost(
    buildRequest({ userId: 'u_admin_2', body: { opinion: '非指定审批人' } }),
    { params: Promise.resolve({ id: createPayload.announcement.id }) }
  );
  const payload = await forbidden.json();

  assert.equal(forbidden.status, 403);
  assert.equal(payload.reason, '仅指定审批人可审批');
});

test('reject, update and withdraw routes record state transitions', async () => {
  const createResponse = await adminAnnouncementsPost(buildRequest({ body: { ...body, submit: true } }));
  const createPayload = await createResponse.json();
  const rejectResponse = await announcementRejectPost(
    buildRequest({ body: { opinion: '补充故障范围' } }),
    { params: Promise.resolve({ id: createPayload.announcement.id }) }
  );
  const rejectPayload = await rejectResponse.json();

  assert.equal(rejectResponse.status, 200);
  assert.equal(rejectPayload.announcement.status, 'REJECTED');

  const updateResponse = await adminAnnouncementPut(
    buildRequest({ body: { ...body, title: '支付网关异常更新', submit: true } }),
    { params: Promise.resolve({ id: createPayload.announcement.id }) }
  );
  assert.equal(updateResponse.status, 200);

  const approveResponse = await announcementApprovePost(
    buildRequest({ body: { opinion: '同意' } }),
    { params: Promise.resolve({ id: createPayload.announcement.id }) }
  );
  assert.equal(approveResponse.status, 200);

  const withdrawResponse = await announcementWithdrawPost(
    buildRequest({ body: { reason: '故障恢复' } }),
    { params: Promise.resolve({ id: createPayload.announcement.id }) }
  );
  const withdrawPayload = await withdrawResponse.json();

  assert.equal(withdrawResponse.status, 200);
  assert.equal(withdrawPayload.announcement.status, 'WITHDRAWN');
});

function buildRequest({ userId = 'u_admin_1', body: requestBody = {}, url = 'http://localhost/api/test' } = {}) {
  return {
    url,
    cookies: {
      get(name) {
        if (name !== 'itsm_session_user_id' || !userId) return undefined;
        return { value: userId };
      }
    },
    async json() {
      return requestBody;
    }
  };
}
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
node --test src/server/__tests__/announcementRoutes.test.js
```

Expected: FAIL with import/module errors because the announcement route files do not exist.

- [ ] **Step 3: Add persistence helpers to `adminConfigStore.js`**

Modify `src/server/adminConfigStore.js` imports to include:

```javascript
import {
  ANNOUNCEMENT_CONFIG_KEY,
  filterAnnouncements,
  getActiveAnnouncements
} from '../utils/announcements.js';
import {
  approveAnnouncement,
  createAnnouncement,
  rejectAnnouncement,
  submitAnnouncement,
  toggleAnnouncementPinned,
  updateAnnouncement,
  withdrawAnnouncement
} from './announcementService.js';
```

Add these exports after `listL1Users()`:

```javascript
export function listAdminUsers() {
  const db = getDb();
  return db
    .prepare('SELECT data FROM users ORDER BY username ASC')
    .all()
    .map(parseRow)
    .filter((user) => user?.role === ROLES.ADMIN)
    .map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department
    }));
}

export function listSupportHandlerUsers() {
  const db = getDb();
  return db
    .prepare('SELECT data FROM users ORDER BY username ASC')
    .all()
    .map(parseRow)
    .filter((user) => user?.role === ROLES.L1 || user?.role === ROLES.L2)
    .map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department
    }));
}
```

Add these announcement exports near the other app config helpers:

```javascript
export function getAnnouncementConfig() {
  const db = getDb();
  const row = db.prepare('SELECT data FROM app_configs WHERE key = ?').get(ANNOUNCEMENT_CONFIG_KEY);
  return parseRow(row) || {
    announcements: [],
    updatedAt: null,
    updatedBy: null
  };
}

export function listAnnouncements(filters = {}) {
  return filterAnnouncements(getAnnouncementConfig().announcements || [], filters);
}

export function listActiveAnnouncements(now = new Date().toISOString()) {
  return getActiveAnnouncements(getAnnouncementConfig().announcements || [], now);
}

export function getAnnouncementOptions() {
  return {
    systems: getSystemConfig({ visibleOnly: true }).systems,
    adminUsers: listAdminUsers(),
    supportUsers: listSupportHandlerUsers()
  };
}

export function createAnnouncementConfig(input, user) {
  return persistAnnouncementResult(createAnnouncement(getAnnouncementConfig(), input, user, getAnnouncementOptions()));
}

export function updateAnnouncementConfig(id, input, user) {
  return persistAnnouncementResult(updateAnnouncement(getAnnouncementConfig(), id, input, user, getAnnouncementOptions()));
}

export function submitAnnouncementConfig(id, user) {
  return persistAnnouncementResult(submitAnnouncement(getAnnouncementConfig(), id, user));
}

export function approveAnnouncementConfig(id, user, opinion) {
  return persistAnnouncementResult(approveAnnouncement(getAnnouncementConfig(), id, user, opinion));
}

export function rejectAnnouncementConfig(id, user, opinion) {
  return persistAnnouncementResult(rejectAnnouncement(getAnnouncementConfig(), id, user, opinion));
}

export function withdrawAnnouncementConfig(id, user, reason) {
  return persistAnnouncementResult(withdrawAnnouncement(getAnnouncementConfig(), id, user, reason));
}

export function setAnnouncementPinnedConfig(id, user, pinned) {
  return persistAnnouncementResult(toggleAnnouncementPinned(getAnnouncementConfig(), id, user, pinned));
}

function persistAnnouncementResult(result) {
  if (!result.ok) return result;
  const config = {
    ...result.config,
    updatedAt: result.announcement.updatedAt,
    updatedBy: actorFromUser(result.announcement.operationLogs?.at(-1)?.operator)
  };
  const db = getDb();
  db.prepare(`
    INSERT INTO app_configs (key, updated_at, data)
    VALUES (@key, @updated_at, @data)
    ON CONFLICT(key) DO UPDATE SET
      updated_at = excluded.updated_at,
      data = excluded.data
  `).run({
    key: ANNOUNCEMENT_CONFIG_KEY,
    updated_at: config.updatedAt || nowIso(),
    data: JSON.stringify(config)
  });
  return { ...result, config };
}
```

- [ ] **Step 4: Add route files**

Create `app/api/admin/announcements/route.js`:

```javascript
import { NextResponse } from 'next/server.js';
import {
  createAnnouncementConfig,
  getAnnouncementOptions,
  listAnnouncements
} from '../../../../src/server/adminConfigStore.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

function authResponse(user) {
  if (!user) return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  if (user.role !== 'ADMIN' && user.role !== 'L1' && user.role !== 'L2') {
    return NextResponse.json({ ok: false, reason: '无公告管理权限' }, { status: 403 });
  }
  return null;
}

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  const auth = authResponse(user);
  if (auth) return auth;
  const url = new URL(request.url);
  const filters = {
    keyword: url.searchParams.get('keyword') || '',
    status: url.searchParams.get('status') || '',
    systemCode: url.searchParams.get('systemCode') || '',
    publishedFrom: url.searchParams.get('publishedFrom') || '',
    publishedTo: url.searchParams.get('publishedTo') || ''
  };
  return NextResponse.json({ ok: true, announcements: listAnnouncements(filters), ...getAnnouncementOptions() });
}

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  const auth = authResponse(user);
  if (auth) return auth;
  const input = await request.json();
  const result = createAnnouncementConfig(input, user);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
```

Create `app/api/admin/announcements/[id]/route.js`:

```javascript
import { NextResponse } from 'next/server.js';
import { getAnnouncementConfig, updateAnnouncementConfig } from '../../../../../src/server/adminConfigStore.js';
import { getSessionUserFromRequest } from '../../../../../src/server/session.js';

export async function GET(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  const { id } = await params;
  const announcement = (getAnnouncementConfig().announcements || []).find((item) => item.id === id);
  return NextResponse.json(announcement ? { ok: true, announcement } : { ok: false, reason: '公告不存在' }, { status: announcement ? 200 : 404 });
}

export async function PUT(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  const { id } = await params;
  const input = await request.json();
  const result = updateAnnouncementConfig(id, input, user);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
```

Create action route files with this pattern, changing the imported function and request field:

```javascript
import { NextResponse } from 'next/server.js';
import { approveAnnouncementConfig } from '../../../../../../src/server/adminConfigStore.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';

export async function POST(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const result = approveAnnouncementConfig(id, user, body.opinion || '');
  const status = result.ok ? 200 : result.reason === '仅指定审批人可审批' ? 403 : 400;
  return NextResponse.json(result, { status });
}
```

For each action route:

- `submit/route.js`: import `submitAnnouncementConfig`, call `submitAnnouncementConfig(id, user)`, body is not required.
- `approve/route.js`: import `approveAnnouncementConfig`, use `body.opinion`.
- `reject/route.js`: import `rejectAnnouncementConfig`, use `body.opinion`.
- `withdraw/route.js`: import `withdrawAnnouncementConfig`, use `body.reason`.
- `pin/route.js`: import `setAnnouncementPinnedConfig`, use `body.pinned === true`.

Create `app/api/announcements/active/route.js`:

```javascript
import { NextResponse } from 'next/server.js';
import { listActiveAnnouncements } from '../../../../src/server/adminConfigStore.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  return NextResponse.json({ ok: true, announcements: listActiveAnnouncements() });
}
```

- [ ] **Step 5: Run route tests**

Run:

```bash
node --test src/server/__tests__/announcementRoutes.test.js
```

Expected: PASS.

- [ ] **Step 6: Run related existing route tests**

Run:

```bash
node --test src/server/__tests__/adminConfigRoutes.test.js src/server/__tests__/adminConfigStore.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/adminConfigStore.js app/api/admin/announcements app/api/announcements/active src/server/__tests__/announcementRoutes.test.js
git commit -m "feat: add announcement admin APIs"
```

---

## Task 4: Admin Page And Protected Route

**Files:**
- Create: `app/(protected)/announcements/page.jsx`
- Create: `src/views/AdminAnnouncements/index.jsx`
- Create: `src/views/AdminAnnouncements/__tests__/adminAnnouncementsView.test.js`

- [ ] **Step 1: Write failing source tests**

Create `src/views/AdminAnnouncements/__tests__/adminAnnouncementsView.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.jsx', import.meta.url), 'utf8');
const routeSource = fs.readFileSync(new URL('../../../../app/(protected)/announcements/page.jsx', import.meta.url), 'utf8');

test('announcement admin view uses announcement APIs and required management controls', () => {
  assert.match(source, /\/api\/admin\/announcements/);
  assert.match(source, /公告管理/);
  assert.match(source, /发布公告/);
  assert.match(source, /搜索公告标题或内容/);
  assert.match(source, /按故障系统筛选/);
  assert.match(source, /按公告状态筛选/);
  assert.match(source, /故障影响范围/);
  assert.match(source, /故障描述/);
  assert.match(source, /当前处置进度/);
  assert.match(source, /预计恢复时间/);
  assert.match(source, /审批人/);
  assert.match(source, /故障处置负责人/);
  assert.match(source, /滚动速度/);
  assert.match(source, /展示时长/);
  assert.match(source, /置顶/);
  assert.match(source, /审批记录/);
  assert.match(source, /操作日志/);
});

test('announcement protected route requires admin role and renders view', () => {
  assert.match(routeSource, /AdminAnnouncementsPage/);
  assert.match(routeSource, /ROLES\.ADMIN/);
  assert.match(routeSource, /getLoginRedirectHref\('\/announcements'\)/);
});
```

- [ ] **Step 2: Run source tests to verify failure**

Run:

```bash
node --test src/views/AdminAnnouncements/__tests__/adminAnnouncementsView.test.js
```

Expected: FAIL because route and view files do not exist.

- [ ] **Step 3: Add the protected route**

Create `app/(protected)/announcements/page.jsx`:

```jsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminAnnouncementsPage from '../../../src/views/AdminAnnouncements/index.jsx';
import { ROLES } from '../../../src/constants/roles.js';
import { getLoginRedirectHref } from '../../../src/server/protectedRoute.js';
import { getSessionUserFromRequest } from '../../../src/server/session.js';

export default async function AnnouncementsPage() {
  const user = getSessionUserFromRequest({ cookies: await cookies() });
  if (!user) {
    redirect(getLoginRedirectHref('/announcements'));
  }
  if (user.role !== ROLES.ADMIN) {
    redirect('/tickets');
  }
  return (
    <div className="admin-config-page">
      <AdminAnnouncementsPage />
    </div>
  );
}
```

- [ ] **Step 4: Add the admin view**

Create `src/views/AdminAnnouncements/index.jsx` with a compact Ant Design implementation:

```jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';
import { CheckOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import RichTextEditor from '../../components/common/RichTextEditor.jsx';
import { ANNOUNCEMENT_STATUS, ANNOUNCEMENT_STATUS_LABELS } from '../../utils/announcements.js';
import { formatDateTime } from '../../utils/format.js';

const API_URL = '/api/admin/announcements';
const { RangePicker } = DatePicker;

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  return { response, data };
}

export default function AdminAnnouncementsPage() {
  const { message, modal } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [announcements, setAnnouncements] = useState([]);
  const [systems, setSystems] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [supportUsers, setSupportUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ keyword: '', status: '', systemCode: '', range: null });
  const [editing, setEditing] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const search = new URLSearchParams();
      if (filters.keyword) search.set('keyword', filters.keyword);
      if (filters.status) search.set('status', filters.status);
      if (filters.systemCode) search.set('systemCode', filters.systemCode);
      if (filters.range?.[0]) search.set('publishedFrom', filters.range[0].toISOString());
      if (filters.range?.[1]) search.set('publishedTo', filters.range[1].toISOString());
      const { response, data } = await requestJson(`${API_URL}?${search.toString()}`);
      if (!response.ok || data?.ok === false) throw new Error(data?.reason || '加载公告失败');
      setAnnouncements(data.announcements || []);
      setSystems(data.systems || []);
      setAdminUsers(data.adminUsers || []);
      setSupportUsers(data.supportUsers || []);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || '加载公告失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      title: '',
      affectedSystemCodes: [],
      faultDescriptionHtml: '',
      progressHtml: '',
      estimatedRecoveryAt: null,
      handlerIds: [],
      approverId: undefined,
      display: { scrollSpeed: 40, durationSeconds: 1800, pinned: false }
    });
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    const snapshot = record.pendingSnapshot || record.publishedSnapshot || record;
    setEditing(record);
    form.setFieldsValue({
      title: snapshot.title,
      affectedSystemCodes: (snapshot.affectedSystems || []).map((item) => item.code),
      faultDescriptionHtml: snapshot.faultDescriptionHtml,
      progressHtml: snapshot.progressHtml,
      estimatedRecoveryAt: snapshot.estimatedRecoveryAt,
      handlerIds: (snapshot.handlers || []).map((item) => item.id),
      approverId: snapshot.approver?.id || record.approver?.id,
      display: snapshot.display || { scrollSpeed: 40, durationSeconds: 1800, pinned: false }
    });
    setDrawerOpen(true);
  };

  const save = async (submit = false) => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const { response, data } = await requestJson(editing ? `${API_URL}/${editing.id}` : API_URL, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ ...values, submit })
      });
      if (!response.ok || data?.ok === false) throw new Error(formatErrors(data, '保存公告失败'));
      message.success(submit ? '公告已提交审批' : '公告已保存');
      setDrawerOpen(false);
      await loadData();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.message || '保存公告失败');
    } finally {
      setSaving(false);
    }
  };

  const postAction = async (record, action, body = {}) => {
    const { response, data } = await requestJson(`${API_URL}/${record.id}/${action}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (!response.ok || data?.ok === false) throw new Error(data?.reason || '操作失败');
    await loadData();
    return data;
  };

  const approve = (record) => {
    modal.confirm({
      title: '审批通过',
      content: '确认发布该公告？',
      onOk: async () => {
        await postAction(record, 'approve', { opinion: '同意发布' });
        message.success('公告已发布');
      }
    });
  };

  const reject = (record) => {
    Modal.confirm({
      title: '审批驳回',
      content: '确认驳回该公告？',
      onOk: async () => {
        await postAction(record, 'reject', { opinion: '请修改后重新提交' });
        message.success('公告已驳回');
      }
    });
  };

  const withdraw = (record) => {
    modal.confirm({
      title: '撤回公告',
      content: '撤回后小黄条将立即消失。',
      onOk: async () => {
        await postAction(record, 'withdraw', { reason: '手动撤回' });
        message.success('公告已撤回');
      }
    });
  };

  const columns = [
    { title: '状态', dataIndex: 'status', width: 120, render: (status) => <Tag>{ANNOUNCEMENT_STATUS_LABELS[status] || status}</Tag> },
    { title: '公告标题', dataIndex: 'title', render: (_, record) => <Button type="link" onClick={() => setDetail(record)}>{record.pendingSnapshot?.title || record.publishedSnapshot?.title || record.title}</Button> },
    { title: '故障影响范围', render: (_, record) => (record.affectedSystems || record.publishedSnapshot?.affectedSystems || record.pendingSnapshot?.affectedSystems || []).map((item) => item.name).join('、') || '-' },
    { title: '审批人', render: (_, record) => record.approver?.name || record.pendingSnapshot?.approver?.name || '-' },
    { title: '预计恢复时间', render: (_, record) => formatDateTime(record.pendingSnapshot?.estimatedRecoveryAt || record.publishedSnapshot?.estimatedRecoveryAt) },
    { title: '发布人', render: (_, record) => record.creator?.name || '-' },
    { title: '置顶', width: 90, render: (_, record) => <Switch checked={record.publishedSnapshot?.display?.pinned === true} disabled={!record.publishedSnapshot} onChange={(checked) => postAction(record, 'pin', { pinned: checked })} /> },
    {
      title: '操作',
      width: 220,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(record)}>详情</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          {(record.status === ANNOUNCEMENT_STATUS.PENDING_APPROVAL || record.status === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL) && <Button size="small" icon={<CheckOutlined />} onClick={() => approve(record)}>审批</Button>}
          {(record.status === ANNOUNCEMENT_STATUS.PENDING_APPROVAL || record.status === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL) && <Button size="small" onClick={() => reject(record)}>驳回</Button>}
          {(record.status === ANNOUNCEMENT_STATUS.PUBLISHED || record.status === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL) && <Button size="small" danger icon={<StopOutlined />} onClick={() => withdraw(record)}>撤回</Button>}
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="middle" className="admin-announcements-page">
      <div className="admin-config-toolbar">
        <Typography.Title level={4} style={{ margin: 0 }}>公告管理</Typography.Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>发布公告</Button>
        </Space>
      </div>
      {error && <Alert type="error" showIcon message={error} />}
      <Space wrap>
        <Input allowClear placeholder="搜索公告标题或内容" value={filters.keyword} onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))} style={{ width: 240 }} />
        <Select allowClear placeholder="按故障系统筛选" value={filters.systemCode || undefined} onChange={(value) => setFilters((prev) => ({ ...prev, systemCode: value || '' }))} options={systems.map((item) => ({ value: item.value, label: item.label }))} style={{ width: 180 }} />
        <Select allowClear placeholder="按公告状态筛选" value={filters.status || undefined} onChange={(value) => setFilters((prev) => ({ ...prev, status: value || '' }))} options={Object.entries(ANNOUNCEMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))} style={{ width: 180 }} />
        <RangePicker onChange={(range) => setFilters((prev) => ({ ...prev, range }))} />
        <Button onClick={loadData}>查询</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={announcements} loading={loading} pagination={{ pageSize: 10 }} />

      <Drawer title={editing ? '编辑公告' : '发布公告'} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={760} extra={<Space><Button onClick={() => save(false)} loading={saving}>保存草稿</Button><Button type="primary" onClick={() => save(true)} loading={saving}>提交审批</Button></Space>}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入公告标题' }]}><Input /></Form.Item>
          <Form.Item name="affectedSystemCodes" label="故障影响范围" rules={[{ required: true, message: '请选择故障影响范围' }]}><Select mode="multiple" options={systems.map((item) => ({ value: item.value, label: item.label }))} /></Form.Item>
          <Form.Item name="faultDescriptionHtml" label="故障描述" rules={[{ required: true, message: '请输入故障描述' }]}><RichTextEditor placeholder="请输入故障描述" /></Form.Item>
          <Form.Item name="progressHtml" label="当前处置进度" rules={[{ required: true, message: '请输入当前处置进度' }]}><RichTextEditor placeholder="请输入当前处置进度" /></Form.Item>
          <Form.Item name="estimatedRecoveryAt" label="预计恢复时间" rules={[{ required: true, message: '请选择预计恢复时间' }]}><Input placeholder="2026-06-10T16:30:00.000Z" /></Form.Item>
          <Form.Item name="handlerIds" label="故障处置负责人"><Select mode="multiple" options={supportUsers.map((item) => ({ value: item.id, label: `${item.name}(${item.role})` }))} /></Form.Item>
          <Form.Item name="approverId" label="审批人" rules={[{ required: true, message: '请选择审批人' }]}><Select options={adminUsers.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name={['display', 'scrollSpeed']} label="滚动速度"><InputNumber min={1} addonAfter="px/s" /></Form.Item>
          <Form.Item name={['display', 'durationSeconds']} label="展示时长"><InputNumber min={1} addonAfter="秒" /></Form.Item>
          <Form.Item name={['display', 'pinned']} label="置顶" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Drawer>

      <Drawer title="公告详情" open={Boolean(detail)} onClose={() => setDetail(null)} width={720}>
        {detail && <AnnouncementDetail announcement={detail} />}
      </Drawer>
    </Space>
  );
}

function AnnouncementDetail({ announcement }) {
  const snapshot = announcement.pendingSnapshot || announcement.publishedSnapshot || {};
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="公告标题">{snapshot.title || '-'}</Descriptions.Item>
        <Descriptions.Item label="状态">{ANNOUNCEMENT_STATUS_LABELS[announcement.status] || announcement.status}</Descriptions.Item>
        <Descriptions.Item label="故障影响范围">{(snapshot.affectedSystems || []).map((item) => item.name).join('、') || '-'}</Descriptions.Item>
        <Descriptions.Item label="预计恢复时间">{formatDateTime(snapshot.estimatedRecoveryAt)}</Descriptions.Item>
        <Descriptions.Item label="审批人">{snapshot.approver?.name || announcement.approver?.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="故障描述"><div className="message-rich-content" dangerouslySetInnerHTML={{ __html: snapshot.faultDescriptionHtml || '-' }} /></Descriptions.Item>
        <Descriptions.Item label="当前处置进度"><div className="message-rich-content" dangerouslySetInnerHTML={{ __html: snapshot.progressHtml || '-' }} /></Descriptions.Item>
      </Descriptions>
      <Typography.Title level={5}>审批记录</Typography.Title>
      {(announcement.approvalRecords || []).map((record) => <div key={record.id}>{record.action} · {record.operator?.name} · {record.opinion} · {formatDateTime(record.handledAt)}</div>)}
      <Typography.Title level={5}>操作日志</Typography.Title>
      {(announcement.operationLogs || []).map((record) => <div key={record.id}>{record.action} · {record.operator?.name} · {record.message} · {formatDateTime(record.createdAt)}</div>)}
    </Space>
  );
}

function formatErrors(data, fallback) {
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.map((item) => item.message).join('；');
  return data?.reason || fallback;
}
```

- [ ] **Step 5: Run source tests**

Run:

```bash
node --test src/views/AdminAnnouncements/__tests__/adminAnnouncementsView.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/announcements/page.jsx" src/views/AdminAnnouncements
git commit -m "feat: add announcement admin page"
```

---

## Task 5: Global Top Yellow Banner And Navigation

**Files:**
- Create: `src/components/Layout/AnnouncementBanner.jsx`
- Modify: `src/components/Layout/AppLayout.jsx`
- Modify: `src/components/Layout/__tests__/appLayout.test.js`
- Modify: `src/index.css`

- [ ] **Step 1: Write failing layout tests**

Modify `src/components/Layout/__tests__/appLayout.test.js` by appending:

```javascript
test('administrator menu includes announcement management and layout mounts announcement banner', () => {
  assert.match(appLayoutSource, /NotificationOutlined/);
  assert.match(appLayoutSource, /href="\/announcements"/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/announcements'\)/);
  assert.match(appLayoutSource, /公告管理/);
  assert.match(appLayoutSource, /<AnnouncementBanner \/>/);
  assert.match(globalCssSource, /\.announcement-banner/);
});
```

- [ ] **Step 2: Run layout test to verify failure**

Run:

```bash
node --test src/components/Layout/__tests__/appLayout.test.js
```

Expected: FAIL because `AnnouncementBanner`, `NotificationOutlined`, `/announcements`, and `.announcement-banner` are missing.

- [ ] **Step 3: Create the banner component**

Create `src/components/Layout/AnnouncementBanner.jsx`:

```jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Space, Typography } from 'antd';
import { NotificationOutlined } from '@ant-design/icons';
import { formatDateTime } from '../../utils/format.js';

async function requestJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  return { response, data };
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { response, data } = await requestJson('/api/announcements/active');
        if (!active || !response.ok || data?.ok === false) return;
        setAnnouncements(data.announcements || []);
      } catch (error) {
        console.error(error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const first = announcements[0];
  const text = useMemo(() => {
    const snapshot = first?.activeSnapshot || first?.publishedSnapshot;
    if (!snapshot) return '';
    const systems = (snapshot.affectedSystems || []).map((item) => item.name).join('、');
    return `【${systems || '故障公告'}】${snapshot.title || ''}：${snapshot.progressText || snapshot.faultDescriptionText || ''}，预计恢复 ${formatDateTime(snapshot.estimatedRecoveryAt)}`;
  }, [first]);

  if (!first) return null;

  const snapshot = first.activeSnapshot || first.publishedSnapshot;
  const speed = Math.max(12, Number(snapshot?.display?.scrollSpeed) || 40);
  const duration = Math.max(10, Math.round(240 / speed * 10));

  return (
    <div className="announcement-banner">
      <NotificationOutlined className="announcement-banner-icon" />
      <div className="announcement-banner-viewport">
        <div className="announcement-banner-track" style={{ animationDuration: `${duration}s` }}>
          {text}
        </div>
      </div>
      {snapshot?.display?.pinned && <span className="announcement-banner-pin">置顶</span>}
      <Button type="link" size="small" onClick={() => setDetail(first)}>查看详情</Button>
      <Drawer title="公告详情" open={Boolean(detail)} onClose={() => setDetail(null)} width={640}>
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Title level={5}>{snapshot.title}</Typography.Title>
            <Typography.Text type="secondary">预计恢复：{formatDateTime(snapshot.estimatedRecoveryAt)}</Typography.Text>
            <Alert type="warning" showIcon message="故障描述" description={<div className="message-rich-content" dangerouslySetInnerHTML={{ __html: snapshot.faultDescriptionHtml || '' }} />} />
            <Alert type="info" showIcon message="当前处置进度" description={<div className="message-rich-content" dangerouslySetInnerHTML={{ __html: snapshot.progressHtml || '' }} />} />
          </Space>
        )}
      </Drawer>
    </div>
  );
}
```

- [ ] **Step 4: Modify `AppLayout.jsx` navigation and mount**

In `src/components/Layout/AppLayout.jsx`:

- Add `NotificationOutlined` to the icon import list.
- Add `import AnnouncementBanner from './AnnouncementBanner.jsx';`.
- Add this admin menu child after data fix schemes:

```jsx
{
  key: '/announcements',
  icon: <NotificationOutlined />,
  label: <Link href="/announcements">公告管理</Link>
}
```

- Add this selected-key branch:

```javascript
if (pathname.startsWith('/announcements')) return '/announcements';
```

- Render the banner just before content children:

```jsx
<AnnouncementBanner />
```

- [ ] **Step 5: Add banner CSS**

Append to `src/index.css`:

```css
.announcement-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 6px 20px;
  border-bottom: 1px solid #f3d37a;
  background: #fff7d6;
  color: #6f4b00;
}

.announcement-banner-icon {
  color: #d48806;
}

.announcement-banner-viewport {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.announcement-banner-track {
  display: inline-block;
  min-width: 100%;
  animation-name: announcement-scroll;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.announcement-banner-pin {
  border: 1px solid #d48806;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 12px;
  color: #ad6800;
}

@keyframes announcement-scroll {
  0% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-100%);
  }
}
```

- [ ] **Step 6: Run layout tests**

Run:

```bash
node --test src/components/Layout/__tests__/appLayout.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/Layout/AppLayout.jsx src/components/Layout/AnnouncementBanner.jsx src/components/Layout/__tests__/appLayout.test.js src/index.css
git commit -m "feat: show active announcements in top banner"
```

---

## Task 6: Final Verification

**Files:**
- All files changed in Tasks 1-5.

- [ ] **Step 1: Run focused announcement tests**

Run:

```bash
node --test src/utils/__tests__/announcements.test.js src/server/__tests__/announcementService.test.js src/server/__tests__/announcementRoutes.test.js src/views/AdminAnnouncements/__tests__/adminAnnouncementsView.test.js src/components/Layout/__tests__/appLayout.test.js
```

Expected: PASS.

- [ ] **Step 2: Run neighboring regression tests**

Run:

```bash
node --test src/server/__tests__/adminConfigRoutes.test.js src/server/__tests__/adminConfigStore.test.js src/utils/__tests__/adminConfigValidation.test.js src/views/AdminSystems/__tests__/adminSystemsView.test.js
```

Expected: PASS.

- [ ] **Step 3: Build the app**

Run:

```bash
pnpm build
```

Expected: Next.js build completes without errors.

- [ ] **Step 4: Manual smoke check in browser**

Run:

```bash
pnpm dev
```

Open the printed local URL and verify:

- Log in as `ADMIN`.
- Open `/announcements`.
- Create a fault announcement and submit it for approval.
- Approve it as the selected admin.
- Confirm the yellow banner appears in the protected layout.
- Toggle pinned and confirm the pin badge appears.
- Withdraw and confirm the banner disappears.

- [ ] **Step 5: Final status check**

Run:

```bash
git status --short
```

Expected: only intended announcement files are modified.

- [ ] **Step 6: Commit any verification-only fixes**

If verification required fixes, commit them:

```bash
git add src app
git commit -m "fix: polish announcement management integration"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Creation/edit fields: Task 1 validates title, affected systems, description, progress, recovery time, handlers, approver, and display config; Task 4 renders the form fields.
- Approval flow: Task 2 implements submit/approve/reject state transitions and logs; Task 3 exposes routes.
- Rolling display: Task 1 implements active selection and pinned sorting; Task 5 renders yellow scrolling banner.
- Update/withdraw: Task 2 implements published update pending approval and withdrawal; Task 3 exposes routes.
- History management: Task 1 implements keyword/status/system/publish-date filtering; Task 4 renders filters and detail logs.
- Existing project constraints: plan uses `/api/admin/*`, `app_configs`, existing auth/session helpers, and does not touch ticket status fields.

Placeholder scan:

- The plan avoids placeholder markers and vague handoff wording.
- Every task has concrete files, test code, commands, expected results, implementation code, and commit commands.

Type consistency:

- Status constants use `ANNOUNCEMENT_STATUS`.
- Snapshots use `publishedSnapshot`, `pendingSnapshot`, and `activeSnapshot`.
- Route and view paths consistently use `/api/admin/announcements` and `/api/announcements/active`.
