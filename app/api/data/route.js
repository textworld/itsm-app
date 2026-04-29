import { NextResponse } from 'next/server';
import { getMessageReadsForUser, listDefects, listTickets } from '../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../src/server/session.js';
import { getVisibleTicketsForUser } from '../../../src/utils/ticketListView.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, reason: '未登录' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    tickets: getVisibleTicketsForUser(listTickets(), user),
    defects: listDefects(),
    messageReads: getMessageReadsForUser(user.id)
  });
}
