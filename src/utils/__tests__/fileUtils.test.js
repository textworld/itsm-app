import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAttachments,
  mapAttachmentsToUploadFileList
} from '../fileUtils.js';

test('已上传附件可映射为可编辑 fileList 并在保存时保留', async () => {
  const originalAttachments = [
    {
      id: 'att_1',
      name: '截图.png',
      type: 'image/png',
      size: 123,
      base64: 'data:image/png;base64,abc',
      uploadedAt: '2026-04-24T10:00:00.000Z',
      uploader: '张三 (提单人)'
    }
  ];

  const fileList = mapAttachmentsToUploadFileList(originalAttachments);
  const rebuiltAttachments = await buildAttachments(fileList, { name: '张三 (提单人)' });

  assert.equal(fileList.length, 1);
  assert.equal(fileList[0].attachmentData.id, 'att_1');
  assert.deepEqual(rebuiltAttachments, originalAttachments);
});
