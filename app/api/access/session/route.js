import { NextResponse } from 'next/server.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  return NextResponse.json({ ok: true, user });
}
