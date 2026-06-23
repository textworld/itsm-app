# Solution Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change solution detail access from an in-page drawer to a standalone `/solutions/[id]` page that supports management actions.

**Architecture:** Keep existing admin APIs. The list page links code/title to the new route. The detail page is a client component that loads solution detail and references, reuses the existing update/enable/delete endpoints, and keeps third-party scheme selection through the existing adapter endpoint.

**Tech Stack:** Next.js protected route, React client component, Ant Design, Node test runner.

---

### Task 1: Route and static tests
- [ ] Add failing source tests for `/solutions/[id]` admin-only route and list link behavior.
- [ ] Implement protected route and update list links.

### Task 2: Detail page component
- [ ] Add failing source tests for detail page loading, edit modal, enable/disable, delete, versions, and reference pagination/search.
- [ ] Implement `AdminSolutionDetailPage` using existing APIs.

### Task 3: Verification
- [ ] Run AdminSolutions view tests.
- [ ] Run solution route/store tests if API interactions are touched.
- [ ] Run `npm run build`.
