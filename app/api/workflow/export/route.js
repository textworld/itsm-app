import { exportTicketsJson, makeExportFilename } from '../../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

export async function GET(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, reason: '鏈櫥褰?' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const filename = makeExportFilename();
  return new Response(exportTicketsJson(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
