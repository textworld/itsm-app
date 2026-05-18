import { NextResponse } from 'next/server.js';
import { requireAdminUser } from '../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import { createUserAccount, listUsers, updateUserAvailability } from '../../../../src/server/store.js';

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
    users: listUsers()
  });
}

export async function POST(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const input = await request.json();
  const result = createUserAccount(input, { allowAdmin: true });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function PATCH(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const input = await request.json();
  const result = updateUserAvailability(input.userId, input.availabilityStatus);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
