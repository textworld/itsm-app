import { generateHTML, generateJSON } from '@tiptap/html';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';

const RichTextImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      uploadId: {
        default: null
      },
      widthPercent: {
        default: null,
        parseHTML: (element) =>
          normalizeImageWidthPercent(
            element.getAttribute('data-width-percent') || element.style?.width
          ),
        renderHTML: (attributes) => {
          const widthPercent = normalizeImageWidthPercent(attributes.widthPercent);
          if (!widthPercent) return {};

          return {
            'data-width-percent': String(widthPercent),
            style: `width: ${widthPercent}%; max-width: 100%; height: auto;`
          };
        }
      }
    };
  }
});

export const RICH_TEXT_EXTENSIONS = [
  StarterKit.configure({
    link: false,
    underline: false
  }),
  Underline,
  Link.configure({
    openOnClick: false
  }),
  RichTextImage
];

export function createEmptyRichTextDoc() {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }]
  };
}

export function isRichTextDocument(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.type === 'doc'
  );
}

export function richTextDocHasContent(doc) {
  if (!isRichTextDocument(doc)) {
    return false;
  }

  return Boolean(richTextDocToPlainText(doc) || containsImageNode(doc));
}

export function richTextDocToPlainText(doc) {
  if (!isRichTextDocument(doc)) {
    return '';
  }

  return collectText(doc).replace(/\s+/g, ' ').trim();
}

export function richTextDocToHtml(doc) {
  if (!richTextDocHasContent(doc)) {
    return '';
  }

  return generateHTML(doc, RICH_TEXT_EXTENSIONS);
}

export function richTextHtmlToDoc(html) {
  if (!String(html || '').trim()) {
    return createEmptyRichTextDoc();
  }

  try {
    return generateJSON(html, RICH_TEXT_EXTENSIONS);
  } catch (error) {
    console.error(error);
    return createEmptyRichTextDoc();
  }
}

export function richTextPlainTextToDoc(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n');

  const content = lines.length > 0
    ? lines.map((line) => {
        const paragraph = { type: 'paragraph' };
        if (line) {
          paragraph.content = [{ type: 'text', text: line }];
        }
        return paragraph;
      })
    : [{ type: 'paragraph' }];

  return {
    type: 'doc',
    content
  };
}

export function richTextValueToDoc(value) {
  if (isRichTextDocument(value)) {
    return value;
  }

  return richTextHtmlToDoc(value);
}

export function richTextValueToHtml(value) {
  if (isRichTextDocument(value)) {
    return richTextDocToHtml(value);
  }

  return String(value || '');
}

export function richTextHasContent(value) {
  if (isRichTextDocument(value)) {
    return richTextDocHasContent(value);
  }

  if (typeof document === 'undefined') {
    return Boolean(stripHtmlTags(value) || containsImageTag(value));
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = value || '';
  return Boolean(wrapper.textContent.trim() || wrapper.querySelector('img'));
}

export function richTextToPlainText(value) {
  if (isRichTextDocument(value)) {
    return richTextDocToPlainText(value);
  }

  if (typeof document === 'undefined') {
    return stripHtmlTags(value);
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = value || '';
  return wrapper.textContent.trim();
}

function collectText(node) {
  if (!node) return '';

  if (node.type === 'text') {
    return node.text || '';
  }

  if (!Array.isArray(node.content)) {
    return '';
  }

  return node.content
    .map((child) => collectText(child))
    .filter(Boolean)
    .join(' ');
}

function containsImageNode(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }

  if (node.type === 'image') {
    return true;
  }

  if (!Array.isArray(node.content)) {
    return false;
  }

  return node.content.some((child) => containsImageNode(child));
}

function stripHtmlTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsImageTag(html) {
  return /<img\b/i.test(String(html || ''));
}

function normalizeImageWidthPercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value).replace('%', ''), 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(20, parsed));
}
