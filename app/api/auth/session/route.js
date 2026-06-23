import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  return NextResponse.json({ ok: true, user });
}
