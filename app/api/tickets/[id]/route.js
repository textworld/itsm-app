import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

export async function PATCH(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }
  return NextResponse.json(
    {
      ok: false,
      reason: `工单 ${params.id} 的修改必须通过状态机事件接口处理`
    },
    { status: 405 }
  );
}
