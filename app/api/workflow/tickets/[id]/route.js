import { NextResponse } from 'next/server.js';
import { getSessionUserFromRequest } from '../../../../../src/server/session.js';
import { getTicketById } from '../../../../../src/server/store.js';

export async function GET(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '鏈櫥褰?' }, { status: 401 });
  }

  const resolvedParams = await params;
  const ticket = getTicketById(resolvedParams.id);
  if (!ticket) {
    return NextResponse.json({ ok: false, reason: '宸ュ崟涓嶅瓨鍦?' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ticket });
}
