import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

test('schedule config view loads options and saves editable groups through admin API', () => {
  assert.match(source, /\/api\/admin\/schedules/);
  assert.match(source, /SYSTEM_OPTIONS/);
  assert.match(source, /validateScheduleConfig/);
  assert.match(source, /method: 'PUT'/);
  assert.match(source, /addInsuranceTeam/);
  assert.match(source, /基础排班/);
  assert.match(source, /险种排班小组/);
});
