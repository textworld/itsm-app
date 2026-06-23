import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as applicationsGet } from '../../../app/api/oa-simulator/applications/route.js';
import { POST as applicationActionPost } from '../../../app/api/oa-simulator/applications/[oaId]/actions/route.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { dispatchCreateTicketEvent, getTicketById } from '../store.js';
import { STATUS } from '../../constants/ticketStatus.js';
import { reseedDb } from '../db.js';

const requesterUser = { id: 'u_requester_1', name: '张三', role: 'REQUESTER' };

test.beforeEach(() => {
  reseedDb();
});

test('OA simulator routes require administrator users', async () => {
  const unauthenticated = await applicationsGet(buildRequest({ userId: null }));
  assert.equal(unauthenticated.status, 401);

  const forbidden = await applicationActionPost(
    buildRequest({ userId: 'u_l1_1', body: { action: 'GENERATE_TICKET' } }),
    { params: Promise.resolve({ oaId: 'OA-NOPE' }) }
  );
  assert.equal(forbidden.status, 403);
});

test('OA simulator lists OA applications and dispatches generate action through state machine', async () => {
  const created = createOaTicket('TKT-OA-ROUTE-1');
  const listResponse = await applicationsGet(buildRequest());
  const listPayload = await listResponse.json();

  assert.equal(listResponse.status, 200);
  assert.equal(listPayload.ok, true);
  assert.ok(listPayload.applications.some((item) => item.oaId === created.ticket.oaApplication.oaId));

  const actionResponse = await applicationActionPost(
    buildRequest({
      body: {
        action: 'GENERATE_TICKET',
        opinion: '需要继续处理',
        attachments: [],
        operatorName: '管理员',
        handledAt: '2026-05-20T10:00:00.000Z'
      }
    }),
    { params: Promise.resolve({ oaId: created.ticket.oaApplication.oaId }) }
  );
  const actionPayload = await actionResponse.json();
  const savedTicket = getTicketById(created.ticket.id);

  assert.equal(actionResponse.status, 200);
  assert.equal(actionPayload.ok, true);
  assert.equal(actionPayload.ticket.status, STATUS.PENDING);
  assert.equal(savedTicket.formalTicketCreated, true);
});

test('OA simulator reject action returns approving ticket to draft', async () => {
  const created = createOaTicket('TKT-OA-REJECT-ROUTE');

  const actionResponse = await applicationActionPost(
    buildRequest({
      body: {
        action: 'REJECT',
        opinion: '材料不完整'
      }
    }),
    { params: Promise.resolve({ oaId: created.ticket.oaApplication.oaId }) }
  );
  const payload = await actionResponse.json();

  assert.equal(actionResponse.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.ticket.status, STATUS.DRAFT);
  assert.equal(payload.ticket.oaLocked, false);
});

test('OA simulator returns 404 for unknown OA application id', async () => {
  const response = await applicationActionPost(
    buildRequest({ body: { action: 'GENERATE_TICKET' } }),
    { params: Promise.resolve({ oaId: 'OA-UNKNOWN' }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.ok, false);
});

function createOaTicket(id) {
  return dispatchCreateTicketEvent(
    EVENTS.SUBMIT_TO_OA,
    {
      id,
      title: 'OA route ticket',
      toolType: 'DATA_EXTRACT',
      priority: 'P4',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'OA route test' }] }]
      },
      attachments: []
    },
    requesterUser
  );
}

function buildRequest({ userId = 'u_admin_1', body = {} } = {}) {
  return {
    cookies: {
      get(name) {
        if (name !== 'itsm_session_user_id' || !userId) return undefined;
        return { value: userId };
      }
    },
    async json() {
      return body;
    }
  };
}
