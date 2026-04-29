import test from 'node:test';
import assert from 'node:assert/strict';

import { getReusableCustomTags, getUserTicketTags } from '../customTicketTags.js';

test('getUserTicketTags 只读取当前用户在当前工单上的自定义标签', () => {
  const tags = getUserTicketTags(
    {
      customTagsByUser: {
        u_a: ['数据问题'],
        u_b: ['不可见标签']
      }
    },
    'u_a'
  );

  assert.deepEqual(tags, ['数据问题']);
});

test('getReusableCustomTags 按用户维度跨工单复用并去重', () => {
  const tags = getReusableCustomTags(
    [
      { customTagsByUser: { u_a: ['数据问题', 'P1复盘'], u_b: ['他人标签'] } },
      { customTagsByUser: { u_a: ['数据问题', '权限问题'] } }
    ],
    'u_a'
  );

  assert.deepEqual(tags, ['数据问题', 'P1复盘', '权限问题']);
});
