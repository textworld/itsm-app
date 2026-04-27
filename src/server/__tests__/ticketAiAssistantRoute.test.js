import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const routeSource = fs.readFileSync(
  new URL('../../../app/api/ai/ticket-assistant/route.js', import.meta.url),
  'utf8'
);

test('大模型解答接口使用 OpenAI SDK 和流式响应', () => {
  assert.match(routeSource, /import OpenAI from 'openai'/);
  assert.match(routeSource, /baseURL:\s*process\.env\.OPENAI_BASE_URL \|\| 'https:\/\/api\.codexzh\.com\/v1'/);
  assert.match(routeSource, /process\.env\.OPENAI_MODEL \|\| 'gpt-5\.4'/);
  assert.match(routeSource, /stream:\s*true/);
  assert.doesNotMatch(routeSource, /sk-[A-Za-z0-9]/);
});
