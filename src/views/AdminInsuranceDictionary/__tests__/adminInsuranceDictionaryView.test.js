import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

test('insurance dictionary view loads and edits insurance types through admin API', () => {
  assert.match(source, /\/api\/config\/admin\/dictionaries\/insurance-types/);
  assert.match(source, /<Table/);
  assert.match(source, /<Modal/);
  assert.match(source, /<Switch/);
  assert.match(source, /method: editingItem \? 'PATCH' : 'POST'/);
  assert.match(source, /险种编码/);
  assert.match(source, /险种名称/);
});
