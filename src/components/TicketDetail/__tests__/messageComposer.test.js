import test from 'node:test';
import assert from 'node:assert/strict';

import { STATUS } from '../../../constants/ticketStatus.js';
import {
  buildMessagePayload,
  getVisibleMessages,
  isSystemMessage,
  isTicketMessageAllowed
} from '../messageComposer.js';

test('草稿箱工单不允许留言', () => {
  assert.equal(
    isTicketMessageAllowed({ status: STATUS.DRAFT, requesterStatus: STATUS.DRAFT }),
    false
  );
});

test('非草稿状态允许留言', () => {
  assert.equal(
    isTicketMessageAllowed({ status: STATUS.PENDING, requesterStatus: STATUS.PENDING }),
    true
  );
});

test('留言 payload 使用 contentDoc 持久化富文本', async () => {
  const payload = await buildMessagePayload({
    contentDoc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '处理完成' }]
        }
      ]
    },
    fileList: [],
    user: { id: 'u_requester_1', name: '张三', role: 'REQUESTER' }
  });

  assert.equal(payload.content, '处理完成');
  assert.equal(payload.contentDoc.type, 'doc');
  assert.equal(payload.contentHtml, undefined);
});

test('留言区过滤状态流转类系统消息并保留手工留言和附件', () => {
  const visibleMessages = getVisibleMessages([
    { id: 'm1', content: '【系统】一线已受理本工单。' },
    { id: 'm2', content: '请补充截图。' },
    { id: 'm3', content: '', attachments: [{ id: 'a1', name: '截图.png' }] }
  ]);

  assert.equal(isSystemMessage({ content: '【系统】一线已受理本工单。' }), true);
  assert.deepEqual(visibleMessages.map((message) => message.id), ['m2', 'm3']);
});
