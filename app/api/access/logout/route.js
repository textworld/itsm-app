import { NextResponse } from 'next/server.js';
import { clearSessionCookie } from '../../../../src/server/session.js';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
