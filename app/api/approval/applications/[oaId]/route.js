import { NextResponse } from 'next/server.js';
import { requireAdminUser } from '../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../src/server/session.js';
import { getTicketByOaId } from '../../../../../src/server/store.js';

export async function GET(request, { params }) {
  const auth = requireAdminUser(getSessionUserFromRequest(request));
  if (!auth.ok) {
    return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
  }

  const resolvedParams = await params;
  const ticket = getTicketByOaId(resolvedParams.oaId);
  if (!ticket) {
    return NextResponse.json({ ok: false, reason: 'OA申请单不存在' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    application: {
      ...(ticket.oaApplication || {}),
      ticketId: ticket.id,
      title: ticket.title,
      toolType: ticket.toolType,
      requesterName: ticket.requesterName,
      ticketStatus: ticket.status,
      oaStatus: ticket.oaApplication?.status,
      formalTicketCreated: ticket.formalTicketCreated === true,
      oaLocked: ticket.oaLocked === true
    },
    ticket
  });
}
