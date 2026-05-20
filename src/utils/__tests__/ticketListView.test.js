import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES } from '../../constants/roles.js';
import { STATUS } from '../../constants/ticketStatus.js';
import { buildView } from '../ticketListView.js';

test('requester ticket list has an approving tab for OA tickets', () => {
  const requester = { id: 'u_requester_1', role: ROLES.REQUESTER };
  const approvingTicket = {
    id: 'TKT-OA-LIST',
    requesterId: requester.id,
    status: STATUS.APPROVING,
    requesterStatus: STATUS.APPROVING,
    supportStatus: STATUS.APPROVING
  };

  const view = buildView([approvingTicket], requester);
  const approvingTab = view.tabs.find((tab) => tab.key === STATUS.APPROVING);

  assert.ok(approvingTab);
  assert.deepEqual(approvingTab.data.map((ticket) => ticket.id), ['TKT-OA-LIST']);
});
