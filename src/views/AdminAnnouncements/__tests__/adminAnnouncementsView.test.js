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

function functionBody(name) {
  const match = source.match(new RegExp(`function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Expected function ${name} to exist`);
  return match[1];
}

test('announcement management page allows admin and support handler roles', () => {
  assert.match(routeSource, /getLoginRedirectHref\('\/announcements'\)/);
  assert.match(routeSource, /ANNOUNCEMENT_MANAGER_ROLES/);
  assert.match(routeSource, /ROLES\.ADMIN/);
  assert.match(routeSource, /ROLES\.L1/);
  assert.match(routeSource, /ROLES\.L2/);
  assert.match(routeSource, /!ANNOUNCEMENT_MANAGER_ROLES\.includes\(user\.role\)/);
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
  assert.match(source, /richTextHasContent/);
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

test('announcement admin view loads current user session for approver-only actions', () => {
  assert.match(source, /\/api\/auth\/session/);
  assert.match(source, /currentUser/);
  assert.match(source, /setCurrentUser\(data\.user \|\| null\)/);

  const canApproveBody = functionBody('canApprove');
  assert.match(canApproveBody, /currentUser/);
  assert.match(canApproveBody, /announcement\.pendingSnapshot\?\.approver\?\.id \|\| announcement\.approver\?\.id/);
  assert.match(canApproveBody, /String\(approverId\) === String\(currentUser\?\.id\)/);
});

test('announcement approval prompts use Ant Design App modal context', () => {
  assert.match(source, /const \{ message, modal \} = AntdApp\.useApp\(\)/);
  assert.match(source, /modal\.confirm\(\{/);
  assert.doesNotMatch(source, /Modal\.confirm/);
});

test('announcement list snapshot prioritizes pending approval content for approval-facing fields', () => {
  const getListSnapshotBody = functionBody('getListSnapshot');
  assert.match(getListSnapshotBody, /const pending = announcement\.pendingSnapshot \|\| \{\}/);
  assert.match(getListSnapshotBody, /const published = announcement\.publishedSnapshot \|\| \{\}/);
  assert.match(getListSnapshotBody, /approver: pending\.approver \|\| announcement\.approver \|\| published\.approver/);
  assert.match(getListSnapshotBody, /estimatedRecoveryAt: pending\.estimatedRecoveryAt \|\| announcement\.estimatedRecoveryAt \|\| published\.estimatedRecoveryAt/);
  assert.match(getListSnapshotBody, /faultDescriptionHtml: pending\.faultDescriptionHtml \|\| announcement\.faultDescriptionHtml \|\| published\.faultDescriptionHtml/);
  assert.match(getListSnapshotBody, /progressHtml: pending\.progressHtml \|\| announcement\.progressHtml \|\| published\.progressHtml/);
});

test('announcement edit action follows editable statuses supported by service', () => {
  const canEditBody = functionBody('canEdit');
  assert.match(canEditBody, /ANNOUNCEMENT_STATUS\.DRAFT/);
  assert.match(canEditBody, /ANNOUNCEMENT_STATUS\.REJECTED/);
  assert.match(canEditBody, /ANNOUNCEMENT_STATUS\.PUBLISHED/);
  assert.doesNotMatch(canEditBody, /ANNOUNCEMENT_STATUS\.UPDATE_PENDING_APPROVAL/);
});

test('announcement detail drawer renders rich text sections and audit records', () => {
  assert.match(source, /<RichTextCard title="故障描述" html=\{currentSnapshot\.faultDescriptionHtml\} \/>/);
  assert.match(source, /<RichTextCard title="当前处置进度" html=\{currentSnapshot\.progressHtml\} \/>/);
  assert.match(source, /<RecordsCard title="审批记录" records=\{announcement\.approvalRecords\} \/>/);
  assert.match(source, /<RecordsCard title="操作日志" records=\{announcement\.operationLogs\} \/>/);
  assert.match(source, /handledAt/);
  assert.match(source, /createdAt/);
  assert.match(source, /operator/);
});

test('announcement drawer shows save and submit errors near the editor', () => {
  assert.match(source, /drawerErrors/);
  assert.match(source, /setDrawerErrors/);
  assert.match(source, /drawerErrors\.length > 0 && <Alert/);
  assert.match(source, /formatValidationMessages/);
});

test('announcement rich text fields validate actual editor content', () => {
  assert.match(source, /import \{ richTextHasContent \} from '..\/..\/utils\/richText\.js'/);
  assert.match(source, /requiredRichTextRule\('请输入故障描述'\)/);
  assert.match(source, /requiredRichTextRule\('请输入当前处置进度'\)/);
  assert.match(source, /richTextHasContent\(value\)/);
});

test('announcement estimated recovery time field is optional in the editor', () => {
  const estimatedRecoveryFormItem = source.match(
    /<Form\.Item\s+name="estimatedRecoveryAt"[\s\S]*?<\/Form\.Item>/
  );

  assert.ok(estimatedRecoveryFormItem, 'Expected estimated recovery time form item to exist');
  assert.doesNotMatch(estimatedRecoveryFormItem[0], /required:\s*true/);
  assert.doesNotMatch(estimatedRecoveryFormItem[0], /请选择预计恢复时间/);
});

test('announcement pin toggle is only enabled for published statuses', () => {
  assert.match(source, /function canTogglePinned\(announcement, currentUser\)/);
  assert.match(source, /currentUser\?\.role !== ROLES\.ADMIN/);
  assert.match(source, /ANNOUNCEMENT_STATUS\.PUBLISHED/);
  assert.match(source, /ANNOUNCEMENT_STATUS\.UPDATE_PENDING_APPROVAL/);
  assert.match(source, /disabled=\{saving \|\| !canTogglePinned\(record, currentUser\)\}/);
});
