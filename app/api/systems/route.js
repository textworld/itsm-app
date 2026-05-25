import { NextResponse } from 'next/server.js';
import {
  getSystemConfig,
  getTicketClassificationDictionaryName
} from '../../../src/server/adminConfigStore.js';
import { getSessionUserFromRequest } from '../../../src/server/session.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    systems: getSystemConfig({ visibleOnly: true }).systems.map((system) => ({
      ...system,
      ...(system.ticketClassification
        ? {
            ticketClassification: {
              ...system.ticketClassification,
              dictionaryName: getTicketClassificationDictionaryName(system.ticketClassification.dictionaryType)
            }
          }
        : {})
    }))
  });
}
