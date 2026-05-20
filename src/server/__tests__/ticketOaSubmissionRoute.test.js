import test from 'node:test';
import assert from 'node:assert/strict';

import { POST as ticketsPost } from '../../../app/api/tickets/route.js';
import { STATUS } from '../../constants/ticketStatus.js';
import { reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('ticket create route submits data extract and permission tickets to OA by default', async () => {
  const response = await ticketsPost(buildRequest({
    ticket: buildTicket({ id: 'TKT-ROUTE-OA-1', toolType: 'DATA_EXTRACT' })
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.ticket.status, STATUS.APPROVING);
  assert.equal(payload.ticket.oaLocked, true);
  assert.ok(payload.ticket.oaApplication.oaId);
});

test('ticket create route generates formal ticket ids for OA create events', async () => {
  const response = await ticketsPost(buildRequest({
    ticket: buildTicket({ id: undefined, toolType: 'PERMISSION' })
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.match(payload.ticket.id, /^TKT-/);
  assert.equal(payload.ticket.status, STATUS.APPROVING);
});

test('ticket create route sends data fix with requester solution to scheme review', async () => {
  const response = await ticketsPost(buildRequest({
    ticket: buildTicket({
      id: 'TKT-ROUTE-FIX-1',
      toolType: 'DATA_FIX',
      dataFixSolution: { requesterSolution: '已有修正 SQL', relatedTicketId: '' }
    })
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ticket.status, STATUS.DATA_FIX_SCHEME_REVIEW);
});

test('ticket create route converts data fix without solution to consult pending flow', async () => {
  const response = await ticketsPost(buildRequest({
    ticket: buildTicket({ id: 'TKT-ROUTE-FIX-2', toolType: 'DATA_FIX' })
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ticket.status, STATUS.PENDING);
  assert.equal(payload.ticket.toolType, 'CONSULT');
  assert.equal(payload.ticket.originalToolType, 'DATA_FIX');
});

function buildTicket(patch = {}) {
  return {
    id: patch.id || 'TKT-ROUTE-1',
    title: 'route ticket',
    toolType: patch.toolType || 'CONSULT',
    priority: 'P4',
    systemName: 'ERP_CORE',
    reporterPhone: '13800138000',
    descriptionDoc: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'route test' }] }]
    },
    attachments: [],
    ...patch
  };
}

function buildRequest(body = {}, userId = 'u_requester_1') {
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
