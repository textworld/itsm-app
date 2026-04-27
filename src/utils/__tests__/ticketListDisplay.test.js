import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES } from '../../constants/roles.js';
import { STATUS } from '../../constants/ticketStatus.js';
import {
  getAssigneeColumnTitle,
  getAssigneeDisplay,
  getTicketNumberDisplay,
  getTitleColumnWidth,
  getTitleColumnTitle,
  shouldShowStatusSubLabel,
  shouldShowSlaColumn
} from '../ticketListDisplay.js';

test('提单人列表不展示 SLA 剩余字段', () => {
  assert.equal(shouldShowSlaColumn({ role: ROLES.REQUESTER }), false);
});

test('技术支持列表继续展示 SLA 剩余字段', () => {
  assert.equal(shouldShowSlaColumn({ role: ROLES.L1 }), true);
});

test('提单人待受理工单显示等待技术支持受理中', () => {
  assert.equal(
    getAssigneeDisplay(
      { requesterStatus: STATUS.PENDING, assigneeL1Name: null, assigneeL2Name: null },
      { role: ROLES.REQUESTER }
    ),
    '等待技术支持受理中'
  );
});

test('提单人列表字段标题显示为受理人', () => {
  assert.equal(getAssigneeColumnTitle({ role: ROLES.REQUESTER }), '受理人');
});

test('提单人列表不显示二线运维人员姓名', () => {
  assert.equal(
    getAssigneeDisplay(
      { requesterStatus: STATUS.PROCESSING, assigneeL1Name: '张三', assigneeL2Name: '李四' },
      { role: ROLES.REQUESTER }
    ),
    '一线: 张三'
  );
});

test('非提单人列表继续拼接一线和二线处理人', () => {
  assert.equal(
    getAssigneeDisplay(
      { supportStatus: STATUS.PROCESSING, assigneeL1Name: '张三', assigneeL2Name: '李四' },
      { role: ROLES.L1 }
    ),
    '一线: 张三 / 二线: 李四'
  );
});

test('技术支持列表标题列显示为工单标题', () => {
  assert.equal(getTitleColumnTitle({ role: ROLES.L1 }), '工单标题');
});

test('一线技术支持列表标题列使用更宽列宽', () => {
  assert.equal(getTitleColumnWidth({ role: ROLES.L1 }), 360);
});

test('提单人列表标题列继续显示为标题', () => {
  assert.equal(getTitleColumnTitle({ role: ROLES.REQUESTER }), '标题');
});

test('提单人工单列表不展示状态子状态', () => {
  assert.equal(shouldShowStatusSubLabel({ role: ROLES.REQUESTER }), false);
});

test('技术支持工单列表继续展示状态子状态', () => {
  assert.equal(shouldShowStatusSubLabel({ role: ROLES.L1 }), true);
});

test('内部草稿编号在列表中显示为草稿', () => {
  assert.equal(
    getTicketNumberDisplay({ id: 'draft_abc_123', requesterStatus: STATUS.DRAFT }),
    '草稿'
  );
});

test('正式工单编号在列表中保持原样展示', () => {
  assert.equal(
    getTicketNumberDisplay({ id: 'TKT-20260425-0001', requesterStatus: STATUS.DRAFT }),
    'TKT-20260425-0001'
  );
});
