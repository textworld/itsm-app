import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES } from '../../constants/roles.js';
import { REQUESTER_STATUSES, STATUS, SUPPORT_STATUSES, getRequesterStatus, getSupportStatus } from '../../constants/ticketStatus.js';
import { generateBulkTestData, getReachableSupportStatuses } from '../bulkTestDataGenerator.js';
import { listTickets, resetDatabase } from '../store.js';

test('bulk test data generator creates at least three tickets for every account in each reachable status', () => {
  resetDatabase();

  const result = generateBulkTestData({ perStatus: 3 });
  const tickets = listTickets();
  const supportStatuses = getReachableSupportStatuses();

  assert.equal(result.perStatus, 3);
  assert.equal(result.skippedSupportStatuses.includes(STATUS.SUSPENDED), true);

  for (const user of result.users.filter((item) => item.role === ROLES.REQUESTER)) {
    for (const status of REQUESTER_STATUSES) {
      assert.ok(
        tickets.filter((ticket) => ticket.requesterId === user.id && getRequesterStatus(ticket) === status).length >= 3,
        `${user.id} missing requester status ${status}`
      );
    }
  }

  for (const user of result.users.filter((item) => item.role === ROLES.L1)) {
    for (const status of supportStatuses) {
      assert.ok(
        tickets.filter((ticket) => ticket.assigneeL1Id === user.id && getSupportStatus(ticket) === status).length >= 3,
        `${user.id} missing L1 support status ${status}`
      );
    }
  }

  for (const user of result.users.filter((item) => item.role === ROLES.L2)) {
    for (const status of supportStatuses) {
      assert.ok(
        tickets.filter((ticket) => ticket.assigneeL2Id === user.id && getSupportStatus(ticket) === status).length >= 3,
        `${user.id} missing L2 support status ${status}`
      );
    }
  }
});
