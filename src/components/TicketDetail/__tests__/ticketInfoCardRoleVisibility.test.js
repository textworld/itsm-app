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

test('审批中工单详情隐藏处理人并展示 OA 通过后提示', () => {
  assert.match(ticketInfoCardSource, /const isAwaitingOaApproval = getSupportStatus\(ticket\) === STATUS\.APPROVING/);
  assert.match(ticketInfoCardSource, /OA通过后，才能进入技术支持处理环节。/);
  assert.match(ticketInfoCardSource, /isAwaitingOaApproval \? \(/);
  assert.match(ticketInfoCardSource, /!\s*isAwaitingOaApproval && \(/);
});

test('OA 申请单编号链接到审批详情页', () => {
  assert.match(ticketInfoCardSource, /import Link from 'next\/link';/);
  assert.match(ticketInfoCardSource, /href=\{`\/approvals\/\$\{ticket\.oaApplication\.oaId\}`\}/);
  assert.match(ticketInfoCardSource, /审批详情/);
});

test('详情页展示已保存的工单分类快照', () => {
  assert.match(ticketInfoCardSource, /ticket\.ticketClassification/);
  assert.match(ticketInfoCardSource, /label=\{ticket\.ticketClassification\.fieldLabel\}/);
  assert.match(ticketInfoCardSource, /ticket\.ticketClassification\.optionName/);
});

test('提单人详情不展示标签和打标入口', () => {
  assert.match(ticketDetailPageSource, /user\?\.role !== ROLES\.REQUESTER[\s\S]*<CustomTicketTags ticket=\{ticket\}/);
  assert.match(ticketInfoCardSource, /showTechnicalTags[\s\S]*ticket\.defectTag/);
  assert.match(ticketInfoCardSource, /showTechnicalTags[\s\S]*ticket\.linkedDefect/);
});
