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
