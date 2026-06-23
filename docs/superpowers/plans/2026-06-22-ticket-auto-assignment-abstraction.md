# Ticket Auto Assignment Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make backend L1 auto-assignment extensible by registering assignment rules without changing router control flow.

**Architecture:** Keep `src/server/store.js` as the state-machine integration point. Refactor `src/utils/scheduleDispatchRouting.js` into ordered strategy rules that produce route candidates, while shared router logic handles online filtering and round-robin selection.

**Tech Stack:** Next.js app routes, Node test runner, existing ticket state machine, existing SQLite/JSON fallback store.

---

### Task 1: Rule Strategy Extension Point

**Files:**
- Modify: `src/utils/scheduleDispatchRouting.js`
- Test: `src/utils/__tests__/scheduleDispatchRouting.test.js`

- [x] Write a failing test that imports `DEFAULT_SCHEDULE_ASSIGNMENT_RULES` and injects a custom `VIP_ESCALATION` rule through `routeScheduleAssignee(..., { rules })`.
- [x] Run `node --test src/utils/__tests__/scheduleDispatchRouting.test.js` and verify it fails because the export does not exist.
- [x] Export `SCHEDULE_ASSIGNMENT_RULE_TYPES`, `INSURANCE_TEAM_ASSIGNMENT_RULE`, `FLEXIBLE_SYSTEM_ASSIGNMENT_RULE`, `BASE_SCHEDULE_ASSIGNMENT_RULE`, and `DEFAULT_SCHEDULE_ASSIGNMENT_RULES`.
- [x] Change `routeScheduleAssignee` to accept `options.rules`, build candidates by invoking the ordered strategies, and keep online filtering plus round-robin behavior in the router.
- [x] Run `node --test src/utils/__tests__/scheduleDispatchRouting.test.js` and verify all routing tests pass.

### Task 2: State-Machine Integration Guard

**Files:**
- Test: `src/server/__tests__/ticketAutoScheduleAssignment.test.js`

- [x] Add a regression test that verifies submitted tickets produce `[SUBMIT, ACCEPT]` timeline actions when auto-assigned.
- [x] Assert the `ACCEPT` transition moves from `PENDING` to `PROCESSING` and is operated by the selected L1 user.
- [x] Run `node --test src/server/__tests__/ticketAutoScheduleAssignment.test.js` and verify the store behavior passes.

### Task 3: Verification

**Files:**
- Existing tests only.

- [x] Run route and store auto-assignment tests together.
- [x] Run related state-machine/store tests.
- [x] Run `pnpm build`.
