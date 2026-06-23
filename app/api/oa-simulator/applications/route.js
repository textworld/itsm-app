import { NextResponse } from 'next/server.js';
import { requireAdminUser } from '../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import { listOaApplications } from '../../../../src/server/store.js';

function authorize(request) {
  return requireAdminUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

export async function GET(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  return NextResponse.json({
    ok: true,
    applications: listOaApplications()
  });
}
