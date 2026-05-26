import { NextResponse } from 'next/server.js';
import { updateTicketCustomTags } from '../../../../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';

export async function POST(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const resolvedParams = await params;
  const { tags = [] } = await request.json();
  const result = updateTicketCustomTags(resolvedParams.id, tags, user);
  const status = result.ok ? 200 : isMissingTicketError(result.reason) ? 404 : 400;
  return NextResponse.json(result, { status });
}

function isMissingTicketError(reason) {
  return String(reason || '').includes('工单不存在') || String(reason || '').includes('宸ュ崟涓嶅瓨鍦');
}
