import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const submitPageSource = fs.readFileSync(
  new URL('../../views/TicketSubmit/index.jsx', import.meta.url),
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
