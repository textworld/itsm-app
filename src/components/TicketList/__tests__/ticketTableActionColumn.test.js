import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ticketTableSource = fs.readFileSync(
  new URL('../TicketTable.jsx', import.meta.url),
  'utf8'
);

test('工单列表操作列主按钮文案为查看，不再展示查看处理', () => {
  assert.match(ticketTableSource, />\s*查看\s*</);
  assert.doesNotMatch(ticketTableSource, /查看\/处理/);
});

test('工单编号和标题列提供复制文本按钮', () => {
  assert.match(ticketTableSource, /CopyOutlined/);
  assert.match(ticketTableSource, /copyableText=\{getTicketNumberDisplay\(record\)\}/);
  assert.match(ticketTableSource, /copyableText=\{text\}/);
  assert.match(ticketTableSource, /handleCopyText/);
});

test('工单列表操作列只保留查看按钮', () => {
  assert.doesNotMatch(ticketTableSource, /<Dropdown/);
  assert.doesNotMatch(ticketTableSource, /getTicketListActions/);
  assert.doesNotMatch(ticketTableSource, /handleTicketAction/);
});

test('工单列表操作列宽度和按钮间距进一步收紧', () => {
  assert.match(ticketTableSource, /title:\s*'操作'[\s\S]*width:\s*90/);
  assert.match(ticketTableSource, /<Space size=\{2\} wrap>/);
  assert.match(ticketTableSource, /<Button type="link" size="small"/);
});

test('工单标题列使用角色化列宽', () => {
  assert.match(ticketTableSource, /getTitleColumnWidth\(user\)/);
  assert.match(
    ticketTableSource,
    /title:\s*getTitleColumnTitle\(user\)[\s\S]*width:\s*getTitleColumnWidth\(user\)[\s\S]*dataIndex:\s*'title'/
  );
});
test('ticket list displays subtask ticket type', () => {
  assert.match(ticketTableSource, /getTicketTypeDisplay/);
  assert.match(ticketTableSource, /isSubtask/);
  assert.match(ticketTableSource, /子任务/);
});
