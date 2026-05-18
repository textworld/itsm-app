import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

test('support rest config view manages rest periods and upcoming windows through admin API', () => {
  assert.match(source, /\/api\/admin\/support-rests/);
  assert.match(source, /validateSupportRestConfig/);
  assert.match(source, /buildUpcomingSupportRestDays/);
  assert.match(source, /buildSupportRestPeriodFromQuickAdd/);
  assert.match(source, /isSupportRestPeriodVisible/);
  assert.match(source, /DatePicker/);
  assert.match(source, /Segmented/);
  assert.match(source, /Modal/);
  assert.match(source, /method: 'PUT'/);
  assert.match(source, /addRestPeriod/);
  assert.match(source, /openQuickModal/);
  assert.match(source, /removeRestPeriod/);
  assert.match(source, /7/);
  assert.match(source, /14/);
  assert.match(source, /30/);
  assert.match(source, /上午/);
  assert.match(source, /下午/);
  assert.match(source, /全天/);
  assert.match(source, /今日及未来/);
  assert.match(source, /未来休息清单/);
});
