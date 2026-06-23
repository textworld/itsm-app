import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const routeSource = fs.readFileSync(
  new URL('../../../app/api/ai/ticket-closure-summary/route.js', import.meta.url),
  'utf8'
);

test('办结自动总结接口使用 OpenAI SDK 和流式响应', () => {
  assert.match(routeSource, /import OpenAI from 'openai'/);
  assert.match(routeSource, /stream:\s*true/);
  assert.match(routeSource, /buildClosureSummaryMessages/);
  assert.match(routeSource, /Content-Type': 'text\/plain; charset=utf-8'/);
  assert.doesNotMatch(routeSource, /sk-[A-Za-z0-9]/);
});
