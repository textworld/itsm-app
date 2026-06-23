import { NextResponse } from 'next/server.js';
import {
  setInsuranceTypeEnabled,
  updateInsuranceType
} from '../../../../../../src/server/adminConfigStore.js';
import { requireAdminUser } from '../../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';

function authorize(request) {
  return requireAdminUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

export async function PATCH(request, { params }) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const { id } = await params;
  const input = await request.json();
  const onlyToggleEnabled =
    Object.hasOwn(input, 'enabled') &&
    !Object.hasOwn(input, 'code') &&
    !Object.hasOwn(input, 'name');
  const result = onlyToggleEnabled
    ? setInsuranceTypeEnabled(id, input.enabled, auth.user)
    : updateInsuranceType(id, input, auth.user);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
