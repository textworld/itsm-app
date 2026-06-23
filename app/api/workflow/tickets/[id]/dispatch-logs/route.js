import { NextResponse } from 'next/server.js';
import { requireAdminUser } from '../../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';
import { getTicketById, listTicketDispatchLogs } from '../../../../../../src/server/store.js';

export async function GET(request, { params }) {
  const user = getSessionUserFromRequest(request);
  const auth = requireAdminUser(user);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
  }

  const resolvedParams = await params;
  const ticket = getTicketById(resolvedParams.id);
  if (!ticket) {
    return NextResponse.json({ ok: false, reason: '工单不存在' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    logs: listTicketDispatchLogs(ticket.id)
  });
}
