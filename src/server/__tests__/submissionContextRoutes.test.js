import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { POST as draftsPost } from '../../../app/api/submission/drafts/route.js';
import { PATCH as draftPatch } from '../../../app/api/submission/drafts/[id]/route.js';
import { POST as ticketsPost } from '../../../app/api/submission/tickets/route.js';
import { STATUS } from '../../constants/ticketStatus.js';
import { getTicketById } from '../store.js';
import { reseedDb } from '../db.js';

const aiAssistantRouteSource = fs.readFileSync(
  new URL('../../../app/api/submission/ai-assistant/route.js', import.meta.url),
  'utf8'
);
const mockDescriptionRouteSource = fs.readFileSync(
  new URL('../../../app/api/submission/mock-description/route.js', import.meta.url),
  'utf8'
);

test.beforeEach(() => {
  reseedDb();
});

test('submission draft route creates draft tickets through CREATE_DRAFT', async () => {
  const response = await draftsPost(buildRequest({ ticket: buildTicket() }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.ticket.status, STATUS.DRAFT);
  assert.match(payload.ticket.id, /^draft_/);
});

test('submission draft route updates drafts through UPDATE_DRAFT', async () => {
  const createResponse = await draftsPost(buildRequest({ ticket: buildTicket({ title: 'draft one' }) }));
  const createPayload = await createResponse.json();

  const updateResponse = await draftPatch(
    buildRequest({
      values: {
        ...buildTicket({ title: 'draft updated' }),
        descriptionDoc: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'updated draft' }] }]
        }
      },
      attachments: []
    }),
    { params: Promise.resolve({ id: createPayload.ticket.id }) }
  );
  const updatePayload = await updateResponse.json();

  assert.equal(updateResponse.status, 200);
  assert.equal(updatePayload.ok, true);
  assert.equal(updatePayload.ticket.status, STATUS.DRAFT);
  assert.equal(updatePayload.ticket.title, 'draft updated');
});

test('submission ticket route submits data extract tickets to OA by default', async () => {
  const response = await ticketsPost(
    buildRequest({
      ticket: buildTicket({ id: 'TKT-SUBMISSION-OA-1', toolType: 'DATA_EXTRACT' })
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.ticket.status, STATUS.APPROVING);
  assert.equal(payload.ticket.oaLocked, true);
});

test('submission ticket route can submit existing drafts into formal tickets', async () => {
  const createResponse = await draftsPost(buildRequest({ ticket: buildTicket({ title: 'draft submit' }) }));
  const createPayload = await createResponse.json();

  const submitResponse = await ticketsPost(
    buildRequest({
      draftId: createPayload.ticket.id,
      ticket: buildTicket({ title: 'formal from draft' })
    })
  );
  const submitPayload = await submitResponse.json();

  assert.equal(submitResponse.status, 200);
  assert.equal(submitPayload.ok, true);
  assert.match(submitPayload.ticket.id, /^TKT-/);
  assert.equal(getTicketById(createPayload.ticket.id), null);
});

test('submission AI helper routes wrap the existing AI implementations', () => {
  assert.match(aiAssistantRouteSource, /api\/ai\/ticket-assistant\/route\.js/);
  assert.match(mockDescriptionRouteSource, /api\/ai\/mock-ticket-description\/route\.js/);
});

function buildTicket(patch = {}) {
  return {
    id: patch.id || 'TKT-SUBMISSION-1',
    title: patch.title || 'submission ticket',
    toolType: patch.toolType || 'CONSULT',
    priority: 'P3',
    systemName: 'ERP_CORE',
    reporterPhone: '13800138000',
    reporterEmail: '',
    reportForOthers: false,
    descriptionDoc: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'submission test' }] }]
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
