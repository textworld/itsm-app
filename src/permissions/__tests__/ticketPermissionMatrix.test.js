import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES } from '../../constants/roles.js';
import { STATUS } from '../../constants/ticketStatus.js';
import { TICKET_ACTIONS, canPerformTicketAction } from '../ticketPermissionMatrix.js';

test('权限矩阵按角色和工单状态维护可执行动作', () => {
  const ticket = { id: 'TKT-PERM-1', status: STATUS.PROCESSING };

  assert.equal(
    canPerformTicketAction(ticket, { id: 'u_l1_1', role: ROLES.L1 }, TICKET_ACTIONS.CREATE_SUBTASK),
    true
  );
  assert.equal(
    canPerformTicketAction(ticket, { id: 'u_l2_1', role: ROLES.L2 }, TICKET_ACTIONS.CREATE_SUBTASK),
    false
  );
  assert.equal(
    canPerformTicketAction(ticket, { id: 'u_l2_1', role: ROLES.L2 }, TICKET_ACTIONS.UPDATE_CUSTOM_TAGS),
    true
  );
  assert.equal(
    canPerformTicketAction(ticket, { id: 'u_requester_1', role: ROLES.REQUESTER }, TICKET_ACTIONS.UPDATE_CUSTOM_TAGS),
    false
  );
});
