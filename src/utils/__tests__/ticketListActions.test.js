import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES } from '../../constants/roles.js';
import { PROCESSING_SUB_STATUS, STATUS } from '../../constants/ticketStatus.js';
import { getTicketListActions } from '../ticketListActions.js';

const requester = { id: 'u_requester_1', name: '张三', role: ROLES.REQUESTER };
const l1 = { id: 'u_l1_1', name: '李工', role: ROLES.L1 };

test('草稿中的提单人在列表页可直接提交', () => {
  const actions = getTicketListActions(
    {
      id: 'TKT-DRAFT-1',
      status: STATUS.DRAFT,
      requesterStatus: STATUS.DRAFT,
      supportStatus: STATUS.DRAFT
    },
    requester
  );

  assert.deepEqual(actions.map((item) => item.key), ['submit']);
  assert.equal(actions[0].label, '提交');
  assert.equal(actions[0].event, 'SUBMIT');
});

test('一线待受理工单在列表页可直接受理', () => {
  const actions = getTicketListActions(
    {
      id: 'TKT-PENDING-1',
      status: STATUS.PENDING,
      requesterStatus: STATUS.PENDING,
      supportStatus: STATUS.PENDING
    },
    l1
  );

  assert.deepEqual(actions.map((item) => item.key), ['accept']);
  assert.equal(actions[0].label, '受理');
  assert.equal(actions[0].event, 'ACCEPT');
});

test('一线处理中工单在列表页提供退回、二线支持和申请办结动作', () => {
  const actions = getTicketListActions(
    {
      id: 'TKT-PROCESSING-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      defectTag: { type: '功能缺陷' },
      linkedDefect: { defectId: 'BUG-1' },
      summary: '处理总结'
    },
    l1
  );

  assert.deepEqual(actions.map((item) => item.key), [
    'return_for_info',
    'request_l2_support',
    'initiate_closure'
  ]);
  assert.equal(actions[2].label, '申请办结');
  assert.equal(actions[2].event, 'INITIATE_CLOSURE');
});

test('一线处理中但未满足前置条件时，列表页不展示不支持的动作', () => {
  const actions = getTicketListActions(
    {
      id: 'TKT-PROCESSING-2',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      defectTag: null,
      linkedDefect: null,
      summary: ''
    },
    l1
  );

  assert.deepEqual(actions.map((item) => item.key), ['return_for_info']);
});
