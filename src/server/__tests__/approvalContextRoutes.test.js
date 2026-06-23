import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as applicationsGet } from '../../../app/api/approval/applications/route.js';
import { GET as applicationDetailGet } from '../../../app/api/approval/applications/[oaId]/route.js';
import { POST as applicationActionPost } from '../../../app/api/approval/applications/[oaId]/actions/route.js';
import { STATUS } from '../../constants/ticketStatus.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { dispatchCreateTicketEvent, getTicketById } from '../store.js';
import { reseedDb } from '../db.js';

const requesterUser = { id: 'u_requester_1', name: '张三', role: 'REQUESTER' };

test.beforeEach(() => {
  reseedDb();
});

test('approval application routes require administrator users', async () => {
  const unauthenticated = await applicationsGet(buildRequest({ userId: null }));
  assert.equal(unauthenticated.status, 401);

  const forbidden = await applicationActionPost(
    buildRequest({ userId: 'u_l1_1', body: { action: 'GENERATE_TICKET' } }),
    { params: Promise.resolve({ oaId: 'OA-NOPE' }) }
  );
  assert.equal(forbidden.status, 403);
});

test('approval application list and detail expose OA applications', async () => {
  const created = createOaTicket('TKT-APPROVAL-ROUTE-1');

  const listResponse = await applicationsGet(buildRequest());
  const listPayload = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(listPayload.ok, true);
  assert.ok(listPayload.applications.some((item) => item.oaId === created.ticket.oaApplication.oaId));

  const detailResponse = await applicationDetailGet(
    buildRequest(),
    { params: Promise.resolve({ oaId: created.ticket.oaApplication.oaId }) }
  );
  const detailPayload = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detailPayload.ok, true);
  assert.equal(detailPayload.application.oaId, created.ticket.oaApplication.oaId);
  assert.equal(detailPayload.ticket.id, created.ticket.id);
});

test('approval action dispatches generate action through the ticket state machine', async () => {
  const created = createOaTicket('TKT-APPROVAL-GENERATE');

  const actionResponse = await applicationActionPost(
    buildRequest({
      body: {
        action: 'GENERATE_TICKET',
        opinion: '继续处理',
        attachments: [],
        operatorName: '管理员',
        handledAt: '2026-05-26T10:00:00.000Z'
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

test('approval application detail returns 404 for unknown OA id', async () => {
  const response = await applicationDetailGet(
    buildRequest(),
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
      title: 'approval route ticket',
      toolType: 'DATA_EXTRACT',
      priority: 'P3',
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'approval route test' }] }]
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
