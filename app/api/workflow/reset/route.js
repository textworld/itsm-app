import { NextResponse } from 'next/server.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import { resetDatabase } from '../../../../src/server/store.js';
import { clearUploadStorage } from '../../../../src/server/uploads.js';

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '鏈櫥褰?' }, { status: 401 });
  }

  resetDatabase();
  clearUploadStorage();
  return NextResponse.json({ ok: true });
}
