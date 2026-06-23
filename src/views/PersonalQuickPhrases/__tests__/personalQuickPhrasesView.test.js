import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

test('personal quick phrases view loads and saves through personal API', () => {
  assert.match(source, /\/api\/personal\/quick-phrases/);
  assert.match(source, /validateQuickPhraseConfig/);
  assert.match(source, /method: 'PUT'/);
  assert.match(source, /addPhrase/);
  assert.match(source, /removePhrase/);
});

test('personal quick phrases view exposes phrase fields and enabled switch', () => {
  assert.match(source, /title: '话术标题'/);
  assert.match(source, /title: '关键词'/);
  assert.match(source, /title: '话术内容'/);
  assert.match(source, /Switch/);
  assert.match(source, /常用话术维护/);
});
