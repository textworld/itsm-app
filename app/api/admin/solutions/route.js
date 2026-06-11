import { NextResponse } from 'next/server.js';
import { createSolution, listSolutions } from '../../../../src/server/solutionLibraryStore.js';
import { requireAdminUser } from '../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

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
    solutions: listSolutions(),
    replacementFor: 'data-fix-schemes'
  });
}

export async function POST(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const input = await request.json();
  const result = createSolution(input, auth.user);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
