# Schedule Auto Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically assign newly pending tickets to L1 support from admin schedule rules.

**Architecture:** Add a pure schedule routing helper that selects an online L1 assignee by priority: insurance team, flexible rule, then base schedule. Integrate it after a ticket becomes `PENDING` by dispatching the existing `ACCEPT` state-machine event, so status and assignment fields are never mutated directly.

**Tech Stack:** Next.js route handlers, Node test runner, existing SQLite/JSON store, existing ticket state machine.

---

### Task 1: Schedule Routing Helper

**Files:**
- Create: `src/utils/scheduleDispatchRouting.js`
- Test: `src/utils/__tests__/scheduleDispatchRouting.test.js`

- [ ] Write failing tests for insurance-team priority, flexible-rule priority, base-schedule fallback, offline filtering, and round-robin selection.
- [ ] Run `node --test src/utils/__tests__/scheduleDispatchRouting.test.js` and verify it fails because the helper does not exist.
- [ ] Implement `routeScheduleAssignee(ticket, scheduleConfig, users, previousTickets)`.
- [ ] Re-run the utility test and verify it passes.

### Task 2: Store Integration

**Files:**
- Modify: `src/server/store.js`
- Test: `src/server/__tests__/ticketAutoScheduleAssignment.test.js`

- [ ] Write failing tests for `SUBMIT` auto-assignment and no-assignee fallback.
- [ ] Write failing test for `OA_ITSM_GENERATE_TICKET` auto-assignment.
- [ ] Run `node --test src/server/__tests__/ticketAutoScheduleAssignment.test.js` and verify it fails because auto-assignment is not wired.
- [ ] After `SUBMIT`, `OA_ITSM_GENERATE_TICKET`, and `OA_REAPPROVE_GENERATE` produce a `PENDING` ticket, call the routing helper and dispatch `EVENTS.ACCEPT` as the selected L1 user.
- [ ] Re-run the store test and verify it passes.

### Task 3: Regression Verification

**Files:**
- Existing tests only.

- [ ] Run `node --test src/utils/__tests__/scheduleDispatchRouting.test.js src/server/__tests__/ticketAutoScheduleAssignment.test.js`.
- [ ] Run related state-machine/store tests.
- [ ] Run `pnpm build`.
