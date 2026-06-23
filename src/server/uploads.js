import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { getDb } from './db.js';

export const uploadsDir = path.join(process.cwd(), 'data', 'uploads');

export function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export function saveUpload({ fileName, mimeType, bytes, uploader }) {
  ensureUploadsDir();

  const uploadId = `upl_${randomUUID()}`;
  const extension = path.extname(fileName || '');
  const storedName = `${uploadId}${extension}`;
  const fileBuffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const filePath = path.join(uploadsDir, storedName);
  const createdAt = new Date().toISOString();

  fs.writeFileSync(filePath, fileBuffer);

  getDb().prepare(`
    INSERT INTO uploads (
      id,
      stored_name,
      original_name,
      mime_type,
      size,
      created_at,
      uploader_id,
      uploader_name
    ) VALUES (
      @id,
      @stored_name,
      @original_name,
      @mime_type,
      @size,
      @created_at,
      @uploader_id,
      @uploader_name
    )
  `).run({
    id: uploadId,
    stored_name: storedName,
    original_name: fileName || storedName,
    mime_type: mimeType || 'application/octet-stream',
    size: fileBuffer.byteLength,
    created_at: createdAt,
    uploader_id: uploader?.id || '',
    uploader_name: uploader?.name || ''
  });

  return {
    uploadId,
    storedName,
    name: fileName || storedName,
    type: mimeType || 'application/octet-stream',
    size: fileBuffer.byteLength,
    url: `/api/uploads/${uploadId}`,
    uploadedAt: createdAt,
    uploader: uploader?.name || uploader?.id || ''
  };
}

export function getUploadById(uploadId) {
  const row = getDb()
    .prepare(`
      SELECT
        id,
        stored_name,
        original_name,
        mime_type,
        size,
        created_at,
        uploader_id,
        uploader_name
      FROM uploads
      WHERE id = ?
    `)
    .get(uploadId);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    uploadId: row.id,
    storedName: row.stored_name,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
    uploaderId: row.uploader_id,
    uploaderName: row.uploader_name,
    url: `/api/uploads/${row.id}`
  };
}

export function clearUploadStorage() {
  ensureUploadsDir();

  for (const fileName of fs.readdirSync(uploadsDir)) {
    fs.rmSync(path.join(uploadsDir, fileName), { force: true, recursive: true });
  }

  getDb().prepare('DELETE FROM uploads').run();
}
