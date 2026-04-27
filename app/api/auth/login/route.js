import { NextResponse } from 'next/server';
import { createSessionCookie } from '../../../../src/server/session.js';
import { findUserByCredentials } from '../../../../src/server/store.js';

export async function POST(request) {
  const { username = '', password = '', role = '' } = await request.json();
  const user = findUserByCredentials(username.trim(), password, role);

  if (!user) {
    return NextResponse.json(
      { ok: false, reason: '账号、密码或角色不匹配' },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true, user });
  createSessionCookie(response, user.id);
  return response;
}
