import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES } from '../../constants/roles.js';
import {
  listSameRoleAssignees,
  routeRandomTechTransferAssignee,
  routeTechTransferAssignee
} from '../techTransferRouting.js';

test('二线转交候选人包含全部二线运维账号', () => {
  const assignees = listSameRoleAssignees(ROLES.L2);

  assert.deepEqual(
    assignees.map((assignee) => assignee.id),
    Array.from({ length: 23 }, (_, index) => `u_l2_${index + 1}`)
  );
  assert.equal(routeTechTransferAssignee(ROLES.L2).id, 'u_l2_1');
});

test('自动转交默认避开当前二线运维', () => {
  assert.equal(routeTechTransferAssignee(ROLES.L2, 'u_l2_1').id, 'u_l2_2');
});

test('random automatic tech transfer excludes the current support user', () => {
  const assignee = routeRandomTechTransferAssignee(ROLES.L2, 'u_l2_1', () => 0.99);

  assert.equal(assignee.id, 'u_l2_23');
});
