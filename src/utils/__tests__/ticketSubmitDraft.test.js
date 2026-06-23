import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const submitPageSource = fs.readFileSync(
  new URL('../../views/TicketSubmit/index.jsx', import.meta.url),
  'utf8'
);

test('提交工单页面通过 CREATE_DRAFT 事件暂存草稿', () => {
  assert.match(submitPageSource, /EVENTS\.CREATE_DRAFT/);
  assert.match(submitPageSource, /暂存草稿/);
});

test('暂存草稿后返回工单列表草稿箱 tab', () => {
  assert.match(submitPageSource, /\/tickets\?tab=DRAFT/);
});

test('提交工单页面右上角提供一键生成模拟工单按钮', () => {
  assert.match(submitPageSource, /buildMockTicketFormValues/);
  assert.match(
    submitPageSource,
    /<div className="ticket-submit-header">[\s\S]*<Typography\.Title[\s\S]*提交工单[\s\S]*!isDraftEdit[\s\S]*一键生成模拟工单/
  );
});

test('一键生成模拟工单会调用大模型生成描述', () => {
  assert.match(submitPageSource, /fetch\('\/api\/submission\/mock-description'/);
  assert.match(submitPageSource, /buildMockTicketDescriptionDoc/);
  assert.match(submitPageSource, /mockGenerating/);
});

test('一键生成模拟工单描述失败时提示具体原因', () => {
  assert.match(submitPageSource, /error\.message \|\| '大模型描述生成失败'/);
});

test('保存草稿不触发表单校验', () => {
  const saveDraftStart = submitPageSource.indexOf('const handleSaveDraft = async () => {');
  const saveDraftEnd = submitPageSource.indexOf('  return (', saveDraftStart);
  const saveDraftSource = submitPageSource.slice(saveDraftStart, saveDraftEnd);

  assert.notEqual(saveDraftStart, -1);
  assert.match(saveDraftSource, /form\.getFieldsValue\(true\)/);
  assert.doesNotMatch(saveDraftSource, /form\.validateFields\(\)/);
});
