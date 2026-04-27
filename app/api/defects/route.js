import { NextResponse } from 'next/server';
import { createDefect } from '../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../src/server/session.js';

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const { defect } = await request.json();
  if (!defect?.defectId) {
    return NextResponse.json({ ok: false, reason: '缺陷数据不完整' }, { status: 400 });
  }

  const savedDefect = createDefect(defect);
  return NextResponse.json({ ok: true, defect: savedDefect });
}
