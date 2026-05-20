# Personal Quick Phrases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-support-user common phrase maintenance and slash insertion in ticket messages.

**Architecture:** Store personal phrase configs in `app_configs` under a user-specific key. Expose current-user-only personal APIs, add a support-only personal configuration page, and extend the existing Tiptap editor with slash suggestion hooks.

**Tech Stack:** Next.js App Router, React 18, Ant Design, Tiptap, node:test, SQLite/fallback store.

---

### Task 1: Phrase Domain Helpers

**Files:**
- Create: `src/utils/quickPhrases.js`
- Test: `src/utils/__tests__/quickPhrases.test.js`

- [ ] Add tests for normalization, validation, filtering, and slash insertion.
- [ ] Implement helpers: `normalizeQuickPhraseConfig`, `validateQuickPhraseConfig`, `filterQuickPhrases`, `insertPhraseForSlashQuery`.
- [ ] Run `node --test src/utils/__tests__/quickPhrases.test.js`.

### Task 2: Server Store And Routes

**Files:**
- Modify: `src/server/adminConfigStore.js`
- Create: `app/api/personal/quick-phrases/route.js`
- Test: `src/server/__tests__/personalQuickPhrasesRoute.test.js`

- [ ] Add failing route tests for unauthenticated, requester/admin forbidden, L1/L2 save/load, and per-user isolation.
- [ ] Implement per-user app config load/save with validation.
- [ ] Add personal API route using current session user.
- [ ] Run `node --test src/server/__tests__/personalQuickPhrasesRoute.test.js`.

### Task 3: Personal Configuration Page

**Files:**
- Create: `src/views/PersonalQuickPhrases/index.jsx`
- Create: `app/(protected)/personal/quick-phrases/page.jsx`
- Modify: `src/components/Layout/AppLayout.jsx`
- Test: `src/views/PersonalQuickPhrases/__tests__/personalQuickPhrasesView.test.js`
- Test: `src/components/Layout/__tests__/appLayout.test.js`

- [ ] Add source tests for L1/L2 personal config nav and page controls.
- [ ] Implement support-only protected page and phrase maintenance UI.
- [ ] Wire the nav selected key and page title.
- [ ] Run focused source tests.

### Task 4: Slash Suggestions In Message Editor

**Files:**
- Modify: `src/components/common/RichTextEditor.jsx`
- Modify: `src/components/TicketDetail/MessageBoard.jsx`
- Test: `src/components/TicketDetail/__tests__/messageComposer.test.js`

- [ ] Add tests for slash filtering/insertion helper behavior.
- [ ] Extend `RichTextEditor` to accept quick phrase props and intercept keys.
- [ ] Load enabled phrases in `MessageBoard` for L1/L2 users and pass them to the editor.
- [ ] Run focused message/editor tests.

### Task 5: Verification

**Files:**
- No new files.

- [ ] Run all focused tests touched by the change.
- [ ] Run `pnpm build` if practical.
- [ ] Review git diff for accidental status-field writes and generated files.
