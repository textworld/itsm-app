import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { POST as uploadPost } from '../../../app/api/uploads/route.js';
import { GET as uploadGet } from '../../../app/api/uploads/[id]/route.js';
import { POST as resetPost } from '../../../app/api/reset/route.js';
import { reseedDb } from '../db.js';
import { clearUploadStorage, getUploadById, uploadsDir } from '../uploads.js';

test.beforeEach(() => {
  reseedDb();
  clearUploadStorage();
});

test.after(() => {
  clearUploadStorage();
});

test('上传接口拒绝未登录请求', async () => {
  const response = await uploadPost({
    cookies: { get() { return undefined; } },
    async formData() {
      const form = new FormData();
      form.append('file', new File(['demo'], 'demo.txt', { type: 'text/plain' }));
      return form;
    }
  });

  assert.equal(response.status, 401);
});

test('上传接口保存文件并返回受保护访问地址', async () => {
  const form = new FormData();
  form.append('file', new File(['fixture'], 'demo.txt', { type: 'text/plain' }));

  const response = await uploadPost(buildAuthedRequest({ form }));
  const payload = await response.json();
  const upload = getUploadById(payload.file.uploadId);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.match(payload.file.url, /^\/api\/uploads\/upl_/);
  assert.ok(upload);
  assert.equal(upload.originalName, 'demo.txt');
  assert.equal(
    fs.existsSync(path.join(uploadsDir, upload.storedName)),
    true
  );
});

test('读取接口返回已存储文件内容', async () => {
  const uploaded = await createUploadedFixture();

  const response = await uploadGet(
    buildAuthedRequest(),
    { params: { id: uploaded.uploadId } }
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'fixture');
  assert.equal(response.headers.get('content-type'), 'text/plain');
});

test('reset 接口会清空上传记录与本地文件', async () => {
  const uploaded = await createUploadedFixture();

  const response = await resetPost(buildAuthedRequest());
  const filePath = path.join(uploadsDir, uploaded.storedName);

  assert.equal(response.status, 200);
  assert.equal(getUploadById(uploaded.uploadId), null);
  assert.equal(fs.existsSync(filePath), false);
});

async function createUploadedFixture() {
  const form = new FormData();
  form.append('file', new File(['fixture'], 'fixture.txt', { type: 'text/plain' }));

  const response = await uploadPost(buildAuthedRequest({ form }));
  const payload = await response.json();
  const upload = getUploadById(payload.file.uploadId);

  return {
    ...payload.file,
    storedName: upload.storedName
  };
}

function buildAuthedRequest({ userId = 'u_requester_1', form = new FormData() } = {}) {
  return {
    cookies: {
      get(name) {
        if (name !== 'itsm_session_user_id' || !userId) {
          return undefined;
        }
        return { value: userId };
      }
    },
    async formData() {
      return form;
    }
  };
}
