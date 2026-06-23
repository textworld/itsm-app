# Admin Insurance Dictionary And Schedule Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build administrator-only insurance dictionary management and schedule configuration pages.

**Architecture:** Keep the feature separate from ticket state transitions. Put reusable validation in pure utilities, persistence in a server store module backed by the existing SQLite/JSON fallback database, and expose narrow admin API routes consumed by Ant Design pages. The UI adds two top navigation entries for administrators only: insurance dictionary and schedule config.

**Tech Stack:** Next.js App Router, React 18, Ant Design 5, `better-sqlite3`, Node `node:test`.

---

## File Map

- Create: `src/utils/adminConfigValidation.js`
  - Pure normalization and validation for insurance dictionary items and schedule configuration.
- Create: `src/utils/__tests__/adminConfigValidation.test.js`
  - Tests for every business constraint.
- Modify: `src/server/db.js`
  - Add `dictionary_items` and `app_configs` tables to SQLite and JSON fallback support.
- Create: `src/server/adminConfigStore.js`
  - List/create/update insurance types, read/save schedule config, list L1 users.
- Create: `src/server/__tests__/adminConfigStore.test.js`
  - Store-level read/write tests.
- Create: `src/server/adminAuth.js`
  - Shared admin guard helpers for API and protected pages.
- Create: `src/server/__tests__/adminAuth.test.js`
  - 401/403/admin behavior tests for helper functions.
- Create: `app/api/admin/dictionaries/insurance-types/route.js`
  - `GET` and `POST` insurance dictionary route.
- Create: `app/api/admin/dictionaries/insurance-types/[id]/route.js`
  - `PATCH` insurance dictionary item route.
- Create: `app/api/admin/schedules/route.js`
  - `GET` and `PUT` schedule config route.
- Create: `src/server/__tests__/adminConfigRoutes.test.js`
  - Source-level or direct route tests for admin guard and validation behavior.
- Create: `app/(protected)/dictionaries/insurance-types/page.jsx`
  - Protected insurance dictionary page.
- Create: `app/(protected)/schedules/page.jsx`
  - Protected schedule config page.
- Create: `src/views/AdminInsuranceDictionary/index.jsx`
  - Client page for insurance CRUD.
- Create: `src/views/AdminScheduleConfig/index.jsx`
  - Client page for editable schedule groups.
- Modify: `src/components/Layout/AppLayout.jsx`
  - Add admin-only top navigation entries and page titles.
- Modify: `src/components/Layout/__tests__/appLayout.test.js`
  - Cover admin entries and non-admin hiding.
- Modify: `src/index.css`
  - Add compact admin config styles if needed.

## Task 1: Pure Validation

**Files:**
- Create: `src/utils/adminConfigValidation.js`
- Create: `src/utils/__tests__/adminConfigValidation.test.js`

- [ ] **Step 1: Write failing tests for insurance type validation**

Add tests:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INSURANCE_DICTIONARY_TYPE,
  validateInsuranceTypeInput
} from '../adminConfigValidation.js';

test('insurance type validation requires unique code and name', () => {
  const existingItems = [
    { id: 'ins_1', type: INSURANCE_DICTIONARY_TYPE, code: 'MEDICAL', name: '医疗险', enabled: true }
  ];

  assert.deepEqual(validateInsuranceTypeInput({ code: '', name: '' }, existingItems).errors, [
    { path: ['code'], message: '请输入险种编码' },
    { path: ['name'], message: '请输入险种名称' }
  ]);

  assert.deepEqual(validateInsuranceTypeInput({ code: 'MEDICAL', name: '其他' }, existingItems).errors, [
    { path: ['code'], message: '险种编码已存在' }
  ]);

  assert.deepEqual(validateInsuranceTypeInput({ code: 'OTHER', name: '医疗险' }, existingItems).errors, [
    { path: ['name'], message: '险种名称已存在' }
  ]);
});
```

- [ ] **Step 2: Run validation tests to verify RED**

Run: `node --test src/utils/__tests__/adminConfigValidation.test.js`

Expected: FAIL because `src/utils/adminConfigValidation.js` does not exist.

- [ ] **Step 3: Implement minimal insurance validation**

Create `src/utils/adminConfigValidation.js` with:

```js
export const INSURANCE_DICTIONARY_TYPE = 'INSURANCE_TYPE';
export const SCHEDULE_CONFIG_KEY = 'SCHEDULE_CONFIG';

export function validateInsuranceTypeInput(input = {}, existingItems = [], currentId = null) {
  const code = normalizeCode(input.code);
  const name = String(input.name || '').trim();
  const errors = [];

  if (!code) errors.push({ path: ['code'], message: '请输入险种编码' });
  if (!name) errors.push({ path: ['name'], message: '请输入险种名称' });

  const comparableItems = existingItems.filter((item) => item.id !== currentId);
  if (code && comparableItems.some((item) => normalizeCode(item.code) === code)) {
    errors.push({ path: ['code'], message: '险种编码已存在' });
  }
  if (name && comparableItems.some((item) => String(item.name || '').trim() === name)) {
    errors.push({ path: ['name'], message: '险种名称已存在' });
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      code,
      name,
      enabled: input.enabled !== false
    }
  };
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}
```

- [ ] **Step 4: Run validation tests to verify GREEN**

Run: `node --test src/utils/__tests__/adminConfigValidation.test.js`

Expected: PASS.

- [ ] **Step 5: Add failing schedule validation tests**

Extend `src/utils/__tests__/adminConfigValidation.test.js` with tests for:

- duplicate systems across groups
- required base schedule with at least one L1 user
- duplicate insurance in teams within the same group
- duplicate team users in teams within the same group
- non-L1 users rejected
- disabled insurance rejected
- same user allowed across different groups

Use context:

```js
const context = {
  systems: [
    { value: 'ERP_CORE', label: 'ERP 核心系统' },
    { value: 'CRM_CENTER', label: 'CRM 客户管理系统' }
  ],
  enabledInsuranceTypes: [
    { code: 'MEDICAL', name: '医疗险', enabled: true },
    { code: 'LIFE', name: '寿险', enabled: true }
  ],
  assignableUsers: [
    { id: 'u_l1_1', name: '李一线', role: 'L1' },
    { id: 'u_l1_2', name: '周一线', role: 'L1' }
  ]
};
```

- [ ] **Step 6: Run tests to verify RED**

Run: `node --test src/utils/__tests__/adminConfigValidation.test.js`

Expected: FAIL because `validateScheduleConfig` is not implemented.

- [ ] **Step 7: Implement schedule normalization and validation**

Add:

```js
export function normalizeScheduleConfig(input = {}) {
  return {
    groups: Array.isArray(input.groups)
      ? input.groups.map((group, groupIndex) => ({
          id: String(group.id || `grp_${groupIndex + 1}`),
          name: String(group.name || '').trim(),
          systemCodes: uniqueStrings(group.systemCodes),
          baseSchedule: {
            userIds: uniqueStrings(group.baseSchedule?.userIds)
          },
          insuranceTeams: Array.isArray(group.insuranceTeams)
            ? group.insuranceTeams.map((team, teamIndex) => ({
                id: String(team.id || `team_${groupIndex + 1}_${teamIndex + 1}`),
                name: String(team.name || '').trim(),
                userIds: uniqueStrings(team.userIds),
                insuranceTypeCodes: uniqueStrings(team.insuranceTypeCodes)
              }))
            : []
        }))
      : []
  };
}

export function validateScheduleConfig(input = {}, context = {}) {
  const value = normalizeScheduleConfig(input);
  const errors = [];
  const systemsByCode = new Map((context.systems || []).map((item) => [item.value, item]));
  const insuranceByCode = new Map((context.enabledInsuranceTypes || []).map((item) => [item.code, item]));
  const userById = new Map((context.assignableUsers || []).map((item) => [item.id, item]));
  const systemOwner = new Map();

  value.groups.forEach((group, groupIndex) => {
    if (!group.name) errors.push({ path: ['groups', groupIndex, 'name'], message: '请输入排班分组名称' });
    if (!group.systemCodes.length) errors.push({ path: ['groups', groupIndex, 'systemCodes'], message: '请选择系统' });
    if (!group.baseSchedule.userIds.length) {
      errors.push({ path: ['groups', groupIndex, 'baseSchedule', 'userIds'], message: '基础排班至少选择一名一线人员' });
    }

    for (const systemCode of group.systemCodes) {
      if (!systemsByCode.has(systemCode)) {
        errors.push({ path: ['groups', groupIndex, 'systemCodes'], message: `系统 ${systemCode} 不存在` });
      } else if (systemOwner.has(systemCode)) {
        errors.push({ path: ['groups', groupIndex, 'systemCodes'], message: `${systemsByCode.get(systemCode).label} 已出现在其他排班分组中` });
      } else {
        systemOwner.set(systemCode, groupIndex);
      }
    }

    for (const userId of group.baseSchedule.userIds) {
      if (!userById.has(userId)) {
        errors.push({ path: ['groups', groupIndex, 'baseSchedule', 'userIds'], message: `人员 ${userId} 不是可选一线人员` });
      }
    }

    const teamUserOwner = new Map();
    const teamInsuranceOwner = new Map();
    group.insuranceTeams.forEach((team, teamIndex) => {
      if (!team.name) errors.push({ path: ['groups', groupIndex, 'insuranceTeams', teamIndex, 'name'], message: '请输入险种小组名称' });

      for (const userId of team.userIds) {
        if (!userById.has(userId)) {
          errors.push({ path: ['groups', groupIndex, 'insuranceTeams', teamIndex, 'userIds'], message: `人员 ${userId} 不是可选一线人员` });
        } else if (teamUserOwner.has(userId)) {
          errors.push({ path: ['groups', groupIndex, 'insuranceTeams', teamIndex, 'userIds'], message: `${userById.get(userId).name} 已出现在本分组其他险种小组中` });
        } else {
          teamUserOwner.set(userId, teamIndex);
        }
      }

      for (const insuranceCode of team.insuranceTypeCodes) {
        if (!insuranceByCode.has(insuranceCode)) {
          errors.push({ path: ['groups', groupIndex, 'insuranceTeams', teamIndex, 'insuranceTypeCodes'], message: `险种 ${insuranceCode} 不存在或未启用` });
        } else if (teamInsuranceOwner.has(insuranceCode)) {
          errors.push({ path: ['groups', groupIndex, 'insuranceTeams', teamIndex, 'insuranceTypeCodes'], message: `${insuranceByCode.get(insuranceCode).name} 已出现在本分组其他险种小组中` });
        } else {
          teamInsuranceOwner.set(insuranceCode, teamIndex);
        }
      }
    });
  });

  return { ok: errors.length === 0, errors, value };
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}
```

- [ ] **Step 8: Run validation tests to verify GREEN**

Run: `node --test src/utils/__tests__/adminConfigValidation.test.js`

Expected: PASS.

- [ ] **Step 9: Commit validation work**

Run:

```bash
git add src/utils/adminConfigValidation.js src/utils/__tests__/adminConfigValidation.test.js
git commit -m "feat: add admin config validation"
```

## Task 2: Admin Guard

**Files:**
- Create: `src/server/adminAuth.js`
- Create: `src/server/__tests__/adminAuth.test.js`

- [ ] **Step 1: Write failing admin auth tests**

Test:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { requireAdminUser } from '../adminAuth.js';

test('admin guard rejects missing user and non-admin user', () => {
  assert.deepEqual(requireAdminUser(null), { ok: false, status: 401, reason: '未登录' });
  assert.deepEqual(requireAdminUser({ id: 'u_l1_1', role: 'L1' }), { ok: false, status: 403, reason: '无管理员权限' });
});

test('admin guard accepts administrator', () => {
  const user = { id: 'u_admin_1', role: 'ADMIN', name: '管理员' };
  assert.deepEqual(requireAdminUser(user), { ok: true, user });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `node --test src/server/__tests__/adminAuth.test.js`

Expected: FAIL because `adminAuth.js` does not exist.

- [ ] **Step 3: Implement admin guard**

Use `ROLES.ADMIN` from `src/constants/roles.js`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `node --test src/server/__tests__/adminAuth.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/server/adminAuth.js src/server/__tests__/adminAuth.test.js
git commit -m "feat: add admin guard"
```

## Task 3: Database And Store

**Files:**
- Modify: `src/server/db.js`
- Create: `src/server/adminConfigStore.js`
- Create: `src/server/__tests__/adminConfigStore.test.js`

- [ ] **Step 1: Write failing store tests**

Cover:

- `listL1Users()` returns only `L1` users and no password.
- `createInsuranceType()` persists normalized `code`, `name`, `enabled`.
- `updateInsuranceType()` edits an existing item.
- `setInsuranceTypeEnabled()` toggles enabled.
- `saveScheduleConfig()` stores normalized config with `updatedBy`.
- `saveScheduleConfig()` rejects invalid config with validation errors.

- [ ] **Step 2: Run store tests to verify RED**

Run: `node --test src/server/__tests__/adminConfigStore.test.js`

Expected: FAIL because `adminConfigStore.js` does not exist or DB tables are missing.

- [ ] **Step 3: Add DB tables and JSON fallback arrays**

Modify `src/server/db.js`:

- Add SQLite `dictionary_items` and `app_configs` tables.
- Add `dictionary_items: []` and `app_configs: []` to `createEmptyTables()`.
- Seed default insurance items when force seeding or when the table is empty.
- Extend JSON fallback statement support for:
  - count/select/insert/update dictionary rows
  - select/upsert app config rows
  - select users by role if needed, or let store parse all user rows from existing table support

- [ ] **Step 4: Implement admin config store**

Use `getDb()` and JSON data columns like `tickets`/`defects`.

Store API:

```js
export function listInsuranceTypes() {}
export function createInsuranceType(input, user) {}
export function updateInsuranceType(id, input, user) {}
export function setInsuranceTypeEnabled(id, enabled, user) {}
export function getScheduleConfig() {}
export function saveScheduleConfig(input, user) {}
export function listL1Users() {}
```

Return success/failure objects for mutating operations:

```js
{ ok: true, item }
{ ok: false, reason: '险种词典校验失败', errors }
```

- [ ] **Step 5: Run store tests to verify GREEN**

Run: `node --test src/server/__tests__/adminConfigStore.test.js`

Expected: PASS.

- [ ] **Step 6: Run existing fallback test**

Run: `node --test src/server/__tests__/authStoreFallback.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/server/db.js src/server/adminConfigStore.js src/server/__tests__/adminConfigStore.test.js
git commit -m "feat: persist admin config"
```

## Task 4: API Routes

**Files:**
- Create: `app/api/admin/dictionaries/insurance-types/route.js`
- Create: `app/api/admin/dictionaries/insurance-types/[id]/route.js`
- Create: `app/api/admin/schedules/route.js`
- Create: `src/server/__tests__/adminConfigRoutes.test.js`

- [ ] **Step 1: Write failing route tests**

Use direct route invocation with fake `cookies.get()` where practical. Cover:

- routes import and call `requireAdminUser`
- missing user returns 401
- non-admin returns 403
- admin GET insurance returns list
- admin POST/PATCH returns 400 on validation failure
- admin schedule PUT returns structured validation errors

- [ ] **Step 2: Run route tests to verify RED**

Run: `node --test src/server/__tests__/adminConfigRoutes.test.js`

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement routes**

For every handler:

```js
const auth = requireAdminUser(getSessionUserFromRequest(request));
if (!auth.ok) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}
```

Then call store functions and return 200/400 as appropriate.

- [ ] **Step 4: Run route tests to verify GREEN**

Run: `node --test src/server/__tests__/adminConfigRoutes.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/api/admin src/server/__tests__/adminConfigRoutes.test.js
git commit -m "feat: add admin config api"
```

## Task 5: Protected Pages And Navigation

**Files:**
- Modify: `src/components/Layout/AppLayout.jsx`
- Modify: `src/components/Layout/__tests__/appLayout.test.js`
- Create: `app/(protected)/dictionaries/insurance-types/page.jsx`
- Create: `app/(protected)/schedules/page.jsx`

- [ ] **Step 1: Write failing navigation tests**

Extend `appLayout.test.js`:

```js
test('administrator has dictionary and schedule navigation entries', () => {
  assert.match(appLayoutSource, /ROLES\.ADMIN/);
  assert.match(appLayoutSource, /href="\/dictionaries\/insurance-types"/);
  assert.match(appLayoutSource, /href="\/schedules"/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/dictionaries\/insurance-types'\)/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/schedules'\)/);
});
```

- [ ] **Step 2: Run layout test to verify RED**

Run: `node --test src/components/Layout/__tests__/appLayout.test.js`

Expected: FAIL because links do not exist.

- [ ] **Step 3: Implement navigation and page titles**

Add icons from `@ant-design/icons`, admin-only menu items, selected keys, and page titles.

- [ ] **Step 4: Create protected server pages**

Use cookies and admin guard:

- not logged in: redirect to login
- non-admin: render an Ant Design result or simple no-permission view
- admin: render client view component

- [ ] **Step 5: Run layout test to verify GREEN**

Run: `node --test src/components/Layout/__tests__/appLayout.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/Layout/AppLayout.jsx src/components/Layout/__tests__/appLayout.test.js app/'(protected)'/dictionaries app/'(protected)'/schedules
git commit -m "feat: add admin config navigation"
```

## Task 6: Insurance Dictionary UI

**Files:**
- Create: `src/views/AdminInsuranceDictionary/index.jsx`

- [ ] **Step 1: Write lightweight source test**

Create or extend a UI source test to assert the view:

- calls `/api/admin/dictionaries/insurance-types`
- uses `Table`
- uses `Modal`
- uses `Switch`
- has add/edit/save operations

- [ ] **Step 2: Run UI source test to verify RED**

Run the new test with `node --test`.

- [ ] **Step 3: Implement insurance dictionary page**

Use:

- `useEffect` load list
- `Table` with code/name/enabled/updatedAt/actions
- `Modal` form for add/edit
- `Switch` to enable/disable through PATCH
- `message` success/error
- `Alert` for load or save errors

- [ ] **Step 4: Run UI test to verify GREEN**

Run the UI source test.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/views/AdminInsuranceDictionary src/views/**/__tests__
git commit -m "feat: add insurance dictionary page"
```

## Task 7: Schedule Config UI

**Files:**
- Create: `src/views/AdminScheduleConfig/index.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write lightweight source test**

Assert the view:

- calls `/api/admin/schedules`
- renders editable groups
- uses `SYSTEM_OPTIONS`
- lets users add insurance teams
- restricts personnel options to `users`
- saves with `PUT`

- [ ] **Step 2: Run UI source test to verify RED**

Run the new test with `node --test`.

- [ ] **Step 3: Implement schedule config page**

Use `Form.List` style or controlled local state. Keep state simple:

- groups array in React state
- helper functions add/remove/update groups
- helper functions add/remove/update teams
- save sends `{ groups }`
- render server validation errors in a top `Alert`

- [ ] **Step 4: Add compact admin styles**

Add minimal classes:

- `.admin-config-page`
- `.admin-config-toolbar`
- `.schedule-group-card`
- `.schedule-team-panel`

- [ ] **Step 5: Run UI source test to verify GREEN**

Run the UI source test.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/views/AdminScheduleConfig src/index.css src/views/**/__tests__
git commit -m "feat: add schedule config page"
```

## Task 8: Full Verification

**Files:**
- No new files unless fixes are needed.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
node --test src/utils/__tests__/adminConfigValidation.test.js
node --test src/server/__tests__/adminAuth.test.js
node --test src/server/__tests__/adminConfigStore.test.js
node --test src/server/__tests__/adminConfigRoutes.test.js
node --test src/components/Layout/__tests__/appLayout.test.js
```

Expected: all PASS.

- [ ] **Step 2: Run all current tests**

Run:

```bash
node --test "src/**/*.test.js"
```

If PowerShell glob handling fails, use:

```bash
Get-ChildItem -Path src -Recurse -Filter *.test.js | ForEach-Object { node --test $_.FullName }
```

Expected: all PASS.

- [ ] **Step 3: Run build**

Run:

```bash
pnpm build
```

Expected: Next.js build succeeds.

- [ ] **Step 4: Manual smoke**

Run:

```bash
pnpm dev
```

Open the app, log in as `admin / 123456`, verify:

- top nav shows `险种词典` and `排班配置`
- create/edit/disable an insurance type works
- schedule config loads systems, L1 users, enabled insurance types
- invalid duplicate system blocks save
- invalid duplicate insurance in a group blocks save
- valid schedule saves and reloads

- [ ] **Step 5: Final status**

Run:

```bash
git status --short
```

Expected: only intended changes remain.
