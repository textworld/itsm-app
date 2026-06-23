import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

test('OA simulator view loads applications and posts admin actions', () => {
  assert.match(source, /\/api\/oa-simulator\/applications/);
  assert.match(source, /postOaAction/);
  assert.match(source, /GENERATE_TICKET/);
  assert.match(source, /DIRECT_CLOSE/);
  assert.match(source, /REJECT/);
  assert.match(source, /REOPEN/);
  assert.match(source, /REAPPROVE_GENERATE/);
  assert.match(source, /REAPPROVE_CLOSE/);
});
