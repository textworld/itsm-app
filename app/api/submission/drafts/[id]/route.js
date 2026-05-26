import { NextResponse } from 'next/server.js';
import { EVENTS } from '../../../../../src/state-machine/ticketStateMachine.js';
import { dispatchTicketEvent, getTicketById } from '../../../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../../../src/server/session.js';

export async function PATCH(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const resolvedParams = await params;
  const ticket = getTicketById(resolvedParams.id);
  if (!ticket) {
    return NextResponse.json({ ok: false, reason: '工单不存在' }, { status: 404 });
  }

  const { values = {}, attachments = [] } = await request.json();
  const result = dispatchTicketEvent(
    resolvedParams.id,
    EVENTS.UPDATE_DRAFT,
    { values, attachments },
    user
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
