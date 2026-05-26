import { NextResponse } from 'next/server.js';
import { requireAdminUser } from '../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import { listOaApplications } from '../../../../src/server/store.js';

export async function GET(request) {
  const auth = requireAdminUser(getSessionUserFromRequest(request));
  if (!auth.ok) {
    return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
  }

  return NextResponse.json({
    ok: true,
    applications: listOaApplications()
  });
}
