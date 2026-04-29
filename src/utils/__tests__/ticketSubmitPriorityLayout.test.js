import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ticketSubmitView = fs.readFileSync(
  new URL('../../views/TicketSubmit/index.jsx', import.meta.url),
  'utf8'
);

const globalStyles = fs.readFileSync(
  new URL('../../index.css', import.meta.url),
  'utf8'
);

test('优先级字段使用整行宽度，避免标签与控件换到两行', () => {
  const priorityLabelIndex = ticketSubmitView.indexOf('label="优先级"');
  const priorityColIndex = ticketSubmitView.lastIndexOf('<Col span={', priorityLabelIndex);

  assert.notEqual(priorityLabelIndex, -1);
  assert.notEqual(priorityColIndex, -1);
  assert.match(ticketSubmitView.slice(priorityColIndex, priorityLabelIndex + 40), /<Col span=\{24\}>/);
});

test('优先级选择框使用 noStyle 内层表单项保持绑定', () => {
  assert.match(
    ticketSubmitView,
    /<Form\.Item\s+name="priority"[\s\S]*?noStyle[\s\S]*?>[\s\S]*?<Select className="reference-short-control"/
  );
});

test('优先级控件容器支持行内布局和换行', () => {
  assert.match(
    globalStyles,
    /\.reference-priority-inline\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*flex-wrap:\s*wrap;/
  );
});

test('提交页 SLA 文案改为工单处理时效', () => {
  assert.match(ticketSubmitView, /工单处理时效 P1: 30分钟/);
  assert.doesNotMatch(ticketSubmitView, /SLA时效/);
});

test('提交页先选择新老系统标签再选择系统名称', () => {
  const categoryIndex = ticketSubmitView.indexOf('name="systemCategory"');
  const systemNameIndex = ticketSubmitView.indexOf('name="systemName"');

  assert.notEqual(categoryIndex, -1);
  assert.notEqual(systemNameIndex, -1);
  assert.ok(categoryIndex < systemNameIndex);
  assert.match(ticketSubmitView, /getSystemOptionsByCategory/);
});
