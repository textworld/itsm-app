import { NextResponse } from 'next/server.js';
import {
  createAnnouncementConfig,
  getAnnouncementConfig,
  listAnnouncementOptions,
  listFilteredAnnouncements
} from '../../../../src/server/adminConfigStore.js';
import { requireAdminUser } from '../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';
import {
  malformedJsonResponse,
  mutationResponse,
  readRequiredJson
} from './routeHelpers.js';

function authorize(request) {
  return requireAdminUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

function filtersFromRequest(request) {
  const searchParams = new URL(request.url).searchParams;
  return {
    keyword: searchParams.get('keyword') || '',
    status: searchParams.get('status') || '',
    systemCode: searchParams.get('systemCode') || '',
    publishedFrom: searchParams.get('publishedFrom') || '',
    publishedTo: searchParams.get('publishedTo') || ''
  };
}

export async function GET(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const options = listAnnouncementOptions();
  const config = getAnnouncementConfig();

  return NextResponse.json({
    ok: true,
    config,
    announcements: listFilteredAnnouncements(filtersFromRequest(request)),
    ...options
  });
}

export async function POST(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const body = await readRequiredJson(request);
  if (!body.ok) return malformedJsonResponse(body.reason);
  const input = body.value;
  const result = createAnnouncementConfig(input, auth.user);
  return mutationResponse(result);
}
