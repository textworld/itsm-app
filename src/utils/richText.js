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

const DANGEROUS_RICH_TEXT_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'meta',
  'link',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'svg',
  'math'
];

const SAFE_RICH_TEXT_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'code',
  'hr',
  'span'
]);

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

  return sanitizeRichTextHtml(generateHTML(doc, RICH_TEXT_EXTENSIONS));
}

export function richTextHtmlToDoc(html) {
  const sanitized = sanitizeRichTextHtml(html);
  if (!sanitized.trim()) {
    return createEmptyRichTextDoc();
  }

  try {
    return generateJSON(sanitized, RICH_TEXT_EXTENSIONS);
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

  return sanitizeRichTextHtml(value);
}

export function richTextHasContent(value) {
  if (isRichTextDocument(value)) {
    return richTextDocHasContent(value);
  }

  const sanitized = sanitizeRichTextHtml(value);
  if (typeof document === 'undefined') {
    return Boolean(stripHtmlTags(sanitized) || containsImageTag(sanitized));
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = sanitized;
  return Boolean(wrapper.textContent.trim() || wrapper.querySelector('img'));
}

export function richTextToPlainText(value) {
  if (isRichTextDocument(value)) {
    return richTextDocToPlainText(value);
  }

  const sanitized = sanitizeRichTextHtml(value);
  if (typeof document === 'undefined') {
    return stripHtmlTags(sanitized);
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = sanitized;
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

function sanitizeRichTextHtml(html) {
  let sanitized = String(html || '');
  if (!sanitized) return '';

  const dangerousTags = DANGEROUS_RICH_TEXT_TAGS.join('|');
  sanitized = sanitized
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(new RegExp(`<\\s*(${dangerousTags})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, 'gi'), '')
    .replace(new RegExp(`<\\s*\\/?\\s*(${dangerousTags})\\b[^>]*\\/?>`, 'gi'), '')
    .replace(/\s+on[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, sanitizeUrlAttribute)
    .replace(/\s+style\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, sanitizeStyleAttribute)
    .replace(/<\/?([a-z][\w:-]*)(\s[^>]*)?>/gi, sanitizeTag);

  return sanitized;
}

function sanitizeTag(match, tagName) {
  return SAFE_RICH_TEXT_TAGS.has(String(tagName || '').toLowerCase()) ? match : '';
}

function sanitizeUrlAttribute(match, attrName, doubleQuoted, singleQuoted, unquoted) {
  const value = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
  return isSafeRichTextUrl(value, attrName) ? match : '';
}

function sanitizeStyleAttribute(match, doubleQuoted, singleQuoted, unquoted) {
  const value = decodeHtmlEntities(doubleQuoted ?? singleQuoted ?? unquoted ?? '');
  if (/(?:expression|javascript\s*:|vbscript\s*:|@import|-moz-binding|behavior\s*:)/i.test(value)) {
    return '';
  }

  return match;
}

function isSafeRichTextUrl(value, attrName) {
  const decoded = decodeHtmlEntities(value).replace(/[\u0000-\u001F\u007F\s]+/g, '');
  if (!decoded || decoded.startsWith('#') || decoded.startsWith('/') || decoded.startsWith('./') || decoded.startsWith('../')) {
    return true;
  }

  const lower = decoded.toLowerCase();
  if (attrName.toLowerCase() === 'src' && lower.startsWith('data:image/')) {
    return true;
  }

  return /^(https?:|mailto:|tel:)/i.test(lower);
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);?/g, (_match, code) => decodeCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);?/gi, (_match, code) => decodeCodePoint(Number.parseInt(code, 16)))
    .replace(/&colon;?/gi, ':')
    .replace(/&NewLine;?/gi, '\n')
    .replace(/&Tab;?/gi, '\t')
    .replace(/&amp;?/gi, '&');
}

function decodeCodePoint(value) {
  if (!Number.isFinite(value) || value < 0 || value > 0x10FFFF) {
    return '';
  }

  return String.fromCodePoint(value);
}

function normalizeImageWidthPercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value).replace('%', ''), 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(20, parsed));
}
