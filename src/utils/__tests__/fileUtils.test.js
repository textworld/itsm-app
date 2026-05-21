import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAttachments,
  isExcelAttachment,
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

test('权限申请附件仅接受 Excel 文件', () => {
  assert.equal(isExcelAttachment({ name: '权限申请.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), true);
  assert.equal(isExcelAttachment({ name: '权限申请.xls', type: 'application/vnd.ms-excel' }), true);
  assert.equal(isExcelAttachment({ name: '权限说明.pdf', type: 'application/pdf' }), false);
});
