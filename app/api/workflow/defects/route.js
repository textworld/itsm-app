import { NextResponse } from 'next/server.js';
import { createDefect, listDefects } from '../../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '鏈櫥褰?' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, defects: listDefects() });
}

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '鏈櫥褰?' }, { status: 401 });
  }

  const { defect } = await request.json();
  if (!defect?.defectId) {
    return NextResponse.json({ ok: false, reason: '缂洪櫡鏁版嵁涓嶅畬鏁?' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, defect: createDefect(defect) });
}
