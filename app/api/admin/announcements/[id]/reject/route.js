import { NextResponse } from 'next/server.js';
import { rejectAnnouncementConfig } from '../../../../../../src/server/adminConfigStore.js';
import { requireAdminUser } from '../../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';
import {
  malformedJsonResponse,
  mutationResponse,
  readOptionalJson
} from '../../routeHelpers.js';

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
  const body = await readOptionalJson(request);
  if (!body.ok) return malformedJsonResponse(body.reason);
  const input = body.value;
  const result = rejectAnnouncementConfig(id, auth.user, input.opinion);
  return mutationResponse(result);
}
