import { NextResponse } from 'next/server.js';
import { approveAnnouncementConfig } from '../../../../../../src/server/adminConfigStore.js';
import { requireAdminUser } from '../../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';

function authorize(request) {
  return requireAdminUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

export async function POST(request, { params }) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const { id } = await params;
  const input = await request.json();
  const result = approveAnnouncementConfig(id, auth.user, input.opinion);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
