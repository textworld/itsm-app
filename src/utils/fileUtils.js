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

export const EXCEL_ATTACHMENT_TYPES = ['.xls', '.xlsx'].join(',');

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

const EXCEL_ATTACHMENT_EXTENSIONS = ['.xls', '.xlsx'];

const EXCEL_ATTACHMENT_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
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

export function isExcelAttachment(file) {
  if (!file) return false;
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  return (
    EXCEL_ATTACHMENT_EXTENSIONS.some((extension) => name.endsWith(extension)) ||
    EXCEL_ATTACHMENT_MIME_TYPES.includes(type)
  );
}

export async function buildAttachments(fileList, uploader) {
  if (!fileList || !fileList.length) return [];

  const results = [];

  for (const fileItem of fileList) {
    if (fileItem?.attachmentData && !fileItem.originFileObj) {
      results.push(fileItem.attachmentData);
      continue;
    }

    if (fileItem?.attachmentData?.uploadId) {
      results.push(fileItem.attachmentData);
      continue;
    }

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

export function mapAttachmentsToUploadFileList(attachments = []) {
  return attachments.map((attachment) => ({
    uid: attachment.id || attachment.uploadId,
    name: attachment.name,
    status: 'done',
    type: attachment.type,
    size: attachment.size,
    url: attachment.url || attachment.base64,
    thumbUrl: attachment.url || attachment.base64,
    base64: attachment.base64,
    attachmentData: attachment
  }));
}

export function normalizeUploadedAttachment(file, uploader) {
  return {
    id: file.uploadId,
    uploadId: file.uploadId,
    name: file.name,
    type: file.type || '',
    size: file.size || 0,
    url: file.url,
    uploadedAt: file.uploadedAt || new Date().toISOString(),
    uploader: file.uploader || uploader?.name || uploader?.id || ''
  };
}

export async function uploadAttachmentFile(file, uploader) {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: form
  });
  const payload = await response.json();

  if (!response.ok || !payload?.ok || !payload?.file) {
    throw new Error(payload?.reason || '文件上传失败');
  }

  return normalizeUploadedAttachment(payload.file, uploader);
}
