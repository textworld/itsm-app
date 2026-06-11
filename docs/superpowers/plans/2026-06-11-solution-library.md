# Solution Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build phase-one global standard solution library with independent SQLite storage, admin management, versioning, permission-filtered ticket references, Excel import/export, and citation audit records that preserve solution version snapshots.

**Architecture:** Add a new solution-library domain beside the existing announcement and admin-config domains. Keep pure validation/filter/import/export helpers in `src/utils/solutionLibrary.js`, persistence and cross-domain ticket citation in `src/server/solutionLibraryStore.js`, and expose focused Next route handlers under `/api/admin/solutions`, `/api/solutions/referenceable`, and `/api/workflow/tickets/[id]/solution-references`. Frontend work adds an admin page and a ticket-message reference flow without directly mutating ticket status fields.

**Tech Stack:** Next.js App Router route handlers, React client components, Ant Design, Node test runner, JSON-rich SQLite rows via `better-sqlite3` with existing JSON fallback store, existing rich text helpers, existing ticket message storage.

---

## File Structure

Create:

- `src/utils/solutionLibrary.js`  
  Pure solution constants, normalization, validation, filtering, permission checks, version snapshot builders, import/export row mapping.
- `src/utils/__tests__/solutionLibrary.test.js`  
  Unit tests for validation, permissions, filtering, version snapshots, import/export mapping.
- `src/server/solutionLibraryStore.js`  
  Persistence, version writes, reference writes, stats updates, admin option loading, import/export service functions.
- `src/server/__tests__/solutionLibraryStore.test.js`  
  Store/service tests for CRUD, versions, rollback, references, stats, deletion history.
- `src/server/__tests__/solutionLibraryRoutes.test.js`  
  Route tests for admin APIs, referenceable API, ticket reference API, import/export status.
- `src/views/AdminSolutions/index.jsx`  
  Admin list/detail/editor/import/export UI.
- `src/views/AdminSolutions/__tests__/adminSolutionsView.test.js`  
  Static tests for admin UI fields and interactions.
- `app/(protected)/solutions/page.jsx`  
  Protected admin page route.
- `app/api/admin/solutions/route.js`
- `app/api/admin/solutions/[id]/route.js`
- `app/api/admin/solutions/[id]/enable/route.js`
- `app/api/admin/solutions/[id]/rollback/route.js`
- `app/api/admin/solutions/bulk-status/route.js`
- `app/api/admin/solutions/export/route.js`
- `app/api/admin/solutions/template/route.js`
- `app/api/admin/solutions/import/route.js`
- `app/api/solutions/referenceable/route.js`
- `app/api/workflow/tickets/[id]/solution-references/route.js`

Modify:

- `src/server/db.js`  
  Add SQLite tables and JSON fallback tables for `solutions`, `solution_versions`, `solution_references`; update fallback `prepare().get/all/run` handlers.
- `src/server/store.js`  
  Add a small helper if needed to append multiple messages to a ticket atomically, or let `solutionLibraryStore.js` read/upsert through existing public functions without status mutation.
- `src/context/TicketContext.jsx`  
  Add `referenceSolution(ticketId, solutionId)` client action wrapping the new workflow API.
- `src/components/TicketDetail/MessageBoard.jsx`  
  Add solution reference button/modal and display `solutionReference` tag on referenced messages.
- `src/components/TicketDetail/messageComposer.js`  
  Add helpers for building solution reference message content and preserving metadata.
- `src/components/TicketDetail/__tests__/messageComposer.test.js`
- `src/components/TicketDetail/__tests__/actionAreaUi.test.js` or create `solutionReferenceUi.test.js` if clearer.
- `src/components/Layout/AppLayout.jsx`
- `src/components/Layout/__tests__/appLayout.test.js`

Do not modify ticket status, requesterStatus, supportStatus, or processingSubStatus directly. Any ticket business status change must continue to go through `src/state-machine/ticketStateMachine.js`; this feature only appends ticket messages/logs.

---

### Task 1: Database Tables And Fallback Storage

**Files:**
- Modify: `src/server/db.js`
- Test: `src/server/__tests__/solutionLibraryStore.test.js`

- [ ] **Step 1: Write the failing storage smoke test**

Create `src/server/__tests__/solutionLibraryStore.test.js` with an initial test that imports `reseedDb` and `getDb`, then asserts the three new tables accept and read JSON rows.

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { getDb, reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('solution library tables store current rows, versions, and references', () => {
  const db = getDb();
  db.prepare(`
    INSERT INTO solutions (id, code, title, enabled, version_no, updated_at, data)
    VALUES (@id, @code, @title, @enabled, @version_no, @updated_at, @data)
  `).run({
    id: 'sol_1',
    code: 'SOL-001',
    title: '保单状态修正',
    enabled: 1,
    version_no: 1,
    updated_at: '2026-06-11T00:00:00.000Z',
    data: JSON.stringify({ id: 'sol_1', title: '保单状态修正' })
  });

  db.prepare(`
    INSERT INTO solution_versions (id, solution_id, version_no, change_type, created_at, data)
    VALUES (@id, @solution_id, @version_no, @change_type, @created_at, @data)
  `).run({
    id: 'ver_1',
    solution_id: 'sol_1',
    version_no: 1,
    change_type: 'CREATE',
    created_at: '2026-06-11T00:00:00.000Z',
    data: JSON.stringify({ snapshot: { id: 'sol_1', versionNo: 1 } })
  });

  db.prepare(`
    INSERT INTO solution_references (id, solution_id, ticket_id, version_no, quoted_at, data)
    VALUES (@id, @solution_id, @ticket_id, @version_no, @quoted_at, @data)
  `).run({
    id: 'ref_1',
    solution_id: 'sol_1',
    ticket_id: 'TKT-001',
    version_no: 1,
    quoted_at: '2026-06-11T00:00:00.000Z',
    data: JSON.stringify({ snapshot: { title: '保单状态修正' } })
  });

  assert.equal(db.prepare('SELECT data FROM solutions WHERE id = ?').get('sol_1') !== undefined, true);
  assert.equal(db.prepare('SELECT data FROM solution_versions WHERE solution_id = ? ORDER BY version_no DESC').all('sol_1').length, 1);
  assert.equal(db.prepare('SELECT data FROM solution_references WHERE solution_id = ? ORDER BY quoted_at DESC').all('sol_1').length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test src/server/__tests__/solutionLibraryStore.test.js
```

Expected: FAIL because `solutions`, `solution_versions`, and `solution_references` do not exist or fallback does not handle them.

- [ ] **Step 3: Add SQLite table creation**

In `src/server/db.js`, extend `db.exec`:

```sql
CREATE TABLE IF NOT EXISTS solutions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  version_no INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS solution_versions (
  id TEXT PRIMARY KEY,
  solution_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  change_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS solution_references (
  id TEXT PRIMARY KEY,
  solution_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  quoted_at TEXT NOT NULL,
  data TEXT NOT NULL
);
```

Add indexes after tables if desired:

```sql
CREATE INDEX IF NOT EXISTS idx_solution_versions_solution_id ON solution_versions(solution_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_solution_references_solution_id ON solution_references(solution_id, quoted_at DESC);
CREATE INDEX IF NOT EXISTS idx_solution_references_ticket_id ON solution_references(ticket_id, quoted_at DESC);
```

- [ ] **Step 4: Extend JSON fallback**

In `createEmptyTables()`, add:

```js
solutions: [],
solution_versions: [],
solution_references: []
```

In `JsonFallbackStatement.get/all/run`, add handlers for:

- `select data from solutions where id = ?`
- `select data from solutions where code = ?`
- `select data from solutions order by updated_at desc`
- `select data from solution_versions where solution_id = ? order by version_no desc`
- `select data from solution_versions where solution_id = ? and version_no = ?`
- `select data from solution_references where solution_id = ? order by quoted_at desc`
- `select data from solution_references where ticket_id = ? order by quoted_at desc`
- `insert into solutions`
- `insert into solution_versions`
- `insert into solution_references`
- `delete from solutions where id = ?`
- `delete from solutions`, `delete from solution_versions`, `delete from solution_references` during reseed if force resets all domain data.

- [ ] **Step 5: Run storage test**

Run:

```powershell
node --test src/server/__tests__/solutionLibraryStore.test.js
```

Expected: PASS for the smoke test.

- [ ] **Step 6: Commit**

```powershell
git add src/server/db.js src/server/__tests__/solutionLibraryStore.test.js
git commit -m "feat: add solution library storage tables"
```

---

### Task 2: Pure Solution Library Utilities

**Files:**
- Create: `src/utils/solutionLibrary.js`
- Test: `src/utils/__tests__/solutionLibrary.test.js`

- [ ] **Step 1: Write failing utility tests**

Create tests covering required fields, optional arrays, permission checks, filtering, snapshot creation, and import/export mapping.

Key test cases:

```js
test('validateSolutionInput normalizes core fields and rich text', () => {});
test('validateSolutionInput rejects missing code title description and detail', () => {});
test('canReferenceSolution allows company-wide L1 and L2 only when enabled', () => {});
test('canReferenceSolution honors assigned group roles', () => {});
test('filterSolutions searches keyword and classification dimensions', () => {});
test('buildSolutionSnapshot preserves versioned display content', () => {});
test('mapSolutionToExportRow and parseSolutionImportRow round-trip display values', () => {});
```

Use existing helpers from `src/utils/richText.js` for rich text HTML/plain text behavior.

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test src/utils/__tests__/solutionLibrary.test.js
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement constants and normalization**

In `src/utils/solutionLibrary.js`, export:

```js
export const SOLUTION_EDIT_PERMISSION = {
  ADMIN_ONLY: 'ADMIN_ONLY',
  ASSIGNED_TEAMS: 'ASSIGNED_TEAMS'
};

export const SOLUTION_REFERENCE_PERMISSION = {
  COMPANY: 'COMPANY',
  ASSIGNED_GROUPS: 'ASSIGNED_GROUPS'
};

export const SOLUTION_CHANGE_TYPE = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  ENABLE: 'ENABLE',
  DISABLE: 'DISABLE',
  ROLLBACK: 'ROLLBACK',
  IMPORT: 'IMPORT'
};

export const SOLUTION_REFERENCE_CHANNEL = {
  MESSAGE_REPLY: 'MESSAGE_REPLY'
};
```

Implement:

- `normalizeSolutionInput(input, context)`
- `validateSolutionInput(input, context)`
- `buildSolutionSnapshot(solution)`
- `filterSolutions(solutions, filters)`
- `canEditSolution(solution, user)`
- `canReferenceSolution(solution, user)`
- `mapSolutionToExportRow(solution, context)`
- `parseSolutionImportRow(row, context)`

Validation rules:

- `code`, `title`, `description`, and rich text detail are required.
- `code` normalized by trimming and uppercasing.
- `insuranceTypeIds`, `relatedInternalSchemeIds`, `ticketTypes`, `systemCodes`, `problemTypeIds` are arrays of strings.
- `systemCodes` normalized to uppercase and validated against configured systems when context is supplied.
- Permission values default to `ADMIN_ONLY` and `COMPANY`.
- Role groups only accept `L1` and `L2`.

- [ ] **Step 4: Run utility tests**

Run:

```powershell
node --test src/utils/__tests__/solutionLibrary.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/utils/solutionLibrary.js src/utils/__tests__/solutionLibrary.test.js
git commit -m "feat: add solution library utilities"
```

---

### Task 3: Solution Store CRUD, Versions, Rollback, And References

**Files:**
- Create: `src/server/solutionLibraryStore.js`
- Modify: `src/server/__tests__/solutionLibraryStore.test.js`

- [ ] **Step 1: Add failing service tests**

Extend `solutionLibraryStore.test.js` to import service functions and test:

- Create creates current row and v1 `CREATE`.
- Edit increments version and writes `UPDATE`.
- Enable/disable increments version and writes `ENABLE` or `DISABLE`.
- Bulk status updates multiple rows.
- Rollback to v1 creates new version and current row uses v1 snapshot with new version number.
- Reference writes `solution_references` with `versionNo` and `snapshot`, increments stats.
- Referencing v2 then editing to v3 leaves reference snapshot at v2.
- Delete removes current row but leaves versions and references.

Representative assertion:

```js
assert.equal(reference.versionNo, 2);
assert.equal(reference.snapshot.title, 'v2 title');
assert.equal(updatedSolution.versionNo, 3);
assert.equal(reference.snapshot.title, 'v2 title');
```

- [ ] **Step 2: Run service tests to verify failure**

Run:

```powershell
node --test src/server/__tests__/solutionLibraryStore.test.js
```

Expected: FAIL because store functions do not exist.

- [ ] **Step 3: Implement persistence helpers**

Create `src/server/solutionLibraryStore.js` with:

- `parseRow(row)`
- `nowIso()`
- `actorFromUser(user)`
- `upsertSolution(solution)`
- `insertSolutionVersion(solution, changeType, user)`
- `insertSolutionReference(reference)`
- `getSolutionById(id)`
- `getSolutionByCode(code)`
- `listAllSolutions()`
- `listSolutionVersions(solutionId)`
- `listSolutionReferences(solutionId)`

Use SQL matching existing store style:

```js
db.prepare(`
  INSERT INTO solutions (id, code, title, enabled, version_no, updated_at, data)
  VALUES (@id, @code, @title, @enabled, @version_no, @updated_at, @data)
  ON CONFLICT(id) DO UPDATE SET
    code = excluded.code,
    title = excluded.title,
    enabled = excluded.enabled,
    version_no = excluded.version_no,
    updated_at = excluded.updated_at,
    data = excluded.data
`).run(...);
```

- [ ] **Step 4: Implement service operations**

Export:

- `listSolutions(filters = {}, user = null)`
- `listReferenceableSolutions(ticket = {}, user = null, filters = {})`
- `getSolutionDetail(id)`
- `createSolution(input, user)`
- `updateSolution(id, input, user, options = {})`
- `deleteSolution(id, user)`
- `setSolutionEnabled(id, enabled, user)`
- `bulkSetSolutionEnabled(ids, enabled, user)`
- `rollbackSolution(id, versionNo, user)`
- `referenceSolution({ solutionId, ticketId, channel }, user)`

Reference behavior:

- Load current solution.
- Reject missing, disabled, or unauthorized solution.
- Build reference snapshot using current `versionNo`.
- Create `messageItem` with `solutionReference` metadata and rich content derived from the snapshot.
- Create `systemLogMessage` starting with `【系统】`.
- Return both messages and the `reference` object. Ticket persistence will be done in the workflow route so request auth and ticket existence stay close to route handling.

- [ ] **Step 5: Run service tests**

Run:

```powershell
node --test src/server/__tests__/solutionLibraryStore.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/server/solutionLibraryStore.js src/server/__tests__/solutionLibraryStore.test.js
git commit -m "feat: add solution library store"
```

---

### Task 4: Admin And Reference API Routes

**Files:**
- Create route files under `app/api/admin/solutions/**`
- Create: `app/api/solutions/referenceable/route.js`
- Create: `app/api/workflow/tickets/[id]/solution-references/route.js`
- Modify: `src/server/store.js` only if an append-multiple helper is needed
- Test: `src/server/__tests__/solutionLibraryRoutes.test.js`

- [ ] **Step 1: Write failing route tests**

Create route tests that import route handlers directly, following `announcementRoutes.test.js` style:

- Unauthenticated admin routes return 401.
- Non-admin admin routes return 403.
- Admin create returns current solution v1.
- Admin update returns v2.
- Enable route toggles status and records version.
- Bulk status route toggles two rows.
- Rollback route creates new version.
- Referenceable route allows `L1`/`L2` and filters unauthorized solutions.
- Workflow ticket reference route appends visible message and system log, and response includes `reference.versionNo`.

- [ ] **Step 2: Run route tests to verify failure**

Run:

```powershell
node --test src/server/__tests__/solutionLibraryRoutes.test.js
```

Expected: FAIL because route modules do not exist.

- [ ] **Step 3: Implement admin routes**

Use existing auth helpers:

```js
import { NextResponse } from 'next/server.js';
import { requireAdminUser } from '../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
```

Each admin route should:

- Authorize admin.
- Parse JSON safely; malformed JSON returns 400 `{ ok: false, reason: '请求体格式错误' }`.
- Call the corresponding `solutionLibraryStore` function.
- Return 200 for ok, 400/403/404 based on service result status if provided.

- [ ] **Step 4: Implement `GET /api/solutions/referenceable`**

Route behavior:

- Require login.
- Load `ticketId` query if supplied and fetch ticket using `getTicketById`.
- Pass ticket and user to `listReferenceableSolutions`.
- Return `{ ok: true, solutions }`.

- [ ] **Step 5: Implement workflow reference route**

Route behavior:

- Require login.
- Load ticket by id. Return 404 if missing.
- Parse `{ solutionId }`.
- Call `referenceSolution({ solutionId, ticketId: params.id, channel: MESSAGE_REPLY }, user)`.
- Append returned visible message and system log to the ticket without changing statuses.

If adding helper to `src/server/store.js`, use:

```js
export function addMessagesToTicket(ticketId, messages = []) {
  const ticket = getTicketById(ticketId);
  if (!ticket) return null;

  return upsertTicket({
    ...ticket,
    messages: [...(ticket.messages || []), ...messages],
    updatedAt: new Date().toISOString()
  });
}
```

- [ ] **Step 6: Run route tests**

Run:

```powershell
node --test src/server/__tests__/solutionLibraryRoutes.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add app/api/admin/solutions app/api/solutions app/api/workflow/tickets/[id]/solution-references src/server/store.js src/server/__tests__/solutionLibraryRoutes.test.js
git commit -m "feat: expose solution library APIs"
```

---

### Task 5: Excel Template, Import, And Export

**Files:**
- Modify: `src/utils/solutionLibrary.js`
- Modify: `src/server/solutionLibraryStore.js`
- Modify: `app/api/admin/solutions/export/route.js`
- Modify: `app/api/admin/solutions/template/route.js`
- Modify: `app/api/admin/solutions/import/route.js`
- Test: `src/utils/__tests__/solutionLibrary.test.js`
- Test: `src/server/__tests__/solutionLibraryRoutes.test.js`

- [ ] **Step 1: Add failing import/export tests**

In utility tests:

- Export row uses display names for insurance/system/problem types.
- Import row resolves display names/codes to IDs.
- Invalid row returns row-level errors.

In route tests:

- Template returns Excel content type.
- Export returns Excel content type.
- Import with invalid workbook returns 400 with row errors.
- Import with valid workbook creates or updates by code and writes version.

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test src/utils/__tests__/solutionLibrary.test.js src/server/__tests__/solutionLibraryRoutes.test.js
```

Expected: FAIL for missing workbook implementation.

- [ ] **Step 3: Locate workbook dependency**

Use the bundled workspace dependencies if needed:

```powershell
npm ls xlsx
```

If `xlsx` is available, use it. If not, implement HTML Excel export like the existing permission template and document import as CSV-compatible `.xls` parsing only if tests can support it. Prefer `xlsx` if dependency exists.

- [ ] **Step 4: Implement export/template**

Expose service functions:

- `buildSolutionTemplateWorkbook()`
- `buildSolutionExportWorkbook(filters)`

Template/export columns exactly match the spec:

```js
[
  '方案编码',
  '方案标题',
  '方案描述',
  '详细说明',
  '启用状态',
  '适用险种',
  '关联内部方案',
  '工单类型',
  '业务系统',
  '问题类型',
  '编辑权限',
  '编辑团队',
  '引用权限',
  '引用处理组'
]
```

- [ ] **Step 5: Implement import**

For `POST /api/admin/solutions/import`:

- Accept multipart file if current upload patterns exist; otherwise accept raw binary body with filename query for phase one.
- Parse rows.
- Validate all rows before mutating.
- If any error exists, return 400 with row-level errors.
- Upsert by `code`.
- Existing code updates current solution and creates `IMPORT` version.
- New code creates current solution and `IMPORT` or `CREATE` version; choose `IMPORT` for traceability.

- [ ] **Step 6: Run import/export tests**

Run:

```powershell
node --test src/utils/__tests__/solutionLibrary.test.js src/server/__tests__/solutionLibraryRoutes.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/utils/solutionLibrary.js src/utils/__tests__/solutionLibrary.test.js src/server/solutionLibraryStore.js app/api/admin/solutions src/server/__tests__/solutionLibraryRoutes.test.js
git commit -m "feat: add solution library import export"
```

---

### Task 6: Admin Page, Route, And Navigation

**Files:**
- Create: `src/views/AdminSolutions/index.jsx`
- Create: `src/views/AdminSolutions/__tests__/adminSolutionsView.test.js`
- Create: `app/(protected)/solutions/page.jsx`
- Modify: `src/components/Layout/AppLayout.jsx`
- Modify: `src/components/Layout/__tests__/appLayout.test.js`

- [ ] **Step 1: Write failing frontend static tests**

`adminSolutionsView.test.js` should assert:

- Uses `/api/admin/solutions`.
- Renders title `标准解决方案库`.
- Has fields: `方案编码`, `方案标题`, `方案描述`, `详细说明`, `适用险种`, `关联内部方案`, `工单类型`, `业务系统`, `问题类型`, `编辑权限`, `引用权限`.
- Has actions: `新增方案`, `编辑`, `删除`, `启用`, `停用`, `批量启用`, `批量停用`, `导入`, `导出`, `下载模板`, `版本`, `回滚`.
- Uses `RichTextEditor`.
- Uses `Upload` or explicit import button.

`appLayout.test.js` should assert admin menu includes `/solutions`.

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test src/views/AdminSolutions/__tests__/adminSolutionsView.test.js src/components/Layout/__tests__/appLayout.test.js
```

Expected: FAIL because page and menu do not exist.

- [ ] **Step 3: Implement protected route**

Create `app/(protected)/solutions/page.jsx` following existing protected admin pages:

```jsx
import { redirect } from 'next/navigation';
import AdminSolutionsPage from '../../../src/views/AdminSolutions/index.jsx';
import { ROLES } from '../../../src/constants/roles.js';
import { getLoginRedirectHref, getServerSessionUser } from '../../../src/server/session.js';

export default async function SolutionsPage() {
  const user = await getServerSessionUser();
  if (!user) redirect(getLoginRedirectHref('/solutions'));
  if (user.role !== ROLES.ADMIN) redirect('/');
  return <AdminSolutionsPage />;
}
```

Adjust imports to match existing page files.

- [ ] **Step 4: Implement admin page**

Use Ant Design patterns from `AdminAnnouncements` and `AdminDataFixSchemes`:

- List toolbar with filters and batch actions.
- Table with `rowSelection`.
- Drawer or modal for create/edit.
- Detail drawer with version list and rollback action.
- Import upload action and export buttons.

Keep UI utilitarian and dense; no marketing content.

- [ ] **Step 5: Add navigation**

In `AppLayout.jsx`, add admin menu item:

```jsx
{
  key: '/solutions',
  label: <Link href="/solutions">标准解决方案库</Link>
}
```

Update selected-key helper to recognize `/solutions`.

- [ ] **Step 6: Run frontend static tests**

Run:

```powershell
node --test src/views/AdminSolutions/__tests__/adminSolutionsView.test.js src/components/Layout/__tests__/appLayout.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/views/AdminSolutions app/(protected)/solutions/page.jsx src/components/Layout/AppLayout.jsx src/components/Layout/__tests__/appLayout.test.js
git commit -m "feat: add solution library admin UI"
```

---

### Task 7: Ticket Message Solution Reference UI

**Files:**
- Modify: `src/context/TicketContext.jsx`
- Modify: `src/components/TicketDetail/MessageBoard.jsx`
- Modify: `src/components/TicketDetail/messageComposer.js`
- Modify: `src/components/TicketDetail/__tests__/messageComposer.test.js`
- Test: `src/components/TicketDetail/__tests__/actionAreaUi.test.js` or new `solutionReferenceUi.test.js`

- [ ] **Step 1: Write failing message composer tests**

Add tests that assert:

- Solution reference message payload contains `solutionReference`.
- Visible messages display referenced messages normally.
- System log message starting `【系统】` remains hidden from message board via existing `getVisibleMessages`.

Representative helper test:

```js
test('buildSolutionReferencePreview includes solution title and version', () => {
  const preview = buildSolutionReferencePreview({
    solutionTitle: '保单状态修正',
    versionNo: 3
  });
  assert.match(preview, /保单状态修正/);
  assert.match(preview, /v3/);
});
```

- [ ] **Step 2: Write failing UI static test**

Assert `MessageBoard.jsx` includes:

- `/api/solutions/referenceable`
- `引用方案`
- `solutionReference`
- `referenceSolution`

- [ ] **Step 3: Run tests to verify failure**

Run:

```powershell
node --test src/components/TicketDetail/__tests__/messageComposer.test.js src/components/TicketDetail/__tests__/actionAreaUi.test.js
```

Expected: FAIL for missing helpers/UI strings.

- [ ] **Step 4: Add TicketContext action**

In `TicketContext.jsx`, add:

```js
const referenceSolution = useCallback(async (ticketId, solutionId) => {
  const { response, data } = await requestJson(`/api/workflow/tickets/${ticketId}/solution-references`, {
    method: 'POST',
    body: JSON.stringify({ solutionId })
  });

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.reason || '引用方案失败');
  }

  setTickets((prev) => replaceTicketInList(prev, data.ticket));
  return data;
}, []);
```

Include it in provider value and dependency list.

- [ ] **Step 5: Add MessageBoard modal**

In `MessageBoard.jsx`:

- Load referenceable solutions only when modal opens.
- Show searchable table/list with title, version, classification tags, and detail preview.
- Allow `L1` and `L2` only.
- Call `referenceSolution(ticket.id, selectedSolution.id)`.
- On success, close modal and show `message.success('方案已引用')`.
- Render `Tag` near message header when `messageItem.solutionReference` exists:

```jsx
<Tag color="cyan">引用方案 v{messageItem.solutionReference.versionNo}</Tag>
```

- [ ] **Step 6: Run UI tests**

Run:

```powershell
node --test src/components/TicketDetail/__tests__/messageComposer.test.js src/components/TicketDetail/__tests__/actionAreaUi.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/context/TicketContext.jsx src/components/TicketDetail/MessageBoard.jsx src/components/TicketDetail/messageComposer.js src/components/TicketDetail/__tests__
git commit -m "feat: support ticket solution references"
```

---

### Task 8: End-To-End Route Regression For Versioned References

**Files:**
- Modify: `src/server/__tests__/solutionLibraryRoutes.test.js`
- Possibly modify: `src/server/solutionLibraryStore.js`
- Possibly modify: `app/api/workflow/tickets/[id]/solution-references/route.js`

- [ ] **Step 1: Add the critical regression test**

Test flow:

1. Admin creates solution v1.
2. Admin updates to v2.
3. L1 references solution into an existing ticket.
4. Admin updates solution to v3.
5. Load detail/references and ticket messages.
6. Assert reference row has `versionNo === 2`.
7. Assert reference snapshot has v2 title/detail.
8. Assert current solution is v3.
9. Assert ticket message metadata says v2.

- [ ] **Step 2: Run regression test to verify it passes or exposes gaps**

Run:

```powershell
node --test src/server/__tests__/solutionLibraryRoutes.test.js
```

Expected: PASS after previous tasks. If it fails, fix the store/route implementation, not the test.

- [ ] **Step 3: Commit if fixes were required**

```powershell
git add src/server/__tests__/solutionLibraryRoutes.test.js src/server/solutionLibraryStore.js app/api/workflow/tickets/[id]/solution-references/route.js
git commit -m "test: cover versioned solution references"
```

---

### Task 9: Focused Verification

**Files:** no production files unless fixing failures.

- [ ] **Step 1: Run solution library tests**

Run:

```powershell
node --test src/utils/__tests__/solutionLibrary.test.js src/server/__tests__/solutionLibraryStore.test.js src/server/__tests__/solutionLibraryRoutes.test.js src/views/AdminSolutions/__tests__/adminSolutionsView.test.js
```

Expected: all pass.

- [ ] **Step 2: Run related existing tests**

Run:

```powershell
node --test src/components/TicketDetail/__tests__/messageComposer.test.js src/components/TicketDetail/__tests__/actionAreaUi.test.js src/components/Layout/__tests__/appLayout.test.js src/server/__tests__/workflowContextRoutes.test.js src/server/__tests__/adminConfigRoutes.test.js
```

Expected: all pass.

- [ ] **Step 3: Run broader regression set**

Run:

```powershell
node --test src/server/__tests__/ticketApiStateMachine.test.js src/state-machine/__tests__/ticketStateMachine.test.js src/permissions/__tests__/ticketPermissionMatrix.test.js
```

Expected: all pass. These confirm the feature did not bypass or break ticket state-machine contracts.

- [ ] **Step 4: Run build**

Run:

```powershell
npm run build
```

Expected: Next production build succeeds.

- [ ] **Step 5: Commit verification fixes if any**

Only commit if verification required code/test changes:

```powershell
git add <changed-files>
git commit -m "fix: stabilize solution library verification"
```

---

### Task 10: Manual Browser Check

**Files:** no production files unless fixing observed defects.

- [ ] **Step 1: Start dev server**

Run:

```powershell
npm run dev
```

If the default port is occupied, use the next available port according to the project’s normal Next.js behavior.

- [ ] **Step 2: Open admin page**

Open:

```text
http://localhost:3000/solutions
```

Check:

- Admin can see page.
- Non-admin redirects away or cannot access.
- Create/edit drawer opens.
- Rich text editor renders.
- Filters do not overlap on desktop width.
- Batch actions are disabled until rows are selected.
- Detail drawer shows versions and rollback.

- [ ] **Step 3: Open ticket detail**

Open an existing assigned ticket as `L1` or `L2`.

Check:

- “引用方案” appears in the message composer area.
- Modal loads referenceable solutions.
- Referencing a solution adds a visible message with `引用方案 vN` tag.
- System log message is not shown in the visible message thread.
- Reload keeps the referenced message.

- [ ] **Step 4: Fix any UI defects**

If visual defects are found, write a focused static test or component test where feasible, then patch.

- [ ] **Step 5: Final verification**

Re-run:

```powershell
node --test src/utils/__tests__/solutionLibrary.test.js src/server/__tests__/solutionLibraryStore.test.js src/server/__tests__/solutionLibraryRoutes.test.js src/views/AdminSolutions/__tests__/adminSolutionsView.test.js src/components/TicketDetail/__tests__/messageComposer.test.js src/components/TicketDetail/__tests__/actionAreaUi.test.js src/components/Layout/__tests__/appLayout.test.js
npm run build
```

Expected: all pass.

---

## Risk Notes

- The repository currently has unrelated uncommitted announcement changes. Do not revert or restage them unless explicitly requested.
- `CodeGraph` may be unavailable with `Transport closed`; use `rg` and focused reads if it remains unavailable.
- JSON fallback database must stay in sync with SQLite tables because local tests may run without `better-sqlite3` native bindings.
- Do not add direct ticket status writes for this feature. Solution references are ticket messages/logs only.
- Keep import/export dependency choices conservative. Prefer an existing spreadsheet package if already installed; otherwise implement the smallest compatible template/export path that tests can verify.
