import { NextResponse } from 'next/server.js';
import {
  getTicketClassificationDictionaryName,
  listEnabledDictionaryOptions
} from '../../../../src/server/adminConfigStore.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const dictionaryType = String(new URL(request.url).searchParams.get('type') || '').trim().toUpperCase();
  if (!dictionaryType) {
    return NextResponse.json({ ok: false, reason: '字典类型不能为空' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    dictionary: {
      type: dictionaryType,
      name: getTicketClassificationDictionaryName(dictionaryType)
    },
    options: listEnabledDictionaryOptions(dictionaryType)
  });
}
