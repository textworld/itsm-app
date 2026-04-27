import { NextResponse } from 'next/server.js';

import { getSessionUserFromRequest } from '../../../src/server/session.js';
import { saveUpload } from '../../../src/server/uploads.js';
import { isAllowedAttachment } from '../../../src/utils/fileUtils.js';

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, reason: '请选择文件' }, { status: 400 });
  }

  if (!isAllowedAttachment(file)) {
    return NextResponse.json({ ok: false, reason: '不支持的文件类型' }, { status: 400 });
  }

  const uploaded = saveUpload({
    fileName: file.name,
    mimeType: file.type,
    bytes: Buffer.from(await file.arrayBuffer()),
    uploader: user
  });

  return NextResponse.json({
    ok: true,
    file: uploaded
  });
}
