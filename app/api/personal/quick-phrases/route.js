import { NextResponse } from 'next/server.js';
import {
  getPersonalQuickPhrasesConfig,
  savePersonalQuickPhrasesConfig
} from '../../../../src/server/adminConfigStore.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import { ROLES } from '../../../../src/constants/roles.js';

function authorize(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return { ok: false, status: 401, reason: '未登录' };
  }
  if (user.role !== ROLES.L1 && user.role !== ROLES.L2) {
    return { ok: false, status: 403, reason: '仅技术支持可维护个人常用话术' };
  }
  return { ok: true, user };
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

export async function GET(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  return NextResponse.json({
    ok: true,
    config: getPersonalQuickPhrasesConfig(auth.user.id)
  });
}

export async function PUT(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const input = await request.json();
  const result = savePersonalQuickPhrasesConfig(auth.user.id, input, auth.user);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
