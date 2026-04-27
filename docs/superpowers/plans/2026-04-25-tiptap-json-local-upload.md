# Tiptap JSON + Local Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy rich text pipeline with Tiptap JSON, add protected local file upload for rich-text images and attachments, and keep old HTML/base64 records readable for the demo.

**Architecture:** The backend adds a persisted upload registry plus protected upload/download endpoints backed by `data/uploads`. The frontend switches rich text persistence from `descriptionHtml/contentHtml` to `descriptionDoc/contentDoc`, rewrites editor/preview helpers around Tiptap, and moves attachment/image handling to URL-based file references while preserving legacy HTML/base64 fallback.

**Tech Stack:** Next.js App Router, React 18, Ant Design, better-sqlite3, Tiptap, Node.js fs/path, existing ticket state machine and test suite.

---

## File Structure

**Create:**
- `app/api/uploads/route.js` — protected multipart upload endpoint
- `app/api/uploads/[id]/route.js` — protected file read/download endpoint
- `src/server/uploads.js` — upload persistence, disk storage, and cleanup helpers
- `src/server/__tests__/uploads.test.js` — upload API and cleanup tests
- `src/utils/__tests__/richTextJson.test.js` — rich text JSON conversion tests
- `src/utils/__tests__/attachmentModel.test.js` — new attachment model tests

**Modify:**
- `package.json` — add Tiptap dependencies
- `src/server/db.js` — create and reset `uploads` table
- `src/server/store.js` — reset upload storage during reset flow if needed
- `app/api/reset/route.js` — include upload cleanup
- `src/utils/fileUtils.js` — replace base64 persistence path with upload response normalization
- `src/components/common/FileUploader.jsx` — upload files through API and return URL-based metadata
- `src/components/common/AttachmentList.jsx` — use `url` first, fall back to `base64`
- `src/utils/richText.js` — add JSON helpers and legacy HTML compatibility
- `src/utils/descriptionHistory.js` — switch history snapshots to `descriptionDoc`
- `src/utils/draftTicketEditing.js` — move draft updates to `descriptionDoc`
- `src/state-machine/ticketStateMachine.js` — build submitted/update payloads with `descriptionDoc`
- `src/constants/ticketStatus.js` — fallback accessors for `descriptionDoc`/legacy HTML where needed
- `src/components/common/RichTextEditor.jsx` — rebuild editor with Tiptap, upload, and paste-image support
- `src/components/common/RichContentPreview.jsx` — render JSON first, HTML fallback second
- `src/views/TicketSubmit/index.jsx` — submit `descriptionDoc`
- `src/components/TicketDetail/RequesterActions.jsx` — edit `descriptionDoc`
- `src/components/TicketDetail/DraftTicketEditButton.jsx` — edit `descriptionDoc`
- `src/components/TicketDetail/MessageBoard.jsx` — compose `contentDoc`
- `src/components/TicketDetail/messageComposer.js` — derive payload from `contentDoc`
- `src/components/TicketDetail/DescriptionHistoryModal.jsx` — preview `descriptionDoc`
- `src/components/TicketDetail/TicketInfoCard.jsx` — preview `descriptionDoc`
- `src/index.css` — map existing editor styles onto Tiptap surface
- `src/mock/initialTickets.json` — optional compatibility fixtures if needed by tests
- Existing tests under `src/utils/__tests__`, `src/components/TicketDetail/__tests__`, `src/state-machine/__tests__`, `src/server/__tests__`

### Task 1: Add protected local upload infrastructure

**Files:**
- Create: `app/api/uploads/route.js`
- Create: `app/api/uploads/[id]/route.js`
- Create: `src/server/uploads.js`
- Create: `src/server/__tests__/uploads.test.js`
- Modify: `src/server/db.js`
- Modify: `app/api/reset/route.js`

- [ ] **Step 1: Write the failing tests**

Add tests that verify login is required, upload metadata is stored, files are written to disk, downloads return bytes, and reset clears uploads.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { POST as uploadPost } from '../../../app/api/uploads/route.js';
import { GET as uploadGet } from '../../../app/api/uploads/[id]/route.js';
import { POST as resetPost } from '../../../app/api/reset/route.js';
import { getUploadById, uploadsDir } from '../uploads.js';

test('upload api rejects anonymous request', async () => {
  const request = new Request('http://localhost:3002/api/uploads', {
    method: 'POST',
    body: new FormData()
  });

  const response = await uploadPost(request);
  assert.equal(response.status, 401);
});

test('upload api stores file and returns protected url', async () => {
  const form = new FormData();
  form.append('file', new File(['demo'], 'demo.txt', { type: 'text/plain' }));
  const request = buildAuthedRequest('http://localhost:3002/api/uploads', form);

  const response = await uploadPost(request);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(payload.file.url, /^\/api\/uploads\//);
  assert.ok(fs.existsSync(path.join(uploadsDir, payload.file.storedName)));
  assert.equal(getUploadById(payload.file.uploadId).originalName, 'demo.txt');
});

test('upload download api returns stored bytes for logged-in user', async () => {
  const uploaded = await createUploadedFixture();
  const response = await uploadGet(buildAuthedRequest(`http://localhost:3002${uploaded.url}`), {
    params: { id: uploaded.uploadId }
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'fixture');
});

test('reset clears upload metadata and files', async () => {
  const uploaded = await createUploadedFixture();
  const response = await resetPost(buildAuthedRequest('http://localhost:3002/api/reset', new FormData()));
  assert.equal(response.status, 200);
  assert.equal(getUploadById(uploaded.uploadId), null);
  assert.equal(fs.existsSync(path.join(uploadsDir, uploaded.storedName)), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/server/__tests__/uploads.test.js`
Expected: FAIL because upload routes and storage helpers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement upload persistence and endpoints.

```js
// src/server/uploads.js
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb } from './db.js';

export const uploadsDir = path.join(process.cwd(), 'data', 'uploads');

export function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export function saveUpload({ fileName, mimeType, bytes, uploader }) {
  ensureUploadsDir();
  const uploadId = `upl_${randomUUID()}`;
  const extension = path.extname(fileName || '');
  const storedName = `${uploadId}${extension}`;
  fs.writeFileSync(path.join(uploadsDir, storedName), Buffer.from(bytes));
  getDb().prepare(`
    INSERT INTO uploads (id, stored_name, original_name, mime_type, size, created_at, uploader_id, uploader_name)
    VALUES (@id, @stored_name, @original_name, @mime_type, @size, @created_at, @uploader_id, @uploader_name)
  `).run({
    id: uploadId,
    stored_name: storedName,
    original_name: fileName,
    mime_type: mimeType,
    size: bytes.length,
    created_at: new Date().toISOString(),
    uploader_id: uploader?.id || '',
    uploader_name: uploader?.name || ''
  });
  return {
    uploadId,
    storedName,
    name: fileName,
    type: mimeType,
    size: bytes.length,
    url: `/api/uploads/${uploadId}`
  };
}
```

```js
// app/api/uploads/route.js
import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '../../../src/server/session.js';
import { isAllowedAttachment } from '../../../src/utils/fileUtils.js';
import { saveUpload } from '../../../src/server/uploads.js';

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !isAllowedAttachment(file)) {
    return NextResponse.json({ ok: false, reason: '不支持的文件类型' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = saveUpload({ fileName: file.name, mimeType: file.type, bytes: buffer, uploader: user });
  return NextResponse.json({ ok: true, file: saved });
}
```

```js
// app/api/uploads/[id]/route.js
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import { getUploadById, uploadsDir } from '../../../../src/server/uploads.js';

export async function GET(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });

  const upload = getUploadById(params.id);
  if (!upload) return NextResponse.json({ ok: false, reason: '文件不存在' }, { status: 404 });

  const filePath = path.join(uploadsDir, upload.storedName);
  const bytes = fs.readFileSync(filePath);
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': upload.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(upload.originalName)}`
    }
  });
}
```

```js
// src/server/db.js addition
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  stored_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  uploader_id TEXT,
  uploader_name TEXT
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/server/__tests__/uploads.test.js`
Expected: PASS with all upload tests green.

- [ ] **Step 5: Commit**

```bash
git add app/api/uploads/route.js app/api/uploads/[id]/route.js src/server/uploads.js src/server/__tests__/uploads.test.js src/server/db.js app/api/reset/route.js
git commit -m "feat: add protected local upload storage"
```

### Task 2: Add rich text JSON utilities and attachment model helpers

**Files:**
- Create: `src/utils/__tests__/richTextJson.test.js`
- Create: `src/utils/__tests__/attachmentModel.test.js`
- Modify: `src/utils/richText.js`
- Modify: `src/utils/fileUtils.js`

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyRichTextDoc,
  richTextDocHasContent,
  richTextDocToPlainText,
  richTextDocToHtml,
  richTextHtmlToDoc
} from '../richText.js';
import { normalizeUploadedAttachment } from '../fileUtils.js';

test('richTextDocHasContent returns false for empty doc', () => {
  assert.equal(richTextDocHasContent(createEmptyRichTextDoc()), false);
});

test('richTextDocToPlainText extracts paragraph text', () => {
  const doc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '你好' }] }]
  };
  assert.equal(richTextDocToPlainText(doc), '你好');
});

test('richTextHtmlToDoc converts image html into image node', () => {
  const doc = richTextHtmlToDoc('<p>说明</p><img src="/api/uploads/upl_1" alt="截图" />');
  assert.equal(doc.type, 'doc');
  assert.equal(doc.content[1].type, 'image');
});

test('normalizeUploadedAttachment maps upload payload to attachment model', () => {
  const normalized = normalizeUploadedAttachment({
    uploadId: 'upl_1',
    url: '/api/uploads/upl_1',
    name: 'demo.png',
    type: 'image/png',
    size: 12
  }, { name: '张三' });

  assert.equal(normalized.uploadId, 'upl_1');
  assert.equal(normalized.url, '/api/uploads/upl_1');
  assert.equal(normalized.base64, undefined);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/utils/__tests__/richTextJson.test.js src/utils/__tests__/attachmentModel.test.js`
Expected: FAIL because the JSON helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/richText.js
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

export function createEmptyRichTextDoc() {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function richTextDocHasContent(doc) {
  return Boolean(richTextDocToPlainText(doc) || findImageNode(doc));
}

export function richTextDocToPlainText(doc) {
  return collectText(doc).trim();
}

export function richTextDocToHtml(doc) {
  if (!doc) return '';
  return generateHTML(doc, [StarterKit, Underline, Link, Image]);
}
```

```js
// src/utils/fileUtils.js additions
export function normalizeUploadedAttachment(file, uploader) {
  return {
    id: file.uploadId,
    uploadId: file.uploadId,
    name: file.name,
    type: file.type,
    size: file.size,
    url: file.url,
    uploadedAt: new Date().toISOString(),
    uploader: uploader?.name || uploader?.id || ''
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/utils/__tests__/richTextJson.test.js src/utils/__tests__/attachmentModel.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/richText.js src/utils/fileUtils.js src/utils/__tests__/richTextJson.test.js src/utils/__tests__/attachmentModel.test.js
git commit -m "feat: add rich text json helpers"
```

### Task 3: Move state-machine payloads and history to JSON rich text

**Files:**
- Modify: `src/utils/descriptionHistory.js`
- Modify: `src/utils/draftTicketEditing.js`
- Modify: `src/state-machine/ticketStateMachine.js`
- Modify: `src/constants/ticketStatus.js`
- Modify: `src/state-machine/__tests__/ticketStateMachine.test.js`
- Modify: `src/utils/__tests__/draftTicketEditing.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test('buildDescriptionUpdate stores descriptionDoc instead of descriptionHtml', () => {
  const ticket = { description: '旧内容', descriptionDoc: createParagraphDoc('旧内容'), descriptionHistory: [] };
  const update = buildDescriptionUpdate(ticket, {
    descriptionDoc: createParagraphDoc('新内容'),
    user: { id: 'u1', name: '张三' },
    reason: '修改'
  });

  assert.equal(update.description, '新内容');
  assert.equal(update.descriptionDoc.content[0].content[0].text, '新内容');
  assert.equal(update.descriptionHistory[0].descriptionDoc.type, 'doc');
});

test('SUBMIT transition preserves descriptionDoc and generated plain text', () => {
  const nextTicket = applyTransition(null, EVENTS.SUBMIT, {
    id: 'T20260425001',
    title: 'demo',
    descriptionDoc: createParagraphDoc('导出失败'),
    description: '导出失败',
    attachments: []
  }, requesterUser);

  assert.equal(nextTicket.description, '导出失败');
  assert.equal(nextTicket.descriptionHistory[0].descriptionDoc.type, 'doc');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/state-machine/__tests__/ticketStateMachine.test.js src/utils/__tests__/draftTicketEditing.test.js`
Expected: FAIL because the code still reads and writes `descriptionHtml`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/descriptionHistory.js signature shift
export function buildDescriptionUpdate(ticket, { descriptionDoc, user, reason }) {
  const nextDescription = richTextDocToPlainText(descriptionDoc);
  const currentDescription = ticket?.description || '';
  const currentDoc = JSON.stringify(ticket?.descriptionDoc || null);
  const nextDoc = JSON.stringify(descriptionDoc || null);

  if (currentDescription === nextDescription && currentDoc === nextDoc) {
    return null;
  }

  const historyEntry = buildDescriptionHistoryEntry({
    ticket,
    descriptionDoc,
    description: nextDescription,
    user,
    reason
  });

  return {
    description: nextDescription,
    descriptionDoc,
    updatedAt: historyEntry.editedAt,
    descriptionHistory: [...(ticket?.descriptionHistory || []), historyEntry]
  };
}
```

```js
// src/state-machine/ticketStateMachine.js buildSubmittedTicket
const descriptionDoc = payload.descriptionDoc || createEmptyRichTextDoc();
const description = payload.description || richTextDocToPlainText(descriptionDoc);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/state-machine/__tests__/ticketStateMachine.test.js src/utils/__tests__/draftTicketEditing.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/descriptionHistory.js src/utils/draftTicketEditing.js src/state-machine/ticketStateMachine.js src/constants/ticketStatus.js src/state-machine/__tests__/ticketStateMachine.test.js src/utils/__tests__/draftTicketEditing.test.js
git commit -m "refactor: persist rich text docs in state machine"
```

### Task 4: Rebuild editor and uploader components on Tiptap + protected upload

**Files:**
- Modify: `src/components/common/RichTextEditor.jsx`
- Modify: `src/components/common/FileUploader.jsx`
- Modify: `src/index.css`
- Modify: `package.json`

- [ ] **Step 1: Write the failing tests**

Add targeted assertions for the editor and uploader behavior.

```js
test('editor onChange emits descriptionDoc after text input', async () => {
  const changes = [];
  render(<RichTextEditor value={createEmptyRichTextDoc()} onChange={(value) => changes.push(value)} />);
  await userEvent.click(screen.getByRole('textbox'));
  await userEvent.keyboard('问题描述');
  assert.equal(changes.at(-1).type, 'doc');
});

test('editor uploads pasted image and inserts image node', async () => {
  global.fetch = mockUploadSuccess('/api/uploads/upl_1');
  render(<RichTextEditor value={createEmptyRichTextDoc()} onChange={() => {}} />);
  fireEvent.paste(screen.getByRole('textbox'), {
    clipboardData: buildClipboardWithImage(new File(['img'], 'demo.png', { type: 'image/png' }))
  });
  await screen.findByAltText('demo.png');
});

test('file uploader normalizes uploaded attachment response', async () => {
  global.fetch = mockUploadSuccess('/api/uploads/upl_2');
  const changes = [];
  render(<FileUploader fileList={[]} onChange={(next) => changes.push(next)} />);
  await upload(screen.getByText('上传附件'), new File(['demo'], 'demo.txt', { type: 'text/plain' }));
  assert.equal(changes.at(-1)[0].attachmentData.url, '/api/uploads/upl_2');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/components/common/__tests__/richTextEditor.test.js src/components/common/__tests__/fileUploader.test.js`
Expected: FAIL because the components and dependencies are not in place.

- [ ] **Step 3: Write minimal implementation**

```js
// RichTextEditor core shape
const editor = useEditor({
  immediatelyRender: false,
  extensions: [
    StarterKit,
    Underline,
    Link.configure({ openOnClick: false }),
    Image.extend({ addAttributes() { return { uploadId: { default: null }, alt: { default: null }, title: { default: null } }; } }),
    Placeholder.configure({ placeholder })
  ],
  content: normalizeEditorValue(value),
  editable: !disabled,
  onUpdate: ({ editor }) => onChange?.(editor.getJSON())
});

async function uploadAndInsertImage(file) {
  const uploaded = await uploadFile(file);
  editor.chain().focus().setImage({ src: uploaded.url, alt: file.name, title: file.name, uploadId: uploaded.uploadId }).run();
}
```

```js
// FileUploader upload path
async function uploadFileItem(file, uploader) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/uploads', { method: 'POST', body: form });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || '上传失败');
  return normalizeUploadedAttachment(payload.file, uploader);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/components/common/__tests__/richTextEditor.test.js src/components/common/__tests__/fileUploader.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json src/components/common/RichTextEditor.jsx src/components/common/FileUploader.jsx src/index.css src/components/common/__tests__/richTextEditor.test.js src/components/common/__tests__/fileUploader.test.js
git commit -m "feat: replace editor with tiptap and upload support"
```

### Task 5: Wire submit, draft, supplement, message, preview, and attachment views to the new model

**Files:**
- Modify: `src/views/TicketSubmit/index.jsx`
- Modify: `src/components/TicketDetail/RequesterActions.jsx`
- Modify: `src/components/TicketDetail/DraftTicketEditButton.jsx`
- Modify: `src/components/TicketDetail/MessageBoard.jsx`
- Modify: `src/components/TicketDetail/messageComposer.js`
- Modify: `src/components/common/RichContentPreview.jsx`
- Modify: `src/components/common/AttachmentList.jsx`
- Modify: `src/components/TicketDetail/DescriptionHistoryModal.jsx`
- Modify: `src/components/TicketDetail/TicketInfoCard.jsx`
- Modify: `src/components/TicketDetail/__tests__/messageComposer.test.js`
- Modify: `src/components/TicketDetail/__tests__/actionAreaUi.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test('message payload stores contentDoc and plain text', async () => {
  const payload = await buildMessagePayload({
    contentDoc: createParagraphDoc('已处理'),
    fileList: [],
    user: validUser
  });

  assert.equal(payload.content, '已处理');
  assert.equal(payload.contentDoc.type, 'doc');
  assert.equal(payload.contentHtml, undefined);
});

test('RichContentPreview renders JSON document image url', () => {
  render(<RichContentPreview doc={{ type: 'doc', content: [{ type: 'image', attrs: { src: '/api/uploads/upl_1' } }] }} />);
  assert.equal(screen.getByRole('img').getAttribute('src'), '/api/uploads/upl_1');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/components/TicketDetail/__tests__/messageComposer.test.js src/components/TicketDetail/__tests__/actionAreaUi.test.js`
Expected: FAIL because these flows still use HTML fields.

- [ ] **Step 3: Write minimal implementation**

```js
// TicketSubmit handleFinish excerpt
const descriptionDoc = values.descriptionDoc || createEmptyRichTextDoc();
const ticket = {
  id,
  ...,
  descriptionDoc,
  description: richTextDocToPlainText(descriptionDoc),
  attachments
};
```

```js
// messageComposer excerpt
export function hasMessageInput({ content = '', contentDoc = null, fileList } = {}) {
  return hasTextContent(content) || richTextDocHasContent(contentDoc) || Boolean(fileList?.length);
}

const normalizedContent = hasTextContent(content)
  ? content.trim()
  : richTextDocToPlainText(contentDoc);
```

```js
// RichContentPreview shape
export default function RichContentPreview({ doc, html, text, className = '', emptyText = '-' }) {
  const renderedHtml = doc ? richTextDocToHtml(doc) : html || '';
  ...
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/components/TicketDetail/__tests__/messageComposer.test.js src/components/TicketDetail/__tests__/actionAreaUi.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/TicketSubmit/index.jsx src/components/TicketDetail/RequesterActions.jsx src/components/TicketDetail/DraftTicketEditButton.jsx src/components/TicketDetail/MessageBoard.jsx src/components/TicketDetail/messageComposer.js src/components/common/RichContentPreview.jsx src/components/common/AttachmentList.jsx src/components/TicketDetail/DescriptionHistoryModal.jsx src/components/TicketDetail/TicketInfoCard.jsx src/components/TicketDetail/__tests__/messageComposer.test.js src/components/TicketDetail/__tests__/actionAreaUi.test.js
git commit -m "feat: wire ticket flows to rich text docs and upload urls"
```

### Task 6: Run compatibility and regression verification

**Files:**
- Modify: `src/server/__tests__/ticketApiStateMachine.test.js`
- Modify: `src/utils/__tests__/ticketListActions.test.js`
- Modify: `src/server/__tests__/session.test.js` (only if fixtures need updates)
- Modify: `src/mock/initialTickets.json` (if compatibility fixture coverage is needed)

- [ ] **Step 1: Write the failing tests**

```js
test('legacy base64 attachment still renders in attachment list', () => {
  const legacy = [{ id: 'att_1', name: '截图.png', type: 'image/png', size: 1, base64: 'data:image/png;base64,abc' }];
  render(<AttachmentList attachments={legacy} compact />);
  assert.ok(screen.getByRole('img').getAttribute('src').startsWith('data:image/png;base64,'));
});

test('legacy html ticket preview still renders when descriptionDoc is missing', () => {
  render(<RichContentPreview html="<p>旧内容</p>" />);
  assert.equal(screen.getByText('旧内容').textContent, '旧内容');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec node --test src/server/__tests__/ticketApiStateMachine.test.js src/utils/__tests__/ticketListActions.test.js src/components/TicketDetail/__tests__/messageComposer.test.js`
Expected: FAIL until compatibility fallbacks are finished.

- [ ] **Step 3: Write minimal implementation**

Apply only the compatibility glue needed for tests:

```js
// AttachmentList source selection
const source = attachment.url || attachment.base64 || '';
```

```js
// RichContentPreview selection
const renderedHtml = doc ? richTextDocToHtml(doc) : html || '';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec node --test src/server/__tests__/ticketApiStateMachine.test.js src/utils/__tests__/ticketListActions.test.js src/components/TicketDetail/__tests__/messageComposer.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/__tests__/ticketApiStateMachine.test.js src/utils/__tests__/ticketListActions.test.js src/mock/initialTickets.json
 git commit -m "test: cover compatibility for legacy rich text and attachments"
```

### Task 7: Final verification

**Files:**
- Modify: any files changed by prior tasks only if fixes are needed

- [ ] **Step 1: Run focused full verification**

Run:

```bash
pnpm exec node --test \
  src/server/__tests__/uploads.test.js \
  src/server/__tests__/ticketApiStateMachine.test.js \
  src/state-machine/__tests__/ticketStateMachine.test.js \
  src/utils/__tests__/richTextJson.test.js \
  src/utils/__tests__/attachmentModel.test.js \
  src/utils/__tests__/draftTicketEditing.test.js \
  src/components/TicketDetail/__tests__/messageComposer.test.js
```

Expected: PASS.

- [ ] **Step 2: Run app-level verification**

Run:

```bash
pnpm build
```

Expected: build succeeds with exit code 0.

- [ ] **Step 3: Summarize any remaining gaps before handoff**

If any legacy fixture or low-priority UI polish remains, document it explicitly in the final handoff instead of silently carrying it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: migrate rich text and uploads to tiptap json"
```

## Self-Review

### Spec coverage

- Protected local upload infrastructure is covered by Task 1.
- Tiptap JSON helpers and attachment model normalization are covered by Task 2.
- State machine and description history migration are covered by Task 3.
- Tiptap editor, toolbar image upload, and paste upload are covered by Task 4.
- Ticket submit, draft edit, supplement edit, message board, preview, and attachment UI migration are covered by Task 5.
- Legacy HTML/base64 compatibility is covered by Task 6.
- Verification and build proof are covered by Task 7.

### Placeholder scan

- No `TBD`, `TODO`, or deferred “implement later” wording remains.
- Each task includes specific files, concrete test commands, and implementation direction.

### Type consistency

- New rich text storage fields use `descriptionDoc` and `contentDoc` consistently.
- New file reference fields use `uploadId` and `url` consistently.
- Legacy fallback fields remain `descriptionHtml`, `contentHtml`, and `base64` only for compatibility.
