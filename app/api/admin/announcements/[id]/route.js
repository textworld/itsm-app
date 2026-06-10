import { NextResponse } from 'next/server.js';
import {
  getAnnouncementConfig,
  updateAnnouncementConfig
} from '../../../../../src/server/adminConfigStore.js';
import { requireAdminUser } from '../../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../../src/server/session.js';

function authorize(request) {
  return requireAdminUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

function findAnnouncement(id) {
  return (getAnnouncementConfig().announcements || [])
    .find((announcement) => String(announcement.id) === String(id));
}

export async function GET(request, { params }) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const { id } = await params;
  const announcement = findAnnouncement(id);
  if (!announcement) {
    return NextResponse.json({ ok: false, reason: '公告不存在' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, announcement });
}

export async function PUT(request, { params }) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const { id } = await params;
  const input = await request.json();
  const result = updateAnnouncementConfig(id, input, auth.user);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
