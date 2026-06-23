import { NextResponse } from 'next/server.js';
import { addMessageToTicket } from '../../../../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';

export async function POST(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '鏈櫥褰?' }, { status: 401 });
  }

  const { message } = await request.json();
  if (!message?.id) {
    return NextResponse.json({ ok: false, reason: '鐣欒█鍐呭涓嶅畬鏁?' }, { status: 400 });
  }

  const ticket = addMessageToTicket(params.id, {
    ...message,
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role
  });

  if (!ticket) {
    return NextResponse.json({ ok: false, reason: '宸ュ崟涓嶅瓨鍦?' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ticket });
}
