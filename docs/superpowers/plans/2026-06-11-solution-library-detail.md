# Solution Library Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional third-party data-fix scheme association plus solution detail and reference drawers.

**Architecture:** Extend the existing JSON snapshot model in `solutionLibrary.js` and `solutionLibraryStore.js`. Add small route handlers for third-party search, solution detail, and paginated references. Keep the React admin page in the existing Ant Design table/modal style.

**Tech Stack:** Next.js route handlers, Ant Design, Node test runner, SQLite-backed JSON store.

---

### Task 1: Utility Model

**Files:**
- Modify: `src/utils/solutionLibrary.js`
- Test: `src/utils/__tests__/solutionLibrary.test.js`

- [ ] Write failing tests for nullable single third-party association and snapshot/export behavior.
- [ ] Run `node --test src/utils/__tests__/solutionLibrary.test.js` and confirm failure.
- [ ] Implement normalization, snapshot, export/import fields.
- [ ] Run the utility test and confirm pass.

### Task 2: Store Queries

**Files:**
- Modify: `src/server/solutionLibraryStore.js`
- Test: `src/server/__tests__/solutionLibraryStore.test.js`

- [ ] Write failing tests for detail version snapshots, rollback preservation, and paginated searched reference list.
- [ ] Run `node --test src/server/__tests__/solutionLibraryStore.test.js` and confirm failure.
- [ ] Implement third-party snapshot persistence and `listSolutionReferencesPage`.
- [ ] Run the store test and confirm pass.

### Task 3: API Routes

**Files:**
- Create: `app/api/admin/third-party-data-fix-schemes/route.js`
- Create: `app/api/admin/solutions/[id]/references/route.js`
- Modify: `app/api/admin/solutions/[id]/route.js`
- Test: `src/server/__tests__/adminSolutionRoutes.test.js`

- [ ] Write failing route tests for third-party search, solution detail, and reference pagination.
- [ ] Run `node --test src/server/__tests__/adminSolutionRoutes.test.js` and confirm failure.
- [ ] Implement routes using admin authorization.
- [ ] Run the route test and confirm pass.

### Task 4: Admin Page

**Files:**
- Modify: `src/views/AdminSolutions/index.jsx`
- Test: `src/views/AdminSolutions/__tests__/adminSolutionsView.test.js`

- [ ] Write failing source-level assertions for searchable single select, code/title drawer triggers, detail drawer, version list, reference drawer, search, and pagination.
- [ ] Run `node --test src/views/AdminSolutions/__tests__/adminSolutionsView.test.js` and confirm failure.
- [ ] Implement modal select, detail drawer, and references drawer.
- [ ] Run the admin view test and confirm pass.

### Task 5: Verification

- [ ] Run targeted tests:
  - `node --test src/utils/__tests__/solutionLibrary.test.js src/server/__tests__/solutionLibraryStore.test.js src/server/__tests__/adminSolutionRoutes.test.js src/views/AdminSolutions/__tests__/adminSolutionsView.test.js`
- [ ] Run `npm run build`.
- [ ] Review `git diff` for unrelated changes.
