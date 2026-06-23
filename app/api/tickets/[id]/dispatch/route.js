import { NextResponse } from 'next/server.js';
import { dispatchTicketEvent } from '../../../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../../../src/server/session.js';

export async function POST(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const resolvedParams = await params;
  const { event, payload = {} } = await request.json();
  const result = dispatchTicketEvent(resolvedParams.id, event, payload, user);
  const status = result.ok ? 200 : result.reason === '工单不存在' ? 404 : 400;
  return NextResponse.json(result, { status });
}
