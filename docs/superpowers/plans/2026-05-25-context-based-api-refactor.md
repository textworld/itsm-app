# Context-Based API Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the ITSM API surface around the bounded contexts documented in `docs/superpowers/specs/2026-05-25-context-based-api-refactor-design.md`.

**Architecture:** Add context-based routes first, move frontend callers to those routes, then keep the existing state machine and store behavior intact. The refactor changes API boundaries and application module names without changing ticket lifecycle rules.

**Tech Stack:** Next.js App Router route handlers, React 18, node:test, SQLite through the existing server store, Ant Design frontend.

---

### Task 1: Workflow Context Routes

**Files:**
- Create: `app/api/workflow/tickets/route.js`
- Create: `app/api/workflow/tickets/[id]/route.js`
- Create: `app/api/workflow/tickets/[id]/commands/route.js`
- Create: `app/api/workflow/tickets/[id]/messages/route.js`
- Create: `app/api/workflow/tickets/[id]/custom-tags/route.js`
- Create: `app/api/workflow/defects/route.js`
- Create: `app/api/workflow/message-reads/route.js`
- Create: `app/api/workflow/reset/route.js`
- Create: `app/api/workflow/export/route.js`
- Test: `src/server/__tests__/workflowContextRoutes.test.js`

- [ ] Add failing route tests for workflow ticket list, command dispatch, message add, custom tags, defects, message reads, reset, and export.
- [ ] Implement routes by delegating to the existing `src/server/store.js` functions.
- [ ] Keep command payloads as `{ command, payload }`, mapping `command` to existing state machine events.
- [ ] Run `node --test src/server/__tests__/workflowContextRoutes.test.js`.

### Task 2: Submission Context Routes

**Files:**
- Create: `app/api/submission/drafts/route.js`
- Create: `app/api/submission/drafts/[id]/route.js`
- Create: `app/api/submission/tickets/route.js`
- Create: `app/api/submission/ai-assistant/route.js`
- Create: `app/api/submission/mock-description/route.js`
- Test: `src/server/__tests__/submissionContextRoutes.test.js`

- [ ] Add failing tests for draft creation, draft update, ticket submission, and AI helper route availability.
- [ ] Move the create-event selection from `app/api/tickets/route.js` into the submission context route.
- [ ] Implement draft update through the state machine `UPDATE_DRAFT` event.
- [ ] Re-export or wrap the existing AI route handlers under the new submission paths.
- [ ] Run `node --test src/server/__tests__/submissionContextRoutes.test.js`.

### Task 3: Approval Context Routes

**Files:**
- Create: `app/api/approval/applications/route.js`
- Create: `app/api/approval/applications/[oaId]/route.js`
- Create: `app/api/approval/applications/[oaId]/actions/route.js`
- Test: `src/server/__tests__/approvalContextRoutes.test.js`

- [ ] Add failing tests for approval application list, detail, and action dispatch.
- [ ] Implement approval routes by delegating to existing OA application query and action behavior.
- [ ] Ensure approval actions dispatch ticket state machine events through `dispatchTicketEvent`.
- [ ] Run `node --test src/server/__tests__/approvalContextRoutes.test.js`.

### Task 4: Config Context Routes

**Files:**
- Create: `app/api/config/systems/route.js`
- Create: `app/api/config/dictionaries/options/route.js`
- Create: `app/api/config/support-assignees/route.js`
- Create: `app/api/config/personal/quick-phrases/route.js`
- Create: `app/api/config/admin/systems/route.js`
- Create: `app/api/config/admin/dictionaries/insurance-types/route.js`
- Create: `app/api/config/admin/dictionaries/insurance-types/[id]/route.js`
- Create: `app/api/config/admin/schedules/route.js`
- Create: `app/api/config/admin/support-rests/route.js`
- Create: `app/api/config/admin/data-fix-schemes/route.js`
- Test: `src/server/__tests__/configContextRoutes.test.js`

- [ ] Add failing tests proving the config routes return the same data and authorization results as the old routes.
- [ ] Implement config routes as thin wrappers around existing admin config route behavior.
- [ ] Keep config routes free of ticket state mutation logic.
- [ ] Run `node --test src/server/__tests__/configContextRoutes.test.js`.

### Task 5: Access Context Routes

**Files:**
- Create: `app/api/access/session/route.js`
- Create: `app/api/access/login/route.js`
- Create: `app/api/access/logout/route.js`
- Create: `app/api/access/register/route.js`
- Create: `app/api/access/admin/users/route.js`
- Create: `app/api/access/templates/permission-request/route.js`
- Test: `src/server/__tests__/accessContextRoutes.test.js`

- [ ] Add failing tests for session, login, logout, registration, admin user management, and template download.
- [ ] Implement access routes by delegating to the existing auth, admin users, and template route behavior.
- [ ] Keep access routes independent from ticket persistence.
- [ ] Run `node --test src/server/__tests__/accessContextRoutes.test.js`.

### Task 6: Frontend API Call Migration

**Files:**
- Modify: `src/context/TicketContext.jsx`
- Modify: `src/context/AuthContext.jsx`
- Modify: `src/hooks/useSystems.js`
- Modify: `src/hooks/useSupportAssignees.js`
- Modify: `src/utils/fileUtils.js`
- Modify: `src/components/TicketSubmit/AiTicketAssistantDrawer.jsx`
- Modify: `src/views/TicketSubmit/index.jsx`
- Modify: `src/components/TicketDetail/L1Actions.jsx`
- Modify: `src/components/TicketDetail/DraftTicketEditButton.jsx`
- Modify: `src/components/TicketDetail/MessageBoard.jsx`
- Modify: `src/views/PersonalQuickPhrases/index.jsx`
- Modify: `src/views/OaSimulator/index.jsx`
- Modify: admin views under `src/views/Admin*`

- [ ] Update frontend callers to use `/api/submission`, `/api/workflow`, `/api/approval`, `/api/config`, and `/api/access`.
- [ ] Update workflow command callers to send `{ command, payload }`.
- [ ] Keep upload URLs unchanged unless a separate upload context is introduced.
- [ ] Run focused frontend/source tests that cover API path constants and view integration.

### Task 7: Remove Old Route Dependence

**Files:**
- Modify or delete old routes under `app/api/tickets`, `app/api/data`, `app/api/defects`, `app/api/message-reads`, `app/api/reset`, `app/api/export`, `app/api/oa-simulator`, `app/api/systems`, `app/api/dictionaries`, `app/api/support-assignees`, `app/api/personal`, `app/api/auth`, `app/api/templates`, and selected `app/api/admin` paths.
- Test: existing route tests under `src/server/__tests__`

- [ ] Decide whether each old route should be deleted or kept as a compatibility alias.
- [ ] Update tests to import the new context routes.
- [ ] Search for old API path strings and remove stale callers.
- [ ] Run `rg "api/(tickets|data|defects|message-reads|reset|export|oa-simulator|systems|dictionaries|support-assignees|personal|auth|templates)" src app`.

### Task 8: Verification

**Files:**
- No new files.

- [ ] Run all focused context route tests.
- [ ] Run existing ticket state machine and route tests.
- [ ] Run `pnpm build` if practical.
- [ ] Search for forbidden direct ticket status writes outside `src/state-machine/ticketStateMachine.js`.
- [ ] Review `git diff` for unrelated changes.

