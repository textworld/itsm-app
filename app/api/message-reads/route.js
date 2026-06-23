import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '../../../src/server/session.js';
import { markMessageRead } from '../../../src/server/store.js';

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const { ticketId, readAt } = await request.json();
  if (!ticketId) {
    return NextResponse.json({ ok: false, reason: '缺少工单编号' }, { status: 400 });
  }

  markMessageRead(user.id, ticketId, readAt);
  return NextResponse.json({ ok: true });
}
