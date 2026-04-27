import { NextResponse } from 'next/server';
import { EVENTS } from '../../../src/state-machine/ticketStateMachine.js';
import { dispatchCreateTicketEvent } from '../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../src/server/session.js';

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const { ticket, event = EVENTS.SUBMIT } = await request.json();
  if (!ticket || typeof ticket !== 'object') {
    return NextResponse.json({ ok: false, reason: '工单数据不完整' }, { status: 400 });
  }

  const result = dispatchCreateTicketEvent(event, ticket, user);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
