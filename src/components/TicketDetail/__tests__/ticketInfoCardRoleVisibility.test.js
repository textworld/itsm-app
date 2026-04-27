import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ticketInfoCardSource = fs.readFileSync(
  new URL('../TicketInfoCard.jsx', import.meta.url),
  'utf8'
);

test('提单人详情不显示二线处理人字段', () => {
  assert.match(ticketInfoCardSource, /useAuth/);
  assert.match(ticketInfoCardSource, /user\?\.role !== ROLES\.REQUESTER[\s\S]*二线处理人/);
});
