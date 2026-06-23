import { NextResponse } from 'next/server.js';
import { EVENTS } from '../../../../../../src/state-machine/ticketStateMachine.js';
import { requireAdminUser } from '../../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';
import { dispatchTicketEvent, getTicketByOaId } from '../../../../../../src/server/store.js';

const ACTION_EVENT_MAP = {
  GENERATE_TICKET: EVENTS.OA_ITSM_GENERATE_TICKET,
  DIRECT_CLOSE: EVENTS.OA_DIRECT_CLOSE,
  REQUESTER_CLOSE: EVENTS.OA_DIRECT_CLOSE,
  REJECT: EVENTS.OA_REJECT,
  REOPEN: EVENTS.OA_REOPEN,
  REAPPROVE_GENERATE: EVENTS.OA_REAPPROVE_GENERATE,
  REAPPROVE_CLOSE: EVENTS.OA_REAPPROVE_CLOSE
};

export async function POST(request, { params }) {
  const auth = requireAdminUser(getSessionUserFromRequest(request));
  if (!auth.ok) {
    return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
  }

  const resolvedParams = await params;
  const ticket = getTicketByOaId(resolvedParams.oaId);
  if (!ticket) {
    return NextResponse.json({ ok: false, reason: 'OA申请单不存在' }, { status: 404 });
  }

  const input = await request.json();
  const event = ACTION_EVENT_MAP[input.action];
  if (!event) {
    return NextResponse.json({ ok: false, reason: '不支持的OA操作' }, { status: 400 });
  }

  const result = dispatchTicketEvent(
    ticket.id,
    event,
    {
      action: input.action,
      opinion: input.opinion || '',
      attachments: input.attachments || [],
      operatorName: input.operatorName || auth.user.name,
      handledAt: input.handledAt || new Date().toISOString(),
      __timelineRemark: input.opinion || input.action
    },
    auth.user
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
