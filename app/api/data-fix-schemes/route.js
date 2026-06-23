import { NextResponse } from 'next/server.js';
import { listDataFixSchemeCompatibleSolutions } from '../../../src/server/solutionLibraryStore.js';
import { getSessionUserFromRequest } from '../../../src/server/session.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  return NextResponse.json(listDataFixSchemeCompatibleSolutions(user));
}
