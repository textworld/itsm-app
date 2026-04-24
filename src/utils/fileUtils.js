import { shortId } from './idGenerator.js';

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ACCEPTED_ATTACHMENT_TYPES = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.csv',
  '.txt',
  '.zip',
  'image/*'
].join(',');

const ALLOWED_ATTACHMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.csv',
  '.txt',
  '.zip'
];

const ALLOWED_ATTACHMENT_MIME_PREFIXES = ['image/'];

const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed'
];

export function isAllowedAttachment(file) {
  if (!file) return false;
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  return (
    ALLOWED_ATTACHMENT_EXTENSIONS.some((extension) => name.endsWith(extension)) ||
    ALLOWED_ATTACHMENT_MIME_TYPES.includes(type) ||
    ALLOWED_ATTACHMENT_MIME_PREFIXES.some((prefix) => type.startsWith(prefix))
  );
}

export async function buildAttachments(fileList, uploader) {
  if (!fileList || !fileList.length) return [];

  const results = [];

  for (const fileItem of fileList) {
    const rawFile = fileItem.originFileObj || fileItem;
    if (!rawFile) continue;

    const base64 = await fileToBase64(rawFile);
    results.push({
      id: shortId('att'),
      name: fileItem.name || rawFile.name,
      type: rawFile.type || '',
      size: rawFile.size || 0,
      base64,
      uploadedAt: new Date().toISOString(),
      uploader: uploader?.name || uploader?.id || ''
    });
  }

  return results;
}
