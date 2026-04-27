import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const createRouteSource = fs.readFileSync(
  new URL('../../../app/api/tickets/route.js', import.meta.url),
  'utf8'
);

const patchRouteSource = fs.readFileSync(
  new URL('../../../app/api/tickets/[id]/route.js', import.meta.url),
  'utf8'
);

test('创建工单接口通过状态机提交 SUBMIT 事件', () => {
  assert.match(createRouteSource, /dispatchCreateTicketEvent/);
  assert.match(createRouteSource, /EVENTS\.SUBMIT/);
});

test('工单 PATCH 直改接口不再直接 replaceTicket', () => {
  assert.doesNotMatch(patchRouteSource, /replaceTicket/);
  assert.match(patchRouteSource, /状态机|dispatch/);
});
