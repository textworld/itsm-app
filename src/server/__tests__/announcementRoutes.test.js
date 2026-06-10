import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GET as adminAnnouncementsGet,
  POST as adminAnnouncementsPost
} from '../../../app/api/admin/announcements/route.js';
import {
  GET as adminAnnouncementGet,
  PUT as adminAnnouncementPut
} from '../../../app/api/admin/announcements/[id]/route.js';
import { POST as adminAnnouncementApprovePost } from '../../../app/api/admin/announcements/[id]/approve/route.js';
import { POST as adminAnnouncementRejectPost } from '../../../app/api/admin/announcements/[id]/reject/route.js';
import { POST as adminAnnouncementWithdrawPost } from '../../../app/api/admin/announcements/[id]/withdraw/route.js';
import { POST as adminAnnouncementPinPost } from '../../../app/api/admin/announcements/[id]/pin/route.js';
import { GET as activeAnnouncementsGet } from '../../../app/api/announcements/active/route.js';
import { ANNOUNCEMENT_STATUS } from '../../utils/announcements.js';
import { reseedDb } from '../db.js';
import { createUserAccount } from '../store.js';

let userCounter = 0;

test.beforeEach(() => {
  reseedDb();
  userCounter += 1;
});

test('admin announcement GET rejects unauthenticated/non-admin and returns selector options', async () => {
  const unauthenticated = await adminAnnouncementsGet(buildRequest({ userId: null }));
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).reason, '未登录');

  const forbidden = await adminAnnouncementsGet(buildRequest({ userId: 'u_l1_1' }));
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).reason, '无管理员权限');

  const approver = createAdminUser('announcement_get');
  const response = await adminAnnouncementsGet(buildRequest());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.config, { announcements: [], updatedAt: null, updatedBy: null });
  assert.deepEqual(payload.announcements, []);
  assert.ok(payload.systems.some((system) => system.code === 'ERP_CORE'));
  assert.ok(payload.adminUsers.some((user) => user.id === approver.id));
  assert.ok(payload.adminUsers.every((user) => user.role === 'ADMIN' && user.password === undefined));
  assert.ok(payload.supportUsers.some((user) => user.id === 'u_l1_1' && user.role === 'L1'));
  assert.ok(payload.supportUsers.some((user) => user.id === 'u_l2_1' && user.role === 'L2'));
  assert.ok(payload.supportUsers.every((user) => ['L1', 'L2'].includes(user.role) && user.password === undefined));
});

test('POST create+submit validates required fields and persists a pending announcement', async () => {
  const invalidResponse = await adminAnnouncementsPost(buildRequest({ body: { submit: true } }));
  const invalidPayload = await invalidResponse.json();

  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidPayload.reason, '公告内容校验失败');
  assert.deepEqual(invalidPayload.errors.map((error) => error.message), [
    '请输入公告标题',
    '请选择故障影响系统',
    '请输入故障描述',
    '请输入当前处置进度',
    '请选择预计恢复时间',
    '审批人必须是管理员',
    '请选择故障处置负责人'
  ]);

  const approver = createAdminUser('announcement_submit');
  const createResponse = await adminAnnouncementsPost(buildRequest({
    body: validAnnouncementInput({
      approverId: approver.id,
      title: '支付网关异常',
      submit: true
    })
  }));
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.equal(createPayload.ok, true);
  assert.equal(createPayload.announcement.status, ANNOUNCEMENT_STATUS.PENDING_APPROVAL);
  assert.equal(createPayload.announcement.pendingSnapshot.title, '支付网关异常');
  assert.equal(createPayload.config.announcements.length, 1);
  assert.equal(createPayload.config.updatedBy.id, 'u_admin_1');

  const detailResponse = await adminAnnouncementGet(
    buildRequest(),
    routeParams(createPayload.announcement.id)
  );
  const detailPayload = await detailResponse.json();

  assert.equal(detailResponse.status, 200);
  assert.equal(detailPayload.announcement.status, ANNOUNCEMENT_STATUS.PENDING_APPROVAL);
});

test('selected approver can approve and active endpoint returns the published announcement', async () => {
  const { id, approver } = await createSubmittedAnnouncement({ title: '核心支付故障' });

  const approveResponse = await adminAnnouncementApprovePost(
    buildRequest({ userId: approver.id, body: { opinion: '同意发布' } }),
    routeParams(id)
  );
  const approvePayload = await approveResponse.json();

  assert.equal(approveResponse.status, 200);
  assert.equal(approvePayload.ok, true);
  assert.equal(approvePayload.announcement.status, ANNOUNCEMENT_STATUS.PUBLISHED);

  const activeResponse = await activeAnnouncementsGet(buildRequest({ userId: 'u_requester_1' }));
  const activePayload = await activeResponse.json();

  assert.equal(activeResponse.status, 200);
  assert.equal(activePayload.ok, true);
  assert.deepEqual(activePayload.announcements.map((item) => item.id), [id]);
  assert.equal(activePayload.announcements[0].activeSnapshot.title, '核心支付故障');
});

test('wrong admin cannot approve the selected approver announcement', async () => {
  const { id } = await createSubmittedAnnouncement({ title: '审批权限验证' });

  const response = await adminAnnouncementApprovePost(
    buildRequest({ userId: 'u_admin_1', body: { opinion: '越权审批' } }),
    routeParams(id)
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.reason, '仅指定审批人可审批');
});

test('published update creates update pending while active endpoint still shows published snapshot', async () => {
  const { id, approver } = await createPublishedAnnouncement({ title: '支付链路异常' });

  const updateResponse = await adminAnnouncementPut(
    buildRequest({
      body: validAnnouncementInput({
        approverId: approver.id,
        title: '支付链路异常更新',
        progressHtml: '<p>数据库连接恢复中</p>'
      })
    }),
    routeParams(id)
  );
  const updatePayload = await updateResponse.json();

  assert.equal(updateResponse.status, 200);
  assert.equal(updatePayload.ok, true);
  assert.equal(updatePayload.announcement.status, ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL);
  assert.equal(updatePayload.announcement.pendingSnapshot.title, '支付链路异常更新');
  assert.equal(updatePayload.announcement.publishedSnapshot.title, '支付链路异常');

  const activePayload = await jsonFrom(activeAnnouncementsGet(buildRequest({ userId: 'u_requester_1' })));
  assert.equal(activePayload.announcements[0].activeSnapshot.title, '支付链路异常');
});

test('reject update keeps active published content', async () => {
  const { id, approver } = await createPublishedAnnouncement({ title: '客服系统异常' });
  await adminAnnouncementPut(
    buildRequest({
      body: validAnnouncementInput({
        approverId: approver.id,
        title: '客服系统异常更新'
      })
    }),
    routeParams(id)
  );

  const rejectResponse = await adminAnnouncementRejectPost(
    buildRequest({ userId: approver.id, body: { opinion: '暂不更新' } }),
    routeParams(id)
  );
  const rejectPayload = await rejectResponse.json();

  assert.equal(rejectResponse.status, 200);
  assert.equal(rejectPayload.ok, true);
  assert.equal(rejectPayload.announcement.status, ANNOUNCEMENT_STATUS.PUBLISHED);
  assert.equal(rejectPayload.announcement.pendingSnapshot, null);

  const activePayload = await jsonFrom(activeAnnouncementsGet(buildRequest({ userId: 'u_requester_1' })));
  assert.equal(activePayload.announcements[0].activeSnapshot.title, '客服系统异常');
});

test('withdraw makes active endpoint immediately empty', async () => {
  const { id } = await createPublishedAnnouncement({ title: '撤回验证公告' });

  const withdrawResponse = await adminAnnouncementWithdrawPost(
    buildRequest({ body: { reason: '故障恢复' } }),
    routeParams(id)
  );
  const withdrawPayload = await withdrawResponse.json();

  assert.equal(withdrawResponse.status, 200);
  assert.equal(withdrawPayload.ok, true);
  assert.equal(withdrawPayload.announcement.status, ANNOUNCEMENT_STATUS.WITHDRAWN);

  const activePayload = await jsonFrom(activeAnnouncementsGet(buildRequest({ userId: 'u_requester_1' })));
  assert.deepEqual(activePayload.announcements, []);
});

test('pin toggles active snapshot pinned and is rejected for withdrawn rows', async () => {
  const { id } = await createPublishedAnnouncement({ title: '置顶验证公告' });

  const pinResponse = await adminAnnouncementPinPost(
    buildRequest({ body: { pinned: true } }),
    routeParams(id)
  );
  const pinPayload = await pinResponse.json();

  assert.equal(pinResponse.status, 200);
  assert.equal(pinPayload.ok, true);
  assert.equal(pinPayload.announcement.publishedSnapshot.display.pinned, true);

  const activePayload = await jsonFrom(activeAnnouncementsGet(buildRequest({ userId: 'u_requester_1' })));
  assert.equal(activePayload.announcements[0].activeSnapshot.display.pinned, true);

  await adminAnnouncementWithdrawPost(
    buildRequest({ body: { reason: '故障恢复' } }),
    routeParams(id)
  );
  const rejectedResponse = await adminAnnouncementPinPost(
    buildRequest({ body: { pinned: false } }),
    routeParams(id)
  );
  const rejectedPayload = await rejectedResponse.json();

  assert.equal(rejectedResponse.status, 400);
  assert.equal(rejectedPayload.ok, false);
  assert.equal(rejectedPayload.reason, '当前状态不可置顶');
});

test('history filters by status system and publish date through admin GET', async () => {
  await createPublishedAnnouncement({ title: 'ERP 支付异常', systemCode: 'ERP_CORE' });
  await createPublishedAnnouncement({ title: 'CRM 抖动异常', systemCode: 'CRM_CENTER' });
  await createSubmittedAnnouncement({ title: '待审批 HR 公告', systemCode: 'HR_MASTER' });

  const response = await adminAnnouncementsGet(buildRequest({
    url: [
      'http://localhost/api/admin/announcements',
      '?status=PUBLISHED',
      '&systemCode=CRM_CENTER',
      '&publishedFrom=2000-01-01T00:00:00.000Z',
      '&publishedTo=2999-12-31T23:59:59.999Z'
    ].join('')
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.announcements.map((item) => item.title), ['CRM 抖动异常']);
});

test('active endpoint rejects unauthenticated users', async () => {
  const response = await activeAnnouncementsGet(buildRequest({ userId: null }));
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(payload, { ok: false, reason: '未登录' });
});

async function createSubmittedAnnouncement({ title, systemCode = 'ERP_CORE' } = {}) {
  const approver = createAdminUser(`approver_${systemCode.toLowerCase()}`);
  const response = await adminAnnouncementsPost(buildRequest({
    body: validAnnouncementInput({ approverId: approver.id, title, systemCode, submit: true })
  }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  return { id: payload.announcement.id, approver, announcement: payload.announcement };
}

async function createPublishedAnnouncement(options = {}) {
  const submitted = await createSubmittedAnnouncement(options);
  const response = await adminAnnouncementApprovePost(
    buildRequest({ userId: submitted.approver.id, body: { opinion: '同意发布' } }),
    routeParams(submitted.id)
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  return { ...submitted, announcement: payload.announcement };
}

function createAdminUser(label) {
  const result = createUserAccount(
    {
      username: `${label}_${userCounter}_${Date.now()}`,
      password: '123456',
      name: `审批管理员 ${label}`,
      role: 'ADMIN'
    },
    { allowAdmin: true }
  );
  assert.equal(result.ok, true);
  return result.user;
}

function validAnnouncementInput({
  approverId,
  title = '支付网关异常',
  systemCode = 'ERP_CORE',
  handlerIds = ['u_l1_1'],
  progressHtml = '<p>已切换备用链路</p>',
  submit = false
} = {}) {
  return {
    title,
    affectedSystemCodes: [systemCode],
    faultDescriptionHtml: '<p>支付失败率升高</p>',
    progressHtml,
    estimatedRecoveryAt: '2026-06-10T16:30:00.000Z',
    handlerIds,
    approverId,
    display: { scrollSpeed: 40, durationSeconds: 1800, pinned: false },
    submit
  };
}

async function jsonFrom(responsePromise) {
  const response = await responsePromise;
  assert.equal(response.status, 200);
  return response.json();
}

function routeParams(id) {
  return { params: Promise.resolve({ id }) };
}

function buildRequest({ userId = 'u_admin_1', body = {}, url = 'http://localhost/api/test' } = {}) {
  return {
    url,
    cookies: {
      get(name) {
        if (name !== 'itsm_session_user_id' || !userId) return undefined;
        return { value: userId };
      }
    },
    async json() {
      return body;
    }
  };
}
