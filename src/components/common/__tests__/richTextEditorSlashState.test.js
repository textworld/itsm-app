import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../RichTextEditor.jsx', import.meta.url),
  'utf8'
);

test('富文本编辑器使用稳定的默认快捷话术数组，避免提交页反复触发 slash effect', () => {
  assert.match(source, /const EMPTY_QUICK_PHRASES = Object\.freeze\(\[\]\);/);
  assert.match(source, /quickPhrases = EMPTY_QUICK_PHRASES/);
  assert.doesNotMatch(source, /quickPhrases = \[\]/);
});

test('关闭 slash 建议在已关闭时不重复写入相同状态', () => {
  assert.match(
    source,
    /setSlashState\(\(prev\) =>[\s\S]*prev\.open === false[\s\S]*prev\.query === ''[\s\S]*prev\.activeIndex === 0[\s\S]*return prev/
  );
});
