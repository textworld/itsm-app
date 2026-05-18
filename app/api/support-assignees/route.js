import { NextResponse } from 'next/server.js';
import { ROLES } from '../../../src/constants/roles.js';
import { getSessionUserFromRequest } from '../../../src/server/session.js';
import { listAssignableSupportUsers } from '../../../src/server/store.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: 'Not logged in' }, { status: 401 });
  }

  const url = new URL(request.url || 'http://localhost/api/support-assignees');
  const role = url.searchParams.get('role');
  const normalizedRole = [ROLES.L1, ROLES.L2].includes(role) ? role : null;

  return NextResponse.json({
    ok: true,
    users: listAssignableSupportUsers(normalizedRole)
  });
}
