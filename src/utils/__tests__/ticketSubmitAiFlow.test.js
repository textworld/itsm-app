import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const submitPageSource = fs.readFileSync(
  new URL('../../views/TicketSubmit/index.jsx', import.meta.url),
  'utf8'
);
const globalCssSource = fs.readFileSync(
  new URL('../../index.css', import.meta.url),
  'utf8'
);

test('提交工单先创建草稿并打开大模型解答抽屉', () => {
  assert.match(submitPageSource, /AiTicketAssistantDrawer/);
  assert.match(submitPageSource, /addTicket\(ticket,\s*EVENTS\.CREATE_DRAFT\)/);
  assert.match(submitPageSource, /setAiTicket\(createdTicket\)/);
  assert.match(submitPageSource, /setAiDrawerOpen\(true\)/);
});

test('大模型抽屉动作通过状态机完成办结或转人工', () => {
  assert.match(submitPageSource, /EVENTS\.AI_RESOLVE/);
  assert.match(submitPageSource, /EVENTS\.SUBMIT/);
  assert.match(submitPageSource, /handleAiResolved/);
  assert.match(submitPageSource, /handleManualProcess/);
});

test('审批类工单提交时关闭 AI 流程并直接进入 OA 分支', () => {
  assert.match(submitPageSource, /shouldUseAiFlow/);
  assert.match(submitPageSource, /EVENTS\.SUBMIT_TO_OA/);
  assert.match(submitPageSource, /EVENTS\.SUBMIT_DATA_FIX_SCHEME_REVIEW/);
  assert.match(submitPageSource, /dataFixSolution/);
  assert.doesNotMatch(submitPageSource, /修正方案说明/);
  assert.match(submitPageSource, /关联工单号/);
});

test('生产系统数据修正提交页通过弹窗单选配置方案并写入提交 payload', () => {
  assert.match(submitPageSource, /\/api\/config\/data-fix-schemes/);
  assert.match(submitPageSource, /选择数据修正方案/);
  assert.match(submitPageSource, /dataFixSchemeModalOpen/);
  assert.match(submitPageSource, /dataFixSchemeTitleKeyword/);
  assert.match(submitPageSource, /Radio/);
  assert.match(submitPageSource, /selectedSchemeId/);
  assert.match(submitPageSource, /selectedSchemeTitle/);
  assert.match(submitPageSource, /selectedSchemeDescription/);
  assert.match(submitPageSource, /selectedSchemeVersionNo/);
  assert.match(submitPageSource, /selectedSolutionCode/);
  assert.match(submitPageSource, /方案版本 v/);
  assert.match(submitPageSource, /requesterSolution: String\(solution\.requesterSolution \|\| solution\.selectedSchemeDescription/);
});

test('only the regular consult ticket type uses the AI model flow', () => {
  assert.match(submitPageSource, /return ticket\.toolType === TOOL_TYPES\.CONSULT;/);
  assert.doesNotMatch(submitPageSource, /TOOL_TYPES\.DATA_FIX\s*&&/);
});

test('ticket submit validation failures show a modal and emphasize invalid fields', () => {
  assert.match(submitPageSource, /onFinishFailed=\{handleFinishFailed\}/);
  assert.match(submitPageSource, /modal\.warning/);
  assert.match(submitPageSource, /form\.scrollToField/);
  assert.match(submitPageSource, /field-error-emphasis/);
  assert.match(globalCssSource, /\.field-error-emphasis/);
});

test('data fix submit form can switch to regular consult when requester has no scheme', () => {
  assert.match(submitPageSource, /没有方案，转人工咨询/);
  assert.match(submitPageSource, /handleConvertDataFixToConsult/);
  assert.match(submitPageSource, /toolType:\s*TOOL_TYPES\.CONSULT/);
  assert.match(submitPageSource, /dataFixSolution:\s*\{\}/);
});

test('data extract submit form blocks structured extraction tickets', () => {
  assert.match(submitPageSource, /name="isStructuredDataExtract"/);
  assert.match(submitPageSource, /结构化数据提取请去提数平台/);
  assert.match(submitPageSource, /isStructuredDataExtractTicket\(values\)/);
  assert.match(submitPageSource, /modal\.warning\(\{[\s\S]*结构化数据提取请去提数平台/);
});

test('permission submit form requires an Excel application file and exposes template download', () => {
  assert.match(submitPageSource, /permissionFileList/);
  assert.match(submitPageSource, /权限申请文件/);
  assert.match(submitPageSource, /\/api\/access\/templates\/permission-request/);
  assert.match(submitPageSource, /acceptedTypes=\{EXCEL_ATTACHMENT_TYPES\}/);
  assert.match(submitPageSource, /validator=\{isExcelAttachment\}/);
  assert.match(submitPageSource, /请上传 Excel 格式的权限申请文件/);
  assert.match(submitPageSource, /\.\.\.attachments,\s*\.\.\.permissionAttachments/);
});
