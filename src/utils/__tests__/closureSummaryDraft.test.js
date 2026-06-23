import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearClosureSummaryDraft,
  getClosureSummaryCacheKey,
  readClosureSummaryDraft,
  writeCompletedClosureSummaryDraft
} from '../closureSummaryDraft.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test('办结自动总结只缓存生成完成后的文本', () => {
  const storage = createMemoryStorage();
  const key = getClosureSummaryCacheKey('TKT-001', 'u1');

  writeCompletedClosureSummaryDraft(storage, 'TKT-001', 'u1', '  ');
  assert.equal(storage.getItem(key), null);

  writeCompletedClosureSummaryDraft(storage, 'TKT-001', 'u1', '处理完成');
  assert.equal(readClosureSummaryDraft(storage, 'TKT-001', 'u1')?.text, '处理完成');

  storage.setItem(key, JSON.stringify({ completed: false, text: '半截内容' }));
  assert.equal(readClosureSummaryDraft(storage, 'TKT-001', 'u1'), null);
});

test('办结自动总结缓存可按工单和用户清理', () => {
  const storage = createMemoryStorage();
  const key = getClosureSummaryCacheKey('TKT-002', 'u2');

  writeCompletedClosureSummaryDraft(storage, 'TKT-002', 'u2', '缓存内容');
  clearClosureSummaryDraft(storage, 'TKT-002', 'u2');

  assert.equal(storage.getItem(key), null);
});
