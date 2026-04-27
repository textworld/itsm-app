import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEmptyRichTextDoc,
  richTextDocHasContent,
  richTextDocToHtml,
  richTextDocToPlainText,
  richTextHtmlToDoc
} from '../richText.js';

test('空文档不应被识别为有内容', () => {
  assert.equal(richTextDocHasContent(createEmptyRichTextDoc()), false);
});

test('JSON 文档可提取纯文本', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '你好，世界' }]
      }
    ]
  };

  assert.equal(richTextDocToPlainText(doc), '你好，世界');
});

test('JSON 文档可转为 HTML', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '转换测试' }]
      }
    ]
  };

  assert.match(richTextDocToHtml(doc), /转换测试/);
});

test('HTML 可转换为包含图片节点的文档', () => {
  const doc = richTextHtmlToDoc('<p>说明</p><img src="/api/uploads/upl_1" alt="截图" />');

  assert.equal(doc.type, 'doc');
  assert.equal(doc.content[0].type, 'paragraph');
  assert.equal(doc.content[1].type, 'image');
  assert.equal(doc.content[1].attrs.src, '/api/uploads/upl_1');
});

