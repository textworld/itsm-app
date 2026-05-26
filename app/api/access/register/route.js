import { NextResponse } from 'next/server.js';
import { createSessionCookie } from '../../../../src/server/session.js';
import { createUserAccount } from '../../../../src/server/store.js';

export async function POST(request) {
  const input = await request.json();
  const result = createUserAccount(input);

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  const response = NextResponse.json(result);
  createSessionCookie(response, result.user.id);
  return response;
}
