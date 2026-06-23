import { NextResponse } from 'next/server.js';
import { getSlaConfig, saveSlaConfig } from '../../../../src/server/adminConfigStore.js';
import { requireAdminUser } from '../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import { SLA_CHANNELS, SLA_PRIORITIES } from '../../../../src/utils/slaConfig.js';
import { TOOL_TYPE_LABELS } from '../../../../src/constants/toolTypes.js';

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
    config: getSlaConfig(),
    channels: SLA_CHANNELS.map((value) => ({ value, label: TOOL_TYPE_LABELS[value] || value })),
    priorities: SLA_PRIORITIES.map((value) => ({ value, label: formatSlaPriority(value) }))
  });
}

export async function PUT(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const input = await request.json();
  const result = saveSlaConfig(input, auth.user);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

function formatSlaPriority(priority) {
  const labels = {
    P0: 'P0-紧急',
    P1: 'P1-高',
    P2: 'P2-中',
    P3: 'P3-低'
  };
  return labels[priority] || priority;
}
