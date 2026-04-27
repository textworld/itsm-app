import fs from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server.js';

import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import { getUploadById, uploadsDir } from '../../../../src/server/uploads.js';

export async function GET(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const upload = getUploadById(params.id);
  if (!upload) {
    return NextResponse.json({ ok: false, reason: '文件不存在' }, { status: 404 });
  }

  const filePath = path.join(uploadsDir, upload.storedName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ ok: false, reason: '文件不存在' }, { status: 404 });
  }

  return new NextResponse(fs.readFileSync(filePath), {
    status: 200,
    headers: {
      'Content-Type': upload.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(upload.originalName)}`
    }
  });
}
