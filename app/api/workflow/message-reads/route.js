import { NextResponse } from 'next/server.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import { getMessageReadsForUser, markMessageRead } from '../../../../src/server/store.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '閺堫亞娅ヨぐ?' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    messageReads: getMessageReadsForUser(user.id)
  });
}

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '鏈櫥褰?' }, { status: 401 });
  }

  const { ticketId, readAt } = await request.json();
  if (!ticketId) {
    return NextResponse.json({ ok: false, reason: '缂哄皯宸ュ崟缂栧彿' }, { status: 400 });
  }

  markMessageRead(user.id, ticketId, readAt);
  return NextResponse.json({ ok: true });
}
