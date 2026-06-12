import { NextResponse } from 'next/server.js';
import { listSolutionReferencesPage } from '../../../../../../src/server/solutionLibraryStore.js';
import { requireAdminUser } from '../../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';

function authorize(request) {
  return requireAdminUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

export async function GET(request, context) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const { id } = await context.params;
  const url = new URL(request.url);
  const result = listSolutionReferencesPage(id, {
    keyword: url.searchParams.get('keyword') || '',
    page: url.searchParams.get('page') || 1,
    pageSize: url.searchParams.get('pageSize') || 10
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
