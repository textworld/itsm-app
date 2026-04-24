import React, { useMemo, useState } from 'react';
import { Card, Tabs, Space, Typography, Badge } from 'antd';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { ROLES } from '../../constants/roles.js';
import {
  PROCESSING_SUB_STATUS,
  STATUS,
  STATUS_LABELS,
  getProcessingSubStatus,
  getRequesterStatus,
  getSupportStatus
} from '../../constants/ticketStatus.js';
import {
  TOOL_TYPES,
  L1_ACCEPTABLE_TOOL_TYPES
} from '../../constants/toolTypes.js';
import TicketTable from '../../components/TicketList/TicketTable.jsx';
import DataActionBar from '../../components/TicketList/DataActionBar.jsx';

/**
 * 工单列表页
 * - 提单人：展示个人所有工单，按 待受理/处理中/待验证/已办结 等 Tabs 筛选
 * - 一线：展示全部工单，按当前处理阶段分类
 * - 二线：待排查
 * - 顶部 + 底部均提供 "初始化数据" + "导出数据"
 */
export default function TicketListPage() {
  const { user } = useAuth();
  const { tickets } = useTickets();
  const [activeTab, setActiveTab] = useState('ALL');

  const myView = useMemo(() => buildView(tickets, user), [tickets, user]);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Space style={{ display: 'flex', justifyContent: 'space-between' }} wrap>
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{myView.heading}</Typography.Text>
            <Typography.Text type="secondary">
              共 {myView.total} 条工单 · 当前视图：{myView.subheading}
            </Typography.Text>
          </Space>
          <DataActionBar />
        </Space>
      </Card>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={myView.tabs.map((t) => ({
            key: t.key,
            label: (
              <span>
                {t.label} <Badge count={t.data.length} color={t.color || 'blue'} showZero />
              </span>
            ),
            children: <TicketTable dataSource={t.data} showRequester={user.role !== ROLES.REQUESTER} />
          }))}
        />
      </Card>

      <Card size="small">
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <DataActionBar />
        </Space>
      </Card>
    </Space>
  );
}

/**
 * 根据角色生成列表视图配置
 */
function buildView(tickets, user) {
  if (!user) {
    return { heading: '', subheading: '', total: 0, tabs: [] };
  }

  if (user.role === ROLES.REQUESTER) {
    const mine = tickets.filter((t) => t.requesterId === user.id);
    const byStatus = (s) => mine.filter((t) => getRequesterStatus(t) === s);
    return {
      heading: '我提交的工单',
      subheading: '展示当前提单人账号下的所有工单',
      total: mine.length,
      tabs: [
        { key: 'ALL', label: '全部', data: mine, color: 'blue' },
        { key: STATUS.PENDING, label: STATUS_LABELS[STATUS.PENDING], data: byStatus(STATUS.PENDING), color: 'orange' },
        { key: STATUS.PROCESSING, label: STATUS_LABELS[STATUS.PROCESSING], data: byStatus(STATUS.PROCESSING), color: 'processing' },
        { key: STATUS.INFO_SUPPLEMENT, label: STATUS_LABELS[STATUS.INFO_SUPPLEMENT], data: byStatus(STATUS.INFO_SUPPLEMENT), color: 'cyan' },
        { key: STATUS.CONFIRMING, label: STATUS_LABELS[STATUS.CONFIRMING], data: byStatus(STATUS.CONFIRMING), color: 'gold' },
        { key: STATUS.CLOSED, label: STATUS_LABELS[STATUS.CLOSED], data: byStatus(STATUS.CLOSED), color: 'green' }
      ]
    };
  }

  if (user.role === ROLES.L1) {
    const allTickets = tickets.filter((t) => L1_ACCEPTABLE_TOOL_TYPES.includes(t.toolType));
    const pending = allTickets.filter((t) => getSupportStatus(t) === STATUS.PENDING);
    const l1Processing = allTickets.filter(
      (t) =>
        getSupportStatus(t) === STATUS.PROCESSING &&
        getProcessingSubStatus(t) === PROCESSING_SUB_STATUS.L1_INVESTIGATION
    );
    const l2Processing = allTickets.filter(
      (t) =>
        getSupportStatus(t) === STATUS.PROCESSING &&
        getProcessingSubStatus(t) === PROCESSING_SUB_STATUS.L2_INVESTIGATION
    );
    const returned = allTickets.filter((t) => getSupportStatus(t) === STATUS.RETURNED);
    const suspended = allTickets.filter((t) => getSupportStatus(t) === STATUS.SUSPENDED);
    const infoSupplement = allTickets.filter((t) => getSupportStatus(t) === STATUS.INFO_SUPPLEMENT);
    const confirming = allTickets.filter((t) => getSupportStatus(t) === STATUS.CONFIRMING);
    const closed = allTickets.filter((t) => getSupportStatus(t) === STATUS.CLOSED);
    return {
      heading: '一线技术支持工作台',
      subheading: '展示全部工单，并按当前处理阶段分类',
      total: allTickets.length,
      tabs: [
        { key: 'ALL', label: '全部', data: allTickets, color: 'blue' },
        { key: STATUS.PENDING, label: `待受理`, data: pending, color: 'orange' },
        { key: 'PROCESSING_L1', label: `处理中·一线排查`, data: l1Processing, color: 'processing' },
        { key: 'PROCESSING_L2', label: `处理中·二线排查`, data: l2Processing, color: 'volcano' },
        { key: STATUS.SUSPENDED, label: `已挂起`, data: suspended, color: 'default' },
        { key: STATUS.INFO_SUPPLEMENT, label: `信息补充`, data: infoSupplement, color: 'cyan' },
        { key: STATUS.RETURNED, label: `已回退`, data: returned, color: 'red' },
        { key: STATUS.CONFIRMING, label: `待确认`, data: confirming, color: 'gold' },
        { key: STATUS.CLOSED, label: `已办结`, data: closed, color: 'green' }
      ]
    };
  }

  if (user.role === ROLES.L2) {
    const investigating = tickets.filter(
      (t) =>
        getSupportStatus(t) === STATUS.PROCESSING &&
        getProcessingSubStatus(t) === PROCESSING_SUB_STATUS.L2_INVESTIGATION
    );
    const handled = tickets.filter(
      (t) =>
        t.assigneeL2Id === user.id &&
        getProcessingSubStatus(t) !== PROCESSING_SUB_STATUS.L2_INVESTIGATION
    );
    return {
      heading: '二线运维工作台',
      subheading: '展示一线流转过来的处理中·二线排查缺陷类工单',
      total: investigating.length,
      tabs: [
        { key: 'PROCESSING_L2', label: '处理中·二线排查', data: investigating, color: 'volcano' },
        { key: 'HANDLED', label: '我已处理', data: handled, color: 'blue' }
      ]
    };
  }

  return { heading: '', subheading: '', total: 0, tabs: [] };
}

// 引用说明：保留 TOOL_TYPES 以便将来扩展按类型筛选（避免 lint 警告也可删除）
void TOOL_TYPES;
