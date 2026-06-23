# SLA Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build administrator SLA configuration and apply enabled rules to newly submitted tickets.

**Architecture:** Store SLA config in `app_configs`. Keep validation and deadline calculation in a focused utility module. Expose admin routes via Next route handlers. Connect ticket creation through the existing state machine only.

**Tech Stack:** Next.js route handlers, Ant Design, SQLite app config store, Node test runner.

---

### Task 1: SLA Utility Model

- [ ] Write failing tests for normalization, validation, unified priority matching, default rules, and deadline calculation.
- [ ] Implement `src/utils/slaConfig.js`.
- [ ] Run utility tests.

### Task 2: Store and Routes

- [ ] Write failing tests for admin-only GET/PUT `/api/admin/sla-rules`.
- [ ] Implement store functions in `adminConfigStore.js`.
- [ ] Implement route `app/api/admin/sla-rules/route.js`.
- [ ] Run route tests.

### Task 3: State Machine Application

- [ ] Write failing tests showing submitted tickets get SLA snapshots and disabled rules fall back.
- [ ] Change `ticketStateMachine.js` to calculate SLA through the config-aware helper without direct status writes.
- [ ] Run state machine tests.

### Task 4: Admin Page and Navigation

- [ ] Write failing static tests for route, menu item, and page controls.
- [ ] Implement `src/views/AdminSlaConfig/index.jsx` and `app/(protected)/sla-rules/page.jsx`.
- [ ] Add menu entry under admin management.
- [ ] Run view/layout tests.

### Task 5: Verification

- [ ] Run targeted tests.
- [ ] Run `npm run build`.
- [ ] Review diff for unrelated changes.
