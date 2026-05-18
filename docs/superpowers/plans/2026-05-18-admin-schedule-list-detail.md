# Admin Schedule List Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split administrator schedule configuration into a searchable rule list and a reusable create/edit detail page.

**Architecture:** Keep the existing schedule config API and storage model. Add small pure view-model helpers for search and display summaries, make `/schedules` the list page, and add protected dynamic routes for `/schedules/new` and `/schedules/[groupId]` that reuse a detail component. Save still submits the full `{ groups }` config through `PUT /api/admin/schedules`.

**Tech Stack:** Next.js App Router, React 18, Ant Design, Node test runner.

---

### Task 1: Add Schedule View-Model Helpers

**Files:**
- Create: `src/views/AdminScheduleConfig/scheduleConfigViewModel.js`
- Create: `src/views/AdminScheduleConfig/__tests__/scheduleConfigViewModel.test.js`

- [ ] **Step 1: Write failing tests**

Test helper behavior:
- `buildScheduleGroupRow` maps system codes to labels.
- `buildScheduleGroupRow` summarizes base schedule and insurance team users.
- `filterScheduleGroups` matches system label/code.
- `filterScheduleGroups` matches user name/username/id from base schedule and insurance teams.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/views/AdminScheduleConfig/__tests__/scheduleConfigViewModel.test.js`

Expected: FAIL because `scheduleConfigViewModel.js` does not exist.

- [ ] **Step 3: Implement helpers**

Add:
- `buildScheduleGroupRow(group, context)`
- `filterScheduleGroups(groups, filters, context)`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/views/AdminScheduleConfig/__tests__/scheduleConfigViewModel.test.js`

Expected: PASS.

### Task 2: Refactor Schedule UI Into List and Detail Components

**Files:**
- Modify: `src/views/AdminScheduleConfig/index.jsx`
- Create: `src/views/AdminScheduleConfig/ScheduleDetailPage.jsx`
- Modify: `src/views/AdminScheduleConfig/__tests__/adminScheduleConfigView.test.js`

- [ ] **Step 1: Write failing UI source tests**

Update source tests to assert:
- list page uses `Table`
- list page contains `系统搜索`, `人员搜索`, `分组名称`, `系统范围`, `相应人员`, `编辑`
- detail page contains `基础排班`, `险种排班小组`, `method: 'PUT'`, `validateScheduleConfig`

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/views/AdminScheduleConfig/__tests__/adminScheduleConfigView.test.js`

Expected: FAIL because current page is still single-page editing and detail component is absent.

- [ ] **Step 3: Implement list page**

Make `index.jsx` load config/options, render search controls and table, and link to `/schedules/new` and `/schedules/{groupId}`.

- [ ] **Step 4: Implement detail page**

Move existing group editing behavior into `ScheduleDetailPage.jsx`, scoped to one group. Keep existing validation and `PUT /api/admin/schedules` save path.

- [ ] **Step 5: Run UI source tests**

Run: `node --test src/views/AdminScheduleConfig/__tests__/adminScheduleConfigView.test.js`

Expected: PASS.

### Task 3: Add Protected Detail Routes

**Files:**
- Create: `app/(protected)/schedules/new/page.jsx`
- Create: `app/(protected)/schedules/[groupId]/page.jsx`
- Modify: `src/views/AdminScheduleConfig/__tests__/adminScheduleConfigView.test.js`

- [ ] **Step 1: Write failing route source tests**

Assert source for both route files imports `ScheduleDetailPage`, checks `ROLES.ADMIN`, redirects unauthenticated users, and passes mode/groupId.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/views/AdminScheduleConfig/__tests__/adminScheduleConfigView.test.js`

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement routes**

Add the same protection pattern used by `app/(protected)/schedules/page.jsx`.

- [ ] **Step 4: Run route tests**

Run: `node --test src/views/AdminScheduleConfig/__tests__/adminScheduleConfigView.test.js`

Expected: PASS.

### Task 4: Verification

**Files:**
- Run-only verification.

- [ ] **Step 1: Run focused tests**

Run:
- `node --test src/views/AdminScheduleConfig/__tests__/scheduleConfigViewModel.test.js`
- `node --test src/views/AdminScheduleConfig/__tests__/adminScheduleConfigView.test.js`

- [ ] **Step 2: Run related tests**

Run:
- `node --test src/utils/__tests__/adminConfigValidation.test.js`
- `node --test src/server/__tests__/adminConfigRoutes.test.js`

- [ ] **Step 3: Check git status**

Run: `git status --short`

Expected: only intentional files changed plus ignored/temporary local companion files.
