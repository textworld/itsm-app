import { NextResponse } from 'next/server.js';
import { deleteSolution, getSolutionDetail, updateSolution } from '../../../../../src/server/solutionLibraryStore.js';
import { requireAdminUser } from '../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../src/server/session.js';

function authorize(request) {
  return requireAdminUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

export async function PUT(request, context) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const { id } = await context.params;
  const input = await request.json();
  const result = updateSolution(id, input, auth.user);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function GET(request, context) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const { id } = await context.params;
  const result = getSolutionDetail(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}

export async function DELETE(request, context) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const { id } = await context.params;
  const result = deleteSolution(id, auth.user);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
