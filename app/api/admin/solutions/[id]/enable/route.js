import { NextResponse } from 'next/server.js';
import { setSolutionEnabled } from '../../../../../../src/server/solutionLibraryStore.js';
import { requireAdminUser } from '../../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';

function authorize(request) {
  return requireAdminUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

export async function POST(request, context) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const { id } = await context.params;
  const input = await request.json();
  const result = setSolutionEnabled(id, input.enabled === true, auth.user);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
