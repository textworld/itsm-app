import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMockTicketDescriptionDoc, buildMockTicketFormValues } from '../ticketSubmitMock.js';
import { richTextToPlainText } from '../richText.js';

test('一键生成模拟工单会填充提交表单所有非 Select 字段', () => {
  const values = buildMockTicketFormValues();

  assert.equal(Object.hasOwn(values, 'toolType'), false);
  assert.equal(Object.hasOwn(values, 'priority'), false);
  assert.equal(Object.hasOwn(values, 'systemCategory'), false);
  assert.equal(Object.hasOwn(values, 'systemName'), false);
  assert.equal(values.reporterPhone, '13800138000');
  assert.equal(values.reporterEmail, 'mock.requester@example.com');
  assert.equal(values.reportForOthers, true);
  assert.equal(values.reportedUserName, '王五');
  assert.equal(values.reportedUserPhone, '13900139000');
  assert.match(values.title, /模拟/);
  assert.match(richTextToPlainText(values.descriptionDoc), /复现步骤/);
});

test('大模型生成的模拟描述可转换为富文本描述', () => {
  const doc = buildMockTicketDescriptionDoc('模拟描述第一行\n模拟处理诉求第二行');

  assert.deepEqual(doc, {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '模拟描述第一行' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '模拟处理诉求第二行' }]
      }
    ]
  });
});
