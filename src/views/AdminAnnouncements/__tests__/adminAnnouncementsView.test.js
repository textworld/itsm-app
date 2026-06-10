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

test('announcement admin view uses rich text, status labels, date range, and action endpoints', () => {
  assert.match(source, /RichTextEditor/);
  assert.match(source, /ANNOUNCEMENT_STATUS_LABELS/);
  assert.match(source, /RangePicker/);
  assert.match(source, /\/approve/);
  assert.match(source, /\/reject/);
  assert.match(source, /\/withdraw/);
  assert.match(source, /\/pin/);
  assert.match(source, /method: 'POST'/);
  assert.match(source, /method: 'PUT'/);
});
