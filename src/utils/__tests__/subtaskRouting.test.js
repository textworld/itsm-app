import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES } from '../../constants/roles.js';
import {
  listAssignableSubtaskAssignees,
  listSubtaskAssignees,
  routeSubtaskAssignee
} from '../subtaskRouting.js';

test('创建子任务可指定所有一线和二线技术支持', () => {
  const assignees = listAssignableSubtaskAssignees();

  assert.deepEqual(
    assignees.map((assignee) => assignee.id),
    ['u_l1_1', 'u_l1_2', 'u_l1_3', 'u_l2_1', 'u_l2_2', 'u_l2_3']
  );
  assert.equal(assignees.filter((assignee) => assignee.role === ROLES.L1).length, 3);
  assert.equal(assignees.filter((assignee) => assignee.role === ROLES.L2).length, 3);
});

test('系统默认子任务派工仍保留原有路由', () => {
  assert.equal(routeSubtaskAssignee('ERP_CORE').id, 'u_l1_1');
  assert.deepEqual(listSubtaskAssignees('ERP_CORE').map((assignee) => assignee.id), ['u_l1_1']);
  assert.equal(routeSubtaskAssignee('MES_PORTAL').id, 'u_l2_1');
  assert.deepEqual(listSubtaskAssignees('MES_PORTAL').map((assignee) => assignee.id), ['u_l2_1']);
});
