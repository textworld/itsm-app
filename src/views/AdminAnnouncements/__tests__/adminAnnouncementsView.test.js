import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

const routeSource = fs.readFileSync(
  new URL('../../../../app/(protected)/announcements/page.jsx', import.meta.url),
  'utf8'
);

test('announcement admin page is administrator-only', () => {
  assert.match(routeSource, /getLoginRedirectHref\('\/announcements'\)/);
  assert.match(routeSource, /user\.role !== ROLES\.ADMIN/);
  assert.match(routeSource, /<AdminAnnouncementsPage \/>/);
});

test('announcement admin view exposes required management fields and sections', () => {
  assert.match(source, /\/api\/admin\/announcements/);
  assert.match(source, /公告管理/);
  assert.match(source, /发布公告/);
  assert.match(source, /故障影响范围/);
  assert.match(source, /故障描述/);
  assert.match(source, /当前处置进度/);
  assert.match(source, /预计恢复时间/);
  assert.match(source, /故障处置负责人/);
  assert.match(source, /审批人/);
  assert.match(source, /滚动速度/);
  assert.match(source, /展示时长/);
  assert.match(source, /置顶/);
  assert.match(source, /审批记录/);
  assert.match(source, /操作日志/);
});

test('announcement admin view loads list and option datasets from admin GET response', () => {
  assert.match(source, /setAnnouncements\(data\.announcements \|\| \[\]\)/);
  assert.match(source, /setSystems\(data\.systems \|\| \[\]\)/);
  assert.match(source, /setAdminUsers\(data\.adminUsers \|\| \[\]\)/);
  assert.match(source, /setSupportUsers\(data\.supportUsers \|\| \[\]\)/);
});

test('announcement admin view builds GET query filters for keyword system status and publish range', () => {
  assert.match(source, /params\.set\('keyword', filters\.keyword\)/);
  assert.match(source, /params\.set\('systemCode', filters\.systemCode\)/);
  assert.match(source, /params\.set\('status', filters\.status\)/);
  assert.match(source, /params\.set\('publishedFrom', publishedFrom\.toISOString\(\)\)/);
  assert.match(source, /params\.set\('publishedTo', publishedTo\.toISOString\(\)\)/);
});

test('announcement admin table exposes required columns and actions', () => {
  [
    '状态',
    '公告标题',
    '故障影响范围',
    '审批人',
    '预计恢复时间',
    '发布时间',
    '创建人/发布人',
    '置顶',
    '操作',
    '详情',
    '编辑',
    '提交审批',
    '审批通过',
    '驳回',
    '撤回'
  ].forEach((text) => assert.match(source, new RegExp(text)));
});

test('announcement admin view uses rich text, status labels, date range, and action endpoints', () => {
  assert.match(source, /RichTextEditor/);
  assert.match(source, /ANNOUNCEMENT_STATUS_LABELS/);
  assert.match(source, /RangePicker/);
  assert.match(source, /\/submit/);
  assert.match(source, /\/approve/);
  assert.match(source, /\/reject/);
  assert.match(source, /\/withdraw/);
  assert.match(source, /\/pin/);
  assert.match(source, /method: 'POST'/);
  assert.match(source, /method: 'PUT'/);
});

test('announcement detail drawer renders rich text sections and audit records', () => {
  assert.match(source, /<RichTextCard title="故障描述" html=\{currentSnapshot\.faultDescriptionHtml\} \/>/);
  assert.match(source, /<RichTextCard title="当前处置进度" html=\{currentSnapshot\.progressHtml\} \/>/);
  assert.match(source, /<RecordsCard title="审批记录" records=\{announcement\.approvalRecords\} \/>/);
  assert.match(source, /<RecordsCard title="操作日志" records=\{announcement\.operationLogs\} \/>/);
});

test('announcement pin toggle is only enabled for published statuses', () => {
  assert.match(source, /function canTogglePinned\(announcement\)/);
  assert.match(source, /ANNOUNCEMENT_STATUS\.PUBLISHED/);
  assert.match(source, /ANNOUNCEMENT_STATUS\.UPDATE_PENDING_APPROVAL/);
  assert.match(source, /disabled=\{saving \|\| !canTogglePinned\(record\)\}/);
});
