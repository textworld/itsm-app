import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const listSource = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

const detailSource = fs.readFileSync(
  new URL('../ScheduleDetailPage.jsx', import.meta.url),
  'utf8'
);

const newRouteSource = fs.readFileSync(
  new URL('../../../../app/(protected)/schedules/new/page.jsx', import.meta.url),
  'utf8'
);

const editRouteSource = fs.readFileSync(
  new URL('../../../../app/(protected)/schedules/[groupId]/page.jsx', import.meta.url),
  'utf8'
);

test('schedule list view loads groups and exposes searchable table entries', () => {
  assert.match(listSource, /\/api\/admin\/schedules/);
  assert.match(listSource, /Table/);
  assert.match(listSource, /filterScheduleGroups/);
  assert.match(listSource, /buildScheduleGroupRow/);
  assert.match(listSource, /系统搜索/);
  assert.match(listSource, /人员搜索/);
  assert.match(listSource, /分组名称/);
  assert.match(listSource, /系统范围/);
  assert.match(listSource, /相应人员/);
  assert.match(listSource, /编辑/);
  assert.match(listSource, /\/schedules\/new/);
});

test('schedule detail view saves one editable group through admin API', () => {
  assert.match(detailSource, /\/api\/admin\/schedules/);
  assert.match(detailSource, /SYSTEM_OPTIONS/);
  assert.match(detailSource, /validateScheduleConfig/);
  assert.match(detailSource, /method: 'PUT'/);
  assert.match(detailSource, /addInsuranceTeam/);
  assert.match(detailSource, /基础排班/);
  assert.match(detailSource, /险种排班小组/);
  assert.match(detailSource, /\/schedules/);
});

test('schedule detail routes protect admin access and pass create or edit mode', () => {
  for (const source of [newRouteSource, editRouteSource]) {
    assert.match(source, /ScheduleDetailPage/);
    assert.match(source, /ROLES\.ADMIN/);
    assert.match(source, /getLoginRedirectHref/);
    assert.match(source, /getSessionUserFromRequest/);
  }

  assert.match(newRouteSource, /mode="create"/);
  assert.match(editRouteSource, /mode="edit"/);
  assert.match(editRouteSource, /groupId=/);
});
