import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

test('system config admin view manages systems through admin API', () => {
  assert.match(source, /\/api\/config\/admin\/systems/);
  assert.match(source, /系统配置/);
  assert.match(source, /系统编码/);
  assert.match(source, /系统名称/);
  assert.match(source, /新老系统标签/);
  assert.match(source, /是否显示在前台/);
  assert.match(source, /visibleInSubmit/);
  assert.match(source, /分类字段名称/);
  assert.match(source, /分类词典/);
  assert.match(source, /ticketClassification/);
  assert.match(source, /dictionaryTypes/);
});
