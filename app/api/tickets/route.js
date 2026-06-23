import { NextResponse } from 'next/server.js';
import { EVENTS } from '../../../src/state-machine/ticketStateMachine.js';
import { dispatchCreateTicketEvent } from '../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../src/server/session.js';
import { TOOL_TYPES } from '../../../src/constants/toolTypes.js';

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const { ticket, event = EVENTS.SUBMIT } = await request.json();
  if (!ticket || typeof ticket !== 'object') {
    return NextResponse.json({ ok: false, reason: '工单数据不完整' }, { status: 400 });
  }

  const result = dispatchCreateTicketEvent(resolveCreateEvent(ticket, event), ticket, user);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}

function resolveCreateEvent(ticket, event) {
  if (event !== EVENTS.SUBMIT) {
    return event;
  }

  if (ticket.toolType === TOOL_TYPES.DATA_EXTRACT || ticket.toolType === TOOL_TYPES.PERMISSION) {
    return EVENTS.SUBMIT_TO_OA;
  }

  if (ticket.toolType === TOOL_TYPES.DATA_FIX && hasDataFixSubmissionSolution(ticket)) {
    return EVENTS.SUBMIT_DATA_FIX_SCHEME_REVIEW;
  }

  return EVENTS.SUBMIT;
}

function hasDataFixSubmissionSolution(ticket = {}) {
  const solution = ticket.dataFixSolution || {};
  return Boolean(
    String(solution.requesterSolution || ticket.requesterSolution || '').trim() ||
      String(solution.relatedTicketId || ticket.relatedTicketId || '').trim()
  );
}
