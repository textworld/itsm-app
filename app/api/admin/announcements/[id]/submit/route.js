import { NextResponse } from 'next/server.js';
import { submitAnnouncementConfig } from '../../../../../../src/server/adminConfigStore.js';
import { requireAnnouncementManagerUser } from '../../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';
import { mutationResponse } from '../../routeHelpers.js';

function authorize(request) {
  return requireAnnouncementManagerUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

export async function POST(request, { params }) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const { id } = await params;
  const result = submitAnnouncementConfig(id, auth.user);
  return mutationResponse(result);
}
