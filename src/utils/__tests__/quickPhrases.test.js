import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterQuickPhrases,
  insertPhraseForSlashQuery,
  getSlashQuery,
  normalizeQuickPhraseConfig,
  validateQuickPhraseConfig
} from '../quickPhrases.js';

test('quick phrase config normalizes ids, content, keywords and enabled flag', () => {
  const config = normalizeQuickPhraseConfig({
    phrases: [
      {
        id: ' p1 ',
        title: '  greeting  ',
        content: '  Hello, we received your issue.  ',
        keywords: [' hello ', 'issue', 'hello'],
        enabled: undefined
      },
      {
        title: '',
        content: null,
        keywords: 'single keyword',
        enabled: false
      }
    ]
  });

  assert.deepEqual(config.phrases, [
    {
      id: 'p1',
      title: 'greeting',
      content: 'Hello, we received your issue.',
      keywords: ['hello', 'issue'],
      enabled: true
    },
    {
      id: 'phrase_2',
      title: '',
      content: '',
      keywords: ['single keyword'],
      enabled: false
    }
  ]);
});

test('quick phrase validation requires title and content and rejects duplicates', () => {
  const result = validateQuickPhraseConfig({
    phrases: [
      { id: 'p1', title: '', content: 'content' },
      { id: 'p2', title: 'Same', content: '' },
      { id: 'p3', title: 'Same', content: 'content' }
    ]
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    { path: ['phrases', 0, 'title'], message: '请输入话术标题' },
    { path: ['phrases', 1, 'content'], message: '请输入话术内容' },
    { path: ['phrases', 2, 'title'], message: '话术标题已存在' }
  ]);
});

test('quick phrase filtering searches enabled title, keywords and content case-insensitively', () => {
  const phrases = [
    { id: 'p1', title: 'Need Screenshot', content: 'Please provide a screenshot.', keywords: ['capture'], enabled: true },
    { id: 'p2', title: 'Closed', content: 'Disabled phrase', keywords: ['hidden'], enabled: false },
    { id: 'p3', title: 'Permission', content: 'We have granted readonly access.', keywords: ['AUTH'], enabled: true }
  ];

  assert.deepEqual(filterQuickPhrases(phrases, 'auth').map((item) => item.id), ['p3']);
  assert.deepEqual(filterQuickPhrases(phrases, 'screen').map((item) => item.id), ['p1']);
  assert.deepEqual(filterQuickPhrases(phrases, '').map((item) => item.id), ['p1', 'p3']);
});

test('slash insertion replaces the slash query and keeps surrounding text', () => {
  assert.equal(
    insertPhraseForSlashQuery('Before /scr', 'Please provide a screenshot.', 11),
    'Before Please provide a screenshot.'
  );
  assert.equal(
    insertPhraseForSlashQuery('Before /scr after', 'Please provide a screenshot.', 11),
    'Before Please provide a screenshot. after'
  );
});

test('slash query is detected only when cursor is after an active slash token', () => {
  assert.equal(getSlashQuery('Before /scr', 11), 'scr');
  assert.equal(getSlashQuery('/权限', 3), '权限');
  assert.equal(getSlashQuery('Before /scr after', 17), null);
  assert.equal(getSlashQuery('No slash', 8), null);
});
