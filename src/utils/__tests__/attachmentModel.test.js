import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mapAttachmentsToUploadFileList,
  normalizeUploadedAttachment
} from '../fileUtils.js';

test('上传响应可归一化为附件模型', () => {
  const attachment = normalizeUploadedAttachment(
    {
      uploadId: 'upl_1',
      url: '/api/uploads/upl_1',
      name: 'demo.png',
      type: 'image/png',
      size: 128
    },
    { name: '张三' }
  );

  assert.equal(attachment.uploadId, 'upl_1');
  assert.equal(attachment.url, '/api/uploads/upl_1');
  assert.equal(attachment.name, 'demo.png');
  assert.equal(attachment.uploader, '张三');
});

test('新附件模型可映射回 Upload fileList', () => {
  const fileList = mapAttachmentsToUploadFileList([
    {
      id: 'upl_1',
      uploadId: 'upl_1',
      name: 'demo.png',
      type: 'image/png',
      size: 128,
      url: '/api/uploads/upl_1'
    }
  ]);

  assert.equal(fileList.length, 1);
  assert.equal(fileList[0].uid, 'upl_1');
  assert.equal(fileList[0].url, '/api/uploads/upl_1');
});
