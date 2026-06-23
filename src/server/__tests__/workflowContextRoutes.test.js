import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as workflowTicketsGet } from '../../../app/api/workflow/tickets/route.js';
import { POST as workflowTicketsPost } from '../../../app/api/workflow/tickets/route.js';
import { GET as workflowTicketGet } from '../../../app/api/workflow/tickets/[id]/route.js';
import { POST as workflowTicketCommandsPost } from '../../../app/api/workflow/tickets/[id]/commands/route.js';
import { POST as workflowTicketMessagesPost } from '../../../app/api/workflow/tickets/[id]/messages/route.js';
import { POST as workflowTicketCustomTagsPost } from '../../../app/api/workflow/tickets/[id]/custom-tags/route.js';
import { GET as workflowDefectsGet, POST as workflowDefectsPost } from '../../../app/api/workflow/defects/route.js';
import {
  GET as workflowMessageReadsGet,
  POST as workflowMessageReadsPost
} from '../../../app/api/workflow/message-reads/route.js';
import { POST as workflowResetPost } from '../../../app/api/workflow/reset/route.js';
import { GET as workflowExportGet } from '../../../app/api/workflow/export/route.js';
import { reseedDb } from '../db.js';

test.beforeEach(() => {
  reseedDb();
});

test('workflow ticket list returns visible tickets for the current user', async () => {
  const response = await workflowTicketsGet(buildRequest({ userId: 'u_requester_1' }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.tickets));
});

test('workflow ticket create route still routes submit payloads through the state machine', async () => {
  const response = await workflowTicketsPost(
    buildRequest({
      userId: 'u_requester_1',
      body: {
        ticket: buildTicket(),
        event: 'SUBMIT'
      }
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(payload.ticket.id);
});

test('workflow ticket commands route dispatches by command name', async () => {
  const response = await workflowTicketCommandsPost(
    buildRequest({
      userId: 'u_requester_1',
      body: {
        command: 'ACCEPT',
        payload: {}
      }
    }),
    { params: Promise.resolve({ id: 'TKT-NOPE' }) }
  );

  assert.equal(response.status, 404);
});

test('workflow ticket commands route supports draft lifecycle commands', async () => {
  const createResponse = await workflowTicketsPost(
    buildRequest({
      userId: 'u_requester_1',
      body: {
        ticket: buildTicket({ title: 'draft command' }),
        event: 'CREATE_DRAFT'
      }
    })
  );
  const createPayload = await createResponse.json();

  const updateResponse = await workflowTicketCommandsPost(
    buildRequest({
      userId: 'u_requester_1',
      body: {
        command: 'UPDATE_DRAFT',
        payload: {
          values: buildTicket({ title: 'updated draft command' }),
          attachments: []
        }
      }
    }),
    { params: Promise.resolve({ id: createPayload.ticket.id }) }
  );
  const updatePayload = await updateResponse.json();

  assert.equal(updateResponse.status, 200);
  assert.equal(updatePayload.ok, true);
  assert.equal(updatePayload.ticket.title, 'updated draft command');
});

test('workflow ticket detail route is readable', async () => {
  const response = await workflowTicketGet(
    buildRequest({ userId: 'u_requester_1' }),
    { params: Promise.resolve({ id: 'TKT-NOPE' }) }
  );

  assert.equal(response.status, 404);
});

test('workflow support routes expose defects, reads, reset and export endpoints', async () => {
  const defectResponse = await workflowDefectsGet(buildRequest({ userId: 'u_requester_1' }));
  const defectPayload = await defectResponse.json();
  assert.equal(defectResponse.status, 200);
  assert.equal(defectPayload.ok, true);

  const defectCreateResponse = await workflowDefectsPost(
    buildRequest({
      userId: 'u_requester_1',
      body: { defect: { defectId: 'DEF-1', title: 'demo' } }
    })
  );
  assert.equal(defectCreateResponse.status, 200);

  const messageReadResponse = await workflowMessageReadsPost(
    buildRequest({
      userId: 'u_requester_1',
      body: { ticketId: 'TKT-1', readAt: '2026-05-25T00:00:00.000Z' }
    })
  );
  assert.equal(messageReadResponse.status, 200);

  const messageReadsResponse = await workflowMessageReadsGet(buildRequest({ userId: 'u_requester_1' }));
  const messageReadsPayload = await messageReadsResponse.json();
  assert.equal(messageReadsResponse.status, 200);
  assert.equal(messageReadsPayload.messageReads['u_requester_1:TKT-1'], '2026-05-25T00:00:00.000Z');

  const resetResponse = await workflowResetPost(buildRequest({ userId: 'u_requester_1' }));
  assert.equal(resetResponse.status, 200);

  const exportResponse = await workflowExportGet(buildRequest({ userId: 'u_requester_1' }));
  assert.equal(exportResponse.status, 200);
});

test('workflow ticket nested routes accept messages and custom tags', async () => {
  const messageResponse = await workflowTicketMessagesPost(
    buildRequest({
      userId: 'u_requester_1',
      body: { message: { id: 'msg-1', content: 'hello' } }
    }),
    { params: Promise.resolve({ id: 'TKT-NOPE' }) }
  );
  assert.equal(messageResponse.status, 404);

  const tagsResponse = await workflowTicketCustomTagsPost(
    buildRequest({
      userId: 'u_requester_1',
      body: { tags: [] }
    }),
    { params: Promise.resolve({ id: 'TKT-NOPE' }) }
  );
  assert.equal(tagsResponse.status, 404);
});

function buildTicket(patch = {}) {
  return {
    id: patch.id || 'TKT-WORKFLOW-1',
    title: 'workflow ticket',
    toolType: patch.toolType || 'CONSULT',
    priority: 'P3',
    systemName: 'ERP_CORE',
    reporterPhone: '13800138000',
    descriptionDoc: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'workflow test' }] }]
    },
    attachments: [],
    ...patch
  };
}

function buildRequest({ userId = 'u_requester_1', body = {} } = {}) {
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
