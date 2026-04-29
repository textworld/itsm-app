import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ticketInfoCardSource = fs.readFileSync(
  new URL('../TicketInfoCard.jsx', import.meta.url),
  'utf8'
);

const ticketDetailPageSource = fs.readFileSync(
  new URL('../../../views/TicketDetail/index.jsx', import.meta.url),
  'utf8'
);

test('提单人详情不显示二线处理人字段', () => {
  assert.match(ticketInfoCardSource, /useAuth/);
  assert.match(ticketInfoCardSource, /user\?\.role !== ROLES\.REQUESTER[\s\S]*二线处理人/);
});

test('详情页处理人字段单独占行并使用醒目样式', () => {
  const assigneeBlockStart = ticketInfoCardSource.indexOf('<div className="ticket-assignee-summary">');
  const descriptionsStart = ticketInfoCardSource.indexOf('<Descriptions column={2}');
  const descriptionsEnd = ticketInfoCardSource.indexOf('</Descriptions>', descriptionsStart);
  const descriptionsSource = ticketInfoCardSource.slice(descriptionsStart, descriptionsEnd);

  assert.notEqual(assigneeBlockStart, -1);
  assert.ok(assigneeBlockStart < descriptionsStart);
  assert.match(ticketInfoCardSource, /className="ticket-assignee-summary"[\s\S]*一线处理人[\s\S]*ticket\.assigneeL1Name/);
  assert.match(ticketInfoCardSource, /user\?\.role !== ROLES\.REQUESTER[\s\S]*二线处理人[\s\S]*ticket\.assigneeL2Name/);
  assert.doesNotMatch(descriptionsSource, /一线处理人/);
  assert.doesNotMatch(descriptionsSource, /二线处理人/);
});

test('提单人详情不展示标签和打标入口', () => {
  assert.match(ticketDetailPageSource, /user\?\.role !== ROLES\.REQUESTER[\s\S]*<CustomTicketTags ticket=\{ticket\}/);
  assert.match(ticketInfoCardSource, /showTechnicalTags[\s\S]*ticket\.defectTag/);
  assert.match(ticketInfoCardSource, /showTechnicalTags[\s\S]*ticket\.linkedDefect/);
});
