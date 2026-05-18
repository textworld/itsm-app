import { NextResponse } from 'next/server.js';
import {
  getSupportRestConfig,
  listL1Users,
  saveSupportRestConfig
} from '../../../../src/server/adminConfigStore.js';
import { requireAdminUser } from '../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import { buildUpcomingSupportRestDays } from '../../../../src/utils/adminConfigValidation.js';

function authorize(request) {
  return requireAdminUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

export async function GET(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const config = getSupportRestConfig();
  const users = listL1Users();

  return NextResponse.json({
    ok: true,
    config,
    users,
    upcoming: {
      days: buildUpcomingSupportRestDays(config, users)
    }
  });
}

export async function PUT(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const input = await request.json();
  const result = saveSupportRestConfig(input, auth.user);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
