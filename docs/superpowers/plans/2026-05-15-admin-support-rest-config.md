# Admin Support Rest Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an administrator-only support rest time configuration page, API, validation, storage, upcoming rest list, and second-level admin navigation.

**Architecture:** Keep rest configuration independent from ticket dispatch and ticket state transitions. Reuse the existing admin config storage pattern in `app_configs`, shared validation in `src/utils/adminConfigValidation.js`, admin route authorization, and Ant Design admin page conventions.

**Tech Stack:** Next.js App Router, React, Ant Design, Node `node:test`, SQLite/JSON fallback store.

---

## Files

- Modify: `docs/superpowers/prompts/2026-05-15-admin-support-rest-config-prompts.md`
- Modify: `src/utils/adminConfigValidation.js`
- Modify: `src/utils/__tests__/adminConfigValidation.test.js`
- Modify: `src/server/adminConfigStore.js`
- Modify: `src/server/__tests__/adminConfigStore.test.js`
- Modify: `src/server/__tests__/adminConfigRoutes.test.js`
- Create: `app/api/admin/support-rests/route.js`
- Create: `app/(protected)/support-rests/page.jsx`
- Create: `src/views/AdminSupportRestConfig/index.jsx`
- Create: `src/views/AdminSupportRestConfig/__tests__/adminSupportRestConfigView.test.js`
- Modify: `src/components/Layout/AppLayout.jsx`
- Modify: `src/components/Layout/__tests__/appLayout.test.js`
- Modify if needed: `src/index.css`

### Task 1: Support Rest Validation

**Files:**
- Modify: `src/utils/__tests__/adminConfigValidation.test.js`
- Modify: `src/utils/adminConfigValidation.js`

- [ ] **Step 1: Write failing validation tests**

Add tests for missing L1 users, invalid time order, non-L1 user rejection, overlapping rest periods, adjacent period allowance, and upcoming day grouping.

- [ ] **Step 2: Run validation tests to verify failure**

Run: `node --test src/utils/__tests__/adminConfigValidation.test.js`

Expected: FAIL because `validateSupportRestConfig`, `normalizeSupportRestConfig`, `buildUpcomingSupportRestDays`, and `SUPPORT_REST_CONFIG_KEY` are not exported.

- [ ] **Step 3: Implement validation and upcoming list helpers**

Add `SUPPORT_REST_CONFIG_KEY`, normalization, validation, overlap detection, and future day grouping in `src/utils/adminConfigValidation.js`.

- [ ] **Step 4: Run validation tests to verify pass**

Run: `node --test src/utils/__tests__/adminConfigValidation.test.js`

Expected: PASS.

### Task 2: Store and API

**Files:**
- Modify: `src/server/__tests__/adminConfigStore.test.js`
- Modify: `src/server/__tests__/adminConfigRoutes.test.js`
- Modify: `src/server/adminConfigStore.js`
- Create: `app/api/admin/support-rests/route.js`

- [ ] **Step 1: Write failing store and route tests**

Add tests for saving/reading rest config, updater metadata, invalid config errors, admin auth for GET/PUT, and GET returning L1 users plus upcoming rest days.

- [ ] **Step 2: Run store and route tests to verify failure**

Run: `node --test src/server/__tests__/adminConfigStore.test.js src/server/__tests__/adminConfigRoutes.test.js`

Expected: FAIL because rest config store exports and route file do not exist.

- [ ] **Step 3: Implement store functions and route**

Add `getSupportRestConfig()` and `saveSupportRestConfig()` in `adminConfigStore.js`. Add `GET` and `PUT` handlers in `app/api/admin/support-rests/route.js`.

- [ ] **Step 4: Run store and route tests to verify pass**

Run: `node --test src/server/__tests__/adminConfigStore.test.js src/server/__tests__/adminConfigRoutes.test.js`

Expected: PASS.

### Task 3: Protected Page and Navigation

**Files:**
- Modify: `src/components/Layout/__tests__/appLayout.test.js`
- Modify: `src/components/Layout/AppLayout.jsx`
- Create: `app/(protected)/support-rests/page.jsx`

- [ ] **Step 1: Write failing navigation/page tests**

Update layout tests to expect a second-level `后台管理` menu with account, dictionary, schedule, and rest config entries.

- [ ] **Step 2: Run layout tests to verify failure**

Run: `node --test src/components/Layout/__tests__/appLayout.test.js`

Expected: FAIL because `/support-rests` and second-level admin menu are absent.

- [ ] **Step 3: Implement nested admin navigation and protected page**

Use Ant Design `Menu` children for admin entries. Add protected page matching existing admin page pattern.

- [ ] **Step 4: Run layout tests to verify pass**

Run: `node --test src/components/Layout/__tests__/appLayout.test.js`

Expected: PASS.

### Task 4: Admin Support Rest UI

**Files:**
- Create: `src/views/AdminSupportRestConfig/__tests__/adminSupportRestConfigView.test.js`
- Create: `src/views/AdminSupportRestConfig/index.jsx`
- Modify if needed: `src/index.css`

- [ ] **Step 1: Write failing view source test**

Assert that the view calls `/api/admin/support-rests`, uses L1 user options, supports add/delete/save, and contains future range options 7/14/30.

- [ ] **Step 2: Run view test to verify failure**

Run: `node --test src/views/AdminSupportRestConfig/__tests__/adminSupportRestConfigView.test.js`

Expected: FAIL because the view file does not exist.

- [ ] **Step 3: Implement the React page**

Build a compact Ant Design page with editable rest period rows, validation error display, save/refresh actions, range selector, and upcoming rest list.

- [ ] **Step 4: Run view test to verify pass**

Run: `node --test src/views/AdminSupportRestConfig/__tests__/adminSupportRestConfigView.test.js`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- All touched files.

- [ ] **Step 1: Run targeted tests**

Run: `node --test src/utils/__tests__/adminConfigValidation.test.js src/server/__tests__/adminConfigStore.test.js src/server/__tests__/adminConfigRoutes.test.js src/components/Layout/__tests__/appLayout.test.js src/views/AdminSupportRestConfig/__tests__/adminSupportRestConfigView.test.js`

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 3: Review diff**

Run: `git diff --stat` and `git diff --check`

Expected: no whitespace errors; changes are scoped to rest config, navigation, docs, tests, and optional CSS.
