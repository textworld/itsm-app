import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const drawerSource = fs.readFileSync(
  new URL('../AiTicketAssistantDrawer.jsx', import.meta.url),
  'utf8'
);
const indexCssSource = fs.readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

test('大模型抽屉使用左右气泡式对话布局', () => {
  assert.match(drawerSource, /ai-ticket-chat-row/);
  assert.match(drawerSource, /ai-ticket-chat-bubble/);
  assert.match(drawerSource, /ai-ticket-chat-avatar/);
  assert.match(indexCssSource, /\.ai-ticket-chat-row\.ai-ticket-chat-user[\s\S]*justify-content:\s*flex-end/);
  assert.match(indexCssSource, /\.ai-ticket-chat-row\.ai-ticket-chat-assistant[\s\S]*justify-content:\s*flex-start/);
  assert.match(indexCssSource, /\.ai-ticket-chat-user[\s\S]*\.ai-ticket-chat-bubble/);
  assert.match(indexCssSource, /\.ai-ticket-chat-assistant[\s\S]*\.ai-ticket-chat-bubble/);
});
