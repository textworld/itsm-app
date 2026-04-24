# Requester Draft And AI Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add requester-side draft saving, draft editing, draft-tab listing, list filtering, and simulated AI recommendation gating so tickets can only be submitted after a recommendation has been generated from a saved draft.

**Architecture:** Keep draft records and formal tickets in the existing `TicketContext` storage, but separate them with explicit record-type fields so drafts never enter the existing status machine. Extract pure helper modules for draft serialization, AI recommendation generation, and list filtering so the risky business rules are testable without depending on the whole page tree. Update the submit page to operate in both "new" and "edit draft" modes, then update the requester list and shared table rendering to expose draft-aware navigation and filters.

**Tech Stack:** React 18, Ant Design 5, React Router 6, localStorage persistence through `TicketContext`, Vite 5, Vitest + Testing Library for new regression coverage

---

## File Map

- Modify: `package.json`
  - Add a minimal frontend test toolchain and scripts.
- Modify: `vite.config.js`
  - Add Vitest config or test environment wiring if kept in the same file.
- Create: `src/test/setup.js`
  - Shared DOM test setup for Testing Library and browser API shims.
- Create: `src/utils/ticketDrafts.js`
  - Centralize draft record creation, draft updates, recommendation fingerprinting, and draft-to-ticket conversion.
- Create: `src/utils/ticketFilters.js`
  - Centralize requester-list filtering logic by tab and search form values.
- Create: `src/utils/aiRecommendation.js`
  - Simulate deterministic recommendation output from ticket inputs.
- Modify: `src/utils/idGenerator.js`
  - Add draft ID generation beside existing ticket ID generation.
- Modify: `src/context/TicketContext.jsx`
  - Add draft-aware CRUD methods and draft submission workflow.
- Modify: `src/pages/TicketSubmit/index.jsx`
  - Support draft save, draft editing, AI recommendation, recommendation invalidation, and gated submit.
- Modify: `src/pages/TicketList/index.jsx`
  - Add requester draft tab, filter state, and filtered tab data.
- Create: `src/components/TicketList/TicketFilters.jsx`
  - Render the list filter form for ticket number, title, date range, priority, and system.
- Modify: `src/components/TicketList/TicketTable.jsx`
  - Render draft-safe status, hide SLA for drafts, and route draft rows to the edit form.
- Modify: `src/router/index.jsx`
  - Keep submit page route stable while allowing draft editing by query string.
- Check: `src/constants/ticketStatus.js`
  - Reuse existing formal-ticket statuses without forcing a new draft status into the state machine.
- Check: `src/components/common/FileUploader.jsx`
  - Confirm draft attachment rehydration can reuse current file list behavior.
- Create: `src/utils/__tests__/ticketDrafts.test.js`
  - Unit coverage for draft creation, fingerprint invalidation, and draft-to-ticket conversion.
- Create: `src/utils/__tests__/aiRecommendation.test.js`
  - Unit coverage for deterministic recommendation output.
- Create: `src/utils/__tests__/ticketFilters.test.js`
  - Unit coverage for requester tab scoping and filter combinations.
- Create: `src/pages/TicketSubmit/__tests__/TicketSubmitPage.test.jsx`
  - Integration coverage for save draft, recommend, invalidation, and gated submit.
- Create: `src/pages/TicketList/__tests__/TicketListPage.test.jsx`
  - Integration coverage for requester draft tab and list filters.

## Task 1: Add the minimum frontend test baseline

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `src/test/setup.js`

- [ ] **Step 1: Write the failing tooling test target**

Add a placeholder test file reference in the plan implementation branch first by creating one real test file in Task 2, but before any feature code, update `package.json` scripts so the repository has an executable test command. Add the dependencies needed for browser-like React testing:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "build": "vite build"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "...",
    "@testing-library/react": "...",
    "@testing-library/user-event": "...",
    "jsdom": "...",
    "vitest": "..."
  }
}
```

- [ ] **Step 2: Configure Vitest to fail before implementation**

Wire Vite/Vitest once, before feature work, so later RED steps are real. Extend `vite.config.js` with a `test` block or split into a dedicated config if the implementation prefers that shape:

```js
export default defineConfig({
  base: '/itsm-app-proto-2/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true
  }
});
```

Create `src/test/setup.js`:

```js
import '@testing-library/jest-dom';
```

- [ ] **Step 3: Run the empty test command to prove the baseline is active**

Run: `pnpm test:run`
Expected: The command executes Vitest successfully, likely with `No test files found` before the first real test file lands.

- [ ] **Step 4: Commit the test baseline**

```bash
git add package.json vite.config.js src/test/setup.js pnpm-lock.yaml
git commit -m "test: add frontend vitest baseline"
```

## Task 2: Extract draft and recommendation domain helpers

**Files:**
- Create: `src/utils/ticketDrafts.js`
- Create: `src/utils/aiRecommendation.js`
- Modify: `src/utils/idGenerator.js`
- Create: `src/utils/__tests__/ticketDrafts.test.js`
- Create: `src/utils/__tests__/aiRecommendation.test.js`
- Check: `src/constants/priorities.js`
- Check: `src/constants/systems.js`
- Check: `src/constants/toolTypes.js`
- Check: `src/utils/sla.js`

- [ ] **Step 1: Write the first failing draft helper test**

Create `src/utils/__tests__/ticketDrafts.test.js` and capture the core rules first:

```js
import { describe, expect, test } from 'vitest';
import {
  buildDraftRecord,
  computeRecommendationFingerprint,
  convertDraftToTicket,
  isRecommendationValidForForm
} from '../ticketDrafts.js';

test('buildDraftRecord creates a requester-owned draft with recommendation locked', () => {
  const draft = buildDraftRecord({
    existingTickets: [],
    values: {
      title: '导出报错',
      toolType: 'OTHER',
      priority: 'P2',
      systemName: 'CRM'
    },
    descriptionHtml: '<p>导出失败</p>',
    attachments: [],
    user: { id: 'u_requester_1', name: '张三', role: 'REQUESTER' },
    now: '2026-04-21T10:00:00.000Z'
  });

  expect(draft.id).toMatch(/^DRF-20260421-/);
  expect(draft.recordType).toBe('DRAFT');
  expect(draft.aiRecommendationReady).toBe(false);
  expect(draft.draftConvertedToTicketId).toBe('');
});

test('isRecommendationValidForForm returns false when key fields change', () => {
  const fingerprint = computeRecommendationFingerprint({
    title: 'A',
    description: 'B',
    toolType: 'OTHER',
    priority: 'P2',
    systemCode: 'CRM'
  });

  expect(isRecommendationValidForForm({
    storedFingerprint: fingerprint,
    values: {
      title: 'A',
      description: 'Changed',
      toolType: 'OTHER',
      priority: 'P2',
      systemCode: 'CRM'
    }
  })).toBe(false);
});

test('convertDraftToTicket creates a pending formal ticket and links the source draft', () => {
  const result = convertDraftToTicket({
    draft: {
      id: 'DRF-20260421-0001',
      recordType: 'DRAFT',
      title: '导出报错',
      toolType: 'OTHER',
      priority: 'P2',
      systemCode: 'CRM',
      systemName: 'CRM系统',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      reportedUserName: '',
      reportedUserPhone: '',
      description: '导出失败',
      descriptionHtml: '<p>导出失败</p>',
      attachments: [],
      requesterId: 'u_requester_1',
      requesterName: '张三',
      aiRecommendationReady: true,
      aiRecommendation: { summary: '...', solutions: [], nextActions: [], generatedAt: '2026-04-21T10:00:00.000Z' }
    },
    existingTickets: [],
    user: { id: 'u_requester_1', name: '张三', role: 'REQUESTER' },
    now: '2026-04-21T10:10:00.000Z'
  });

  expect(result.ticket.recordType).toBe('TICKET');
  expect(result.ticket.status).toBe('PENDING');
  expect(result.ticket.draftSourceId).toBe('DRF-20260421-0001');
  expect(result.updatedDraft.draftConvertedToTicketId).toBe(result.ticket.id);
});
```

- [ ] **Step 2: Run the draft helper test to verify RED**

Run: `pnpm vitest run src/utils/__tests__/ticketDrafts.test.js`
Expected: FAIL because `ticketDrafts.js` and/or exported functions do not exist yet.

- [ ] **Step 3: Write the first failing recommendation helper test**

Create `src/utils/__tests__/aiRecommendation.test.js`:

```js
import { expect, test } from 'vitest';
import { buildAiRecommendation } from '../aiRecommendation.js';

test('buildAiRecommendation returns deterministic structured output', () => {
  const recommendation = buildAiRecommendation({
    title: '导出超时',
    description: 'CRM 导出订单明细时提示超时',
    toolType: 'DATA_EXTRACT',
    priority: 'P1',
    systemName: 'CRM系统'
  });

  expect(recommendation.summary).toContain('CRM系统');
  expect(recommendation.solutions.length).toBeGreaterThanOrEqual(2);
  expect(recommendation.nextActions[0]).toContain('优先');
});
```

- [ ] **Step 4: Run the recommendation test to verify RED**

Run: `pnpm vitest run src/utils/__tests__/aiRecommendation.test.js`
Expected: FAIL because `buildAiRecommendation` does not exist yet.

- [ ] **Step 5: Implement the minimal helper modules**

Create `src/utils/ticketDrafts.js` with focused pure functions only:

```js
import { PRIORITY_LABELS } from '../constants/priorities.js';
import { STATUS } from '../constants/ticketStatus.js';
import { SYSTEM_LABELS } from '../constants/systems.js';
import { EVENTS } from '../state-machine/ticketStateMachine.js';
import { calculateTicketExpiresAt } from './sla.js';
import { generateDraftId, generateTicketId } from './idGenerator.js';

export const RECORD_TYPES = {
  DRAFT: 'DRAFT',
  TICKET: 'TICKET'
};

export function computeRecommendationFingerprint({ title, description, toolType, priority, systemCode }) {
  return JSON.stringify({
    title: title?.trim() || '',
    description: description?.trim() || '',
    toolType: toolType || '',
    priority: priority || '',
    systemCode: systemCode || ''
  });
}
```

Implement `buildDraftRecord`, `updateDraftRecord`, `isRecommendationValidForForm`, and `convertDraftToTicket` in the same module. Keep the functions pure and pass `now`, `user`, and `existingTickets` in explicitly.

Create `src/utils/aiRecommendation.js` with a pure `buildAiRecommendation` function that composes:
- a summary,
- two or three `solutions`,
- one or two `nextActions`,
- `generatedAt`.

Modify `src/utils/idGenerator.js` to add:

```js
export function generateDraftId(existingTickets = []) {
  const date = todayStr();
  const prefix = `DRF-${date}-`;
  // same increment strategy as generateTicketId
}
```

- [ ] **Step 6: Run the helper tests to verify GREEN**

Run: `pnpm vitest run src/utils/__tests__/ticketDrafts.test.js src/utils/__tests__/aiRecommendation.test.js`
Expected: PASS.

- [ ] **Step 7: Refactor helper names and defaults if needed, then re-run**

Run: `pnpm vitest run src/utils/__tests__/ticketDrafts.test.js src/utils/__tests__/aiRecommendation.test.js`
Expected: PASS after any cleanup.

- [ ] **Step 8: Commit the domain helpers**

```bash
git add src/utils/idGenerator.js src/utils/ticketDrafts.js src/utils/aiRecommendation.js src/utils/__tests__/ticketDrafts.test.js src/utils/__tests__/aiRecommendation.test.js
git commit -m "feat: add draft and recommendation domain helpers"
```

## Task 3: Extend TicketContext for draft persistence and draft submission

**Files:**
- Modify: `src/context/TicketContext.jsx`
- Modify: `src/utils/storage.js`
- Check: `src/mock/initialTickets.json`
- Check: `src/state-machine/ticketStateMachine.js`
- Reuse: `src/utils/ticketDrafts.js`

- [ ] **Step 1: Write the failing context-oriented helper test**

Instead of mounting the full provider first, keep the main behavior testable through the pure helper layer and one targeted page integration test later. Add one new assertion to `src/utils/__tests__/ticketDrafts.test.js` that covers a real submission guard:

```js
test('convertDraftToTicket rejects drafts without a valid recommendation', () => {
  expect(() =>
    convertDraftToTicket({
      draft: { id: 'DRF-1', recordType: 'DRAFT', aiRecommendationReady: false },
      existingTickets: [],
      user: { id: 'u_requester_1', name: '张三', role: 'REQUESTER' },
      now: '2026-04-21T10:10:00.000Z'
    })
  ).toThrow(/recommendation/i);
});
```

- [ ] **Step 2: Run the helper test to verify RED**

Run: `pnpm vitest run src/utils/__tests__/ticketDrafts.test.js`
Expected: FAIL if the guard is not implemented yet.

- [ ] **Step 3: Implement minimal draft-aware context methods**

Update `src/context/TicketContext.jsx` to expose:

```js
const saveDraft = useCallback((draft) => {
  setTicketsState((prev) => {
    const exists = prev.some((item) => item.id === draft.id);
    if (exists) {
      return prev.map((item) => (item.id === draft.id ? draft : item));
    }
    return [draft, ...prev];
  });
}, []);

const getDraftById = useCallback((draftId) => {
  return tickets.find((item) => item.id === draftId && item.recordType === 'DRAFT');
}, [tickets]);

const submitDraft = useCallback((draftId, user) => {
  let result = { ok: false, reason: 'Draft not found' };
  setTicketsState((prev) => {
    const draft = prev.find((item) => item.id === draftId && item.recordType === 'DRAFT');
    if (!draft) return prev;

    try {
      const { ticket, updatedDraft } = convertDraftToTicket({
        draft,
        existingTickets: prev,
        user,
        now: new Date().toISOString()
      });

      result = { ok: true, ticket, draft: updatedDraft };

      return [ticket, ...prev.map((item) => (item.id === draftId ? updatedDraft : item))];
    } catch (error) {
      result = { ok: false, reason: error.message };
      return prev;
    }
  });
  return result;
}, []);
```

Keep storage unchanged at the key level unless a real blocker appears. Drafts and tickets should still persist under `itsm_tickets`.

- [ ] **Step 4: Run the helper test to verify GREEN**

Run: `pnpm vitest run src/utils/__tests__/ticketDrafts.test.js`
Expected: PASS.

- [ ] **Step 5: Commit the context extension**

```bash
git add src/context/TicketContext.jsx src/utils/storage.js src/utils/ticketDrafts.js src/utils/__tests__/ticketDrafts.test.js
git commit -m "feat: add draft-aware ticket context actions"
```

## Task 4: Add requester submit-page draft and recommendation workflow

**Files:**
- Modify: `src/pages/TicketSubmit/index.jsx`
- Modify: `src/router/index.jsx`
- Reuse: `src/utils/ticketDrafts.js`
- Reuse: `src/utils/aiRecommendation.js`
- Create: `src/pages/TicketSubmit/__tests__/TicketSubmitPage.test.jsx`
- Check: `src/components/common/FileUploader.jsx`
- Check: `src/components/common/RichTextEditor.jsx`

- [ ] **Step 1: Write the failing submit-page integration test**

Create `src/pages/TicketSubmit/__tests__/TicketSubmitPage.test.jsx` with a focused user-path test:

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import TicketSubmitPage from '../index.jsx';

test('requester must generate recommendation before submit is allowed', async () => {
  render(/* page with mocked auth + ticket context */);

  await userEvent.type(screen.getByLabelText('标题'), 'CRM导出失败');
  await userEvent.click(screen.getByRole('button', { name: '暂存' }));

  expect(screen.getByRole('button', { name: '提交工单' })).toBeDisabled();

  await userEvent.click(screen.getByRole('button', { name: '智能推荐' }));

  await waitFor(() => {
    expect(screen.getByText('推荐处理思路')).toBeInTheDocument();
  });

  expect(screen.getByRole('button', { name: '提交工单' })).toBeEnabled();
});
```

Add a second test in the same file:

```jsx
test('changing a key field after recommendation locks submit again', async () => {
  // save draft -> recommend -> change title -> submit disabled again
});
```

- [ ] **Step 2: Run the submit-page test to verify RED**

Run: `pnpm vitest run src/pages/TicketSubmit/__tests__/TicketSubmitPage.test.jsx`
Expected: FAIL because the page only supports direct submit today.

- [ ] **Step 3: Add submit-page local state and query-driven draft loading**

Refactor `src/pages/TicketSubmit/index.jsx` so it:
- reads `draftId` from `useSearchParams`,
- loads the draft through `getDraftById`,
- hydrates `form` and `fileList` when editing,
- tracks current recommendation state separately from raw form values,
- keeps the direct-submit flow removed in favor of draft-first actions.

Use the helper module for all business rules, not inline page logic. The page should call:

```js
const draft = buildDraftRecord(...);
const fingerprint = computeRecommendationFingerprint(...);
const recommendation = buildAiRecommendation(...);
```

- [ ] **Step 4: Implement the three button handlers with minimum branching**

Implement:

```js
const handleSaveDraft = async () => { ... };
const handleRecommend = async () => {
  const draft = await handleSaveDraft({ silent: true });
  // write recommendation onto that draft
};
const handleSubmitTicket = async () => {
  // block unless current draft exists and recommendation is still valid
  // call submitDraft from context
};
```

Required page rules:
- `暂存` creates or updates one draft record.
- `智能推荐` always saves first, then writes recommendation data back to the same draft.
- `提交工单` is disabled until there is a current draft and recommendation is valid.
- after recommendation, changing title/description/priority/system/tool type makes submit disabled again.
- after successful submit, navigate to `/tickets/<ticketId>`.

- [ ] **Step 5: Render the recommendation result card**

Below the form actions, add a card section that only appears when recommendation data exists:

```jsx
<Card title="智能推荐">
  <Typography.Text strong>问题摘要</Typography.Text>
  <Paragraph>{recommendation.summary}</Paragraph>
  <Typography.Text strong>推荐解决方案</Typography.Text>
  <ul>{recommendation.solutions.map(...)}</ul>
  <Typography.Text strong>建议下一步</Typography.Text>
  <ul>{recommendation.nextActions.map(...)}</ul>
</Card>
```

Also render a subtle warning when recommendation exists but is invalidated by current form edits.

- [ ] **Step 6: Run the submit-page tests to verify GREEN**

Run: `pnpm vitest run src/pages/TicketSubmit/__tests__/TicketSubmitPage.test.jsx`
Expected: PASS.

- [ ] **Step 7: Refactor duplicated field extraction if needed, then re-run**

If `index.jsx` grows too large, split a tiny helper such as `extractSubmitFormValues(values)` into `src/utils/ticketDrafts.js` or a local page helper. Do not over-abstract.

Run: `pnpm vitest run src/pages/TicketSubmit/__tests__/TicketSubmitPage.test.jsx src/utils/__tests__/ticketDrafts.test.js src/utils/__tests__/aiRecommendation.test.js`
Expected: PASS.

- [ ] **Step 8: Commit the submit workflow**

```bash
git add src/pages/TicketSubmit/index.jsx src/router/index.jsx src/pages/TicketSubmit/__tests__/TicketSubmitPage.test.jsx src/utils/ticketDrafts.js src/utils/aiRecommendation.js
git commit -m "feat: add requester draft and recommendation submit flow"
```

## Task 5: Add requester list filters and draft tab behavior

**Files:**
- Modify: `src/pages/TicketList/index.jsx`
- Create: `src/components/TicketList/TicketFilters.jsx`
- Modify: `src/components/TicketList/TicketTable.jsx`
- Create: `src/utils/ticketFilters.js`
- Create: `src/utils/__tests__/ticketFilters.test.js`
- Create: `src/pages/TicketList/__tests__/TicketListPage.test.jsx`
- Check: `src/constants/ticketStatus.js`
- Check: `src/constants/priorities.js`
- Check: `src/constants/systems.js`

- [ ] **Step 1: Write the failing filter helper test**

Create `src/utils/__tests__/ticketFilters.test.js`:

```js
import { expect, test } from 'vitest';
import { buildRequesterTabs, filterTicketsForList } from '../ticketFilters.js';

test('buildRequesterTabs keeps drafts out of the all tab and in the draft tab only', () => {
  const tabs = buildRequesterTabs({
    tickets: [
      { id: 'DRF-1', recordType: 'DRAFT', requesterId: 'u1', draftConvertedToTicketId: '' },
      { id: 'TKT-1', recordType: 'TICKET', requesterId: 'u1', status: 'PENDING' }
    ],
    user: { id: 'u1' }
  });

  expect(tabs.find((tab) => tab.key === 'ALL').data.map((item) => item.id)).toEqual(['TKT-1']);
  expect(tabs.find((tab) => tab.key === 'DRAFT').data.map((item) => item.id)).toEqual(['DRF-1']);
});

test('filterTicketsForList matches by id title date range priority and system', () => {
  const filtered = filterTicketsForList({
    tickets: [
      {
        id: 'TKT-1',
        title: 'CRM导出失败',
        createdAt: '2026-04-21T10:00:00.000Z',
        priority: 'P2',
        systemCode: 'CRM'
      }
    ],
    filters: {
      keywordId: 'TKT-1',
      keywordTitle: '导出',
      dateRange: ['2026-04-20', '2026-04-21'],
      priority: 'P2',
      systemCode: 'CRM'
    }
  });

  expect(filtered).toHaveLength(1);
});
```

- [ ] **Step 2: Run the filter helper test to verify RED**

Run: `pnpm vitest run src/utils/__tests__/ticketFilters.test.js`
Expected: FAIL because `ticketFilters.js` does not exist yet.

- [ ] **Step 3: Implement the pure list filter helpers**

Create `src/utils/ticketFilters.js` with:
- `buildRequesterTabs({ tickets, user })`
- `filterTicketsForList({ tickets, filters })`
- tiny local helpers such as `matchesDateRange`.

Keep the tab-building rule explicit:
- `ALL` => requester formal tickets only
- `DRAFT` => requester drafts only, not converted
- status tabs => requester formal tickets by status

- [ ] **Step 4: Run the filter helper test to verify GREEN**

Run: `pnpm vitest run src/utils/__tests__/ticketFilters.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing requester list integration test**

Create `src/pages/TicketList/__tests__/TicketListPage.test.jsx`:

```jsx
test('requester list shows a draft tab and routes draft rows to edit mode', async () => {
  render(/* page with requester auth and one draft + one ticket */);

  await userEvent.click(screen.getByRole('tab', { name: /草稿/ }));
  expect(screen.getByText('DRF-20260421-0001')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '继续编辑' })).toBeInTheDocument();
});
```

Add a second test:

```jsx
test('list filters narrow the active requester tab data', async () => {
  // fill ID/title/date/priority/system filters and assert the table shrinks correctly
});
```

- [ ] **Step 6: Run the requester list test to verify RED**

Run: `pnpm vitest run src/pages/TicketList/__tests__/TicketListPage.test.jsx`
Expected: FAIL because draft tab and filters are not present yet.

- [ ] **Step 7: Build the filter UI component and wire it into the page**

Create `src/components/TicketList/TicketFilters.jsx` as a focused search form that emits one object shaped like:

```js
{
  keywordId: '',
  keywordTitle: '',
  dateRange: [],
  priority: undefined,
  systemCode: undefined
}
```

Update `src/pages/TicketList/index.jsx` to:
- keep requester-only filter state,
- use `buildRequesterTabs`,
- apply `filterTicketsForList` to the currently selected tab data,
- render the new filter card above the tabs.

- [ ] **Step 8: Update the shared table for draft-safe rendering**

Modify `src/components/TicketList/TicketTable.jsx` so draft rows:
- route number/title clicks to `/tickets/new?draftId=<id>`,
- render a fixed draft status tag,
- skip SLA countdown and due time,
- render `继续编辑` in the action column,
- remain sortable by created time.

Do not add a fake `DRAFT` entry into `STATUS`; keep draft behavior local to table/list rendering.

- [ ] **Step 9: Run the list integration and helper tests to verify GREEN**

Run: `pnpm vitest run src/pages/TicketList/__tests__/TicketListPage.test.jsx src/utils/__tests__/ticketFilters.test.js`
Expected: PASS.

- [ ] **Step 10: Re-run the previously added submit tests for regression coverage**

Run: `pnpm vitest run src/pages/TicketSubmit/__tests__/TicketSubmitPage.test.jsx src/pages/TicketList/__tests__/TicketListPage.test.jsx src/utils/__tests__/ticketDrafts.test.js src/utils/__tests__/aiRecommendation.test.js src/utils/__tests__/ticketFilters.test.js`
Expected: PASS.

- [ ] **Step 11: Commit the list behavior**

```bash
git add src/pages/TicketList/index.jsx src/components/TicketList/TicketFilters.jsx src/components/TicketList/TicketTable.jsx src/utils/ticketFilters.js src/utils/__tests__/ticketFilters.test.js src/pages/TicketList/__tests__/TicketListPage.test.jsx
git commit -m "feat: add requester draft tab and list filters"
```

## Task 6: Final verification and cleanup

**Files:**
- Check: `src/pages/TicketSubmit/index.jsx`
- Check: `src/pages/TicketList/index.jsx`
- Check: `src/components/TicketList/TicketTable.jsx`
- Check: `src/context/TicketContext.jsx`
- Check: `src/utils/ticketDrafts.js`
- Check: `src/utils/aiRecommendation.js`
- Check: `src/utils/ticketFilters.js`

- [ ] **Step 1: Run the full targeted test suite**

Run:

```bash
pnpm vitest run src/utils/__tests__/ticketDrafts.test.js src/utils/__tests__/aiRecommendation.test.js src/utils/__tests__/ticketFilters.test.js src/pages/TicketSubmit/__tests__/TicketSubmitPage.test.jsx src/pages/TicketList/__tests__/TicketListPage.test.jsx
```

Expected: PASS.

- [ ] **Step 2: Run the production build**

Run: `pnpm build`
Expected: Vite build completes without compile errors.

- [ ] **Step 3: Manually smoke-test the prototype in the browser**

Run: `pnpm dev`
Expected: The dev server starts and serves the app on the configured Vite port.

Manually verify:
- requester can create a new draft with `暂存`
- draft appears under `草稿` tab
- opening the draft repopulates form fields
- `智能推荐` saves first and shows recommendation output
- `提交工单` is disabled before recommendation
- changing a key field after recommendation disables submit again
- successful submit opens a real ticket detail page
- requester list filters work on draft and formal tabs
- draft rows do not show SLA countdown

- [ ] **Step 4: Remove dead code and verify imports**

Inspect touched files for:
- now-unused imports,
- duplicate form-to-ticket mapping,
- accidental draft logic leaking into the state machine.

- [ ] **Step 5: Commit the final cleanup**

```bash
git add src package.json vite.config.js pnpm-lock.yaml
git commit -m "chore: verify requester draft recommendation flow"
```

- [ ] **Step 6: Capture verification evidence in the handoff**

Record:
- exact Vitest command output status,
- `pnpm build` status,
- whether browser smoke tests were completed or blocked.
