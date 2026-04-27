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

test('工单列表操作列支持更多下拉，并限制最多展示三个按钮', () => {
  assert.match(ticketTableSource, /<Dropdown/);
  assert.match(ticketTableSource, /const directActions = ticketActions\.slice\(0,\s*2\)/);
  assert.match(ticketTableSource, /const overflowActions = ticketActions\.slice\(2\)/);
});

test('工单列表操作列宽度和按钮间距进一步收紧', () => {
  assert.match(ticketTableSource, /title:\s*'操作'[\s\S]*width:\s*200/);
  assert.match(ticketTableSource, /<Space size=\{2\} wrap>/);
  assert.match(ticketTableSource, /<Button type="link" size="small"/);
});

test('技术支持在列表页受理成功后会进入对应工单详情', () => {
  assert.match(
    ticketTableSource,
    /if\s*\(action\.key === 'accept'\)\s*\{[\s\S]*router\.push\(`\/tickets\/\$\{targetTicketId\}`\);[\s\S]*\}/
  );
});

test('工单标题列使用角色化列宽', () => {
  assert.match(ticketTableSource, /getTitleColumnWidth\(user\)/);
  assert.match(
    ticketTableSource,
    /title:\s*getTitleColumnTitle\(user\)[\s\S]*width:\s*getTitleColumnWidth\(user\)[\s\S]*dataIndex:\s*'title'/
  );
});
