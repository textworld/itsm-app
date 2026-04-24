# Ticket Detail Quick Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight quick-message card below the right-side role action area on the ticket detail page so users can send text and attachments without leaving the action column.

**Architecture:** Keep the existing left-side `MessageBoard` as the full history view and add a new right-side `QuickMessageCard` for compact input only. Extract the smallest shared message-compose/send helper so both message entry points use the same validation, attachment handling, and message shape while keeping their UI behavior independent.

**Tech Stack:** React 18, Ant Design 5, React Router 6, existing TicketContext localStorage data flow

---

## File Map

- Modify: `src/pages/TicketDetail/index.jsx`
  - Add the right-column vertical layout (`actions` on top, `QuickMessageCard` below).
  - Add a message-board anchor ref and pass a `view all messages` callback into the quick-message card.
- Modify: `src/components/TicketDetail/MessageBoard.jsx`
  - Replace inline send/message-building logic with the shared helper.
  - Preserve quote reply behavior and existing rich-text input UX.
- Create: `src/components/TicketDetail/QuickMessageCard.jsx`
  - Render the compact right-side form with plain-text input, file uploader, send button, and text-style “查看全部留言” action.
  - Preserve draft content on failure and clear on success.
- Create: `src/components/TicketDetail/messageComposer.js`
  - Centralize empty-content validation, attachment building, and message payload assembly for both left and right message entry points.
- Check only: `src/components/common/FileUploader.jsx`
  - Reuse existing uploader behavior without changing constraints.

## Task 1: Extract shared message composer

**Files:**
- Create: `src/components/TicketDetail/messageComposer.js`
- Modify: `src/components/TicketDetail/MessageBoard.jsx`
- Check: `src/utils/fileUtils.js`
- Check: `src/utils/richText.js`

- [ ] **Step 1: Write the shared helper module**

Create `src/components/TicketDetail/messageComposer.js` with a focused API that both UI entry points can call. Keep this module limited to shared message-domain rules only: empty-draft validation, attachment composition, and message payload assembly. Do not move UI state or component-specific behavior into it.

```js
import { shortId } from '../../utils/idGenerator.js';
import { buildAttachments } from '../../utils/fileUtils.js';

export function hasMessageInput({ hasContent, fileList }) {
  return Boolean(hasContent || fileList.length);
}

export async function composeTicketMessage({
  ticketId,
  user,
  addMessage,
  fileList,
  content,
  contentHtml = '',
  quote = null
}) {
  if (!user) {
    throw new Error('当前用户信息缺失');
  }

  const attachments = await buildAttachments(fileList, user);
  const messageItem = {
    id: shortId('m'),
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    content,
    contentHtml,
    attachments,
    quote,
    createdAt: new Date().toISOString()
  };

  addMessage(ticketId, messageItem);
  return messageItem;
}
```

- [ ] **Step 2: Replace inline send logic in `MessageBoard`**

Update `src/components/TicketDetail/MessageBoard.jsx` so `handleSend` uses the new helper instead of assembling the message inline.

Target shape:

```js
if (!hasMessageInput({
  hasContent: richTextHasContent(contentHtml),
  fileList
})) {
  message.warning('请输入留言内容或上传附件');
  return;
}

await composeTicketMessage({
  ticketId: ticket.id,
  user,
  addMessage,
  fileList,
  content: richTextToPlainText(contentHtml),
  contentHtml,
  quote: quotedMessage ? { ... } : null
});
```

Use `const { message } = AntdApp.useApp();` consistently in `MessageBoard.jsx` as well, so both message entry points use the same global toast pattern.


- [ ] **Step 3: Verify left-side behavior still matches spec**

Read through `MessageBoard.jsx` after the refactor and confirm:
- quote reply still works,
- success still clears editor + attachments + quote,
- failure still leaves current draft in place.

No command required; this is a code review checkpoint before moving on.

## Task 2: Build the right-side quick message card

**Files:**
- Create: `src/components/TicketDetail/QuickMessageCard.jsx`
- Check: `src/components/common/FileUploader.jsx`
- Check: `src/components/common/RichContentPreview.jsx`

- [ ] **Step 1: Create the compact card component**

Create `src/components/TicketDetail/QuickMessageCard.jsx` with:
- Ant Design `Card` titled `快速留言`
- plain-text `Input.TextArea`
- existing `FileUploader`
- primary send button
- text-style “查看全部留言” button
- local `content`, `fileList`, and `sending` state

Suggested structure:

```jsx
import React, { useState } from 'react';
import { App as AntdApp, Button, Card, Input, Space } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import FileUploader from '../common/FileUploader.jsx';
import { composeTicketMessage, hasMessageInput } from './messageComposer.js';

const { TextArea } = Input;
```

Use `const { message } = AntdApp.useApp();` consistently for all toast feedback in this component.


- [ ] **Step 2: Implement send behavior for plain text + attachments**

Inside `handleSend`, use the shared helper and follow the approved UX exactly:

```jsx
if (!hasMessageInput({ hasContent: content.trim(), fileList })) {
  message.warning('请输入留言内容或上传附件');
  return;
}

setSending(true);
try {
  await composeTicketMessage({
    ticketId: ticket.id,
    user,
    addMessage,
    fileList,
    content: content.trim(),
    contentHtml: '',
    quote: null
  });

  setContent('');
  setFileList([]);
  message.success('留言已发送');
} catch (error) {
  message.error(error.message === '当前用户信息缺失' ? error.message : '留言发送失败');
} finally {
  setSending(false);
}
```

Failure path requirements:
- keep current `content`
- keep current `fileList`
- if user context is missing, show `message.error('当前用户信息缺失')`
- for other failures, show `message.error('留言发送失败')`
- always reset `sending` in `finally`

Submitting-state requirements:
- pass `disabled={sending}` to `TextArea`
- pass `disabled={sending}` to `FileUploader`
- pass `loading={sending}` and/or `disabled={sending}` to the send button
- keep “查看全部留言” available during submit unless implementation shows a concrete UX issue

- [ ] **Step 3: Keep the UI compact and secondary action unobtrusive**

The bottom action row should keep the send button primary and the “查看全部留言” action secondary.

Target layout:

```jsx
<Space wrap>
  <FileUploader ... buttonText="留言附件" />
  <Button type="primary" icon={<SendOutlined />} ...>
    发送留言
  </Button>
  <Button type="text" onClick={onViewAllMessages}>
    查看全部留言
  </Button>
</Space>
```

## Task 3: Integrate the card into the detail page

**Files:**
- Modify: `src/pages/TicketDetail/index.jsx`
- Create: `src/components/TicketDetail/QuickMessageCard.jsx`

- [ ] **Step 1: Add a message-board anchor ref**

Update `src/pages/TicketDetail/index.jsx` imports to include `useRef` and create a ref near the top-level hooks.

```jsx
import React, { useEffect, useMemo, useRef } from 'react';

const messageBoardRef = useRef(null);
```

- [ ] **Step 2: Wrap the left `MessageBoard` with the anchor target**

Update the left column so the message board sits inside a `div` with `ref={messageBoardRef}`.

```jsx
<div ref={messageBoardRef}>
  <MessageBoard ticket={ticket} />
</div>
```

- [ ] **Step 3: Add the quick-message card below role actions**

Import `QuickMessageCard` and update the right column `sticky` container to a vertical `Space`.

```jsx
const handleViewAllMessages = () => {
  messageBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
```

```jsx
<div style={{ position: 'sticky', top: 16 }}>
  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
    {renderActions()}
    <QuickMessageCard
      ticket={ticket}
      onViewAllMessages={handleViewAllMessages}
    />
  </Space>
</div>
```

## Task 4: Verify behavior in the running app

This repository does not appear to have first-party automated test setup for app code, so `npm run build` is the required executable verification. `npm run dev` and browser checks are manual QA steps to run when an interactive environment is available.

**Files:**
- Check: `src/pages/TicketDetail/index.jsx`
- Check: `src/components/TicketDetail/QuickMessageCard.jsx`
- Check: `src/components/TicketDetail/MessageBoard.jsx`

- [ ] **Step 1: Run a production build to catch integration issues**

Run: `npm run build`
Expected: Vite build completes without compile errors.

- [ ] **Step 2: Start the dev server for manual QA (if interactive browser access is available)**

Run: `npm run dev`
Expected: local Vite dev server starts and prints a localhost URL.

- [ ] **Step 3: Manually verify the approved scenarios in the browser (when Step 2 is feasible)**

Open the ticket detail page and verify:
- right column order is `role actions` then `快速留言`
- sending plain text from the right works
- sending attachment-only from the right works
- sending text + attachment from the right works
- empty send shows the warning toast
- failed send (if reproducible) preserves draft input
- success clears the right-side draft and attachments
- left `MessageBoard` immediately shows the new message
- “查看全部留言” scrolls to the left message-board anchor
- mobile/narrow viewport still scrolls to the same message-board section

- [ ] **Step 4: Run one final build after manual verification**

Run: `npm run build`
Expected: still passes after any verification fixes.

## Task 5: Final cleanup and handoff

**Files:**
- Modify: `src/components/TicketDetail/messageComposer.js`
- Modify: `src/components/TicketDetail/QuickMessageCard.jsx`
- Modify: `src/components/TicketDetail/MessageBoard.jsx`
- Modify: `src/pages/TicketDetail/index.jsx`

- [ ] **Step 1: Remove any dead imports or temporary code**

Check all touched files for:
- unused imports
- duplicated message-building code that should now be gone
- accidental UI text drift from the approved labels

- [ ] **Step 2: Summarize verification evidence in handoff notes**

Capture the exact commands actually run and, if manual QA was possible, the browser scenarios actually verified so the next worker or reviewer can reproduce them quickly.
