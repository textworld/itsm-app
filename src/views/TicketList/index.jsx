'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Input, Select, Tabs, Space, Typography, Badge } from 'antd';
import { DownOutlined, ReloadOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { ROLES } from '../../constants/roles.js';
import {
  PROCESSING_SUB_STATUS_LABELS,
  REQUESTER_STATUSES,
  STATUS,
  STATUS_LABELS,
  SUPPORT_STATUSES
} from '../../constants/ticketStatus.js';
import { TOOL_TYPE_OPTIONS } from '../../constants/toolTypes.js';
import { PRIORITY_OPTIONS } from '../../constants/priorities.js';
import TicketTable from '../../components/TicketList/TicketTable.jsx';
import DataActionBar from '../../components/TicketList/DataActionBar.jsx';
import { filterTicketsBySearch } from '../../utils/ticketListFilters.js';
import { TICKET_LIST_MODES, buildView } from '../../utils/ticketListView.js';
import { useSystems } from '../../hooks/useSystems.js';

const { RangePicker } = DatePicker;

const EMPTY_FILTERS = {
  ticketId: '',
  title: '',
  priority: undefined,
  toolType: undefined,
  status: undefined,
  processingSubStatus: undefined,
  systemKeyword: '',
  requesterName: '',
  assigneeName: '',
  reporterPhone: '',
  customTag: '',
  createdRange: null,
  updatedRange: null,
  hasUnread: undefined,
  isOverdue: undefined,
  hasDefectTag: undefined,
  hasLinkedDefect: undefined
};

const YES_NO_OPTIONS = [
  { label: '是', value: 'yes' },
  { label: '否', value: 'no' }
];

/**
 * 工单列表页
 * - 提单人：展示个人所有工单，按 待受理/处理中/待验证/已办结 等 Tabs 筛选
 * - 一线：展示全部工单，按当前处理阶段分类
 * - 二线：待排查
 * - 顶部 + 底部均提供 "初始化数据" + "导出数据"
 */
export default function TicketListPage({ mode = TICKET_LIST_MODES.CURRENT, title = null }) {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { tickets, messageReads } = useTickets();
  const [activeTab, setActiveTab] = useState('ALL');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const { systems, loading: systemsLoading } = useSystems();

  const myView = useMemo(() => buildView(tickets, user, { mode }), [mode, tickets, user]);
  const statusOptions = useMemo(() => buildStatusOptions(user), [user]);
  const filteredTabs = useMemo(
    () =>
      myView.tabs.map((tab) => ({
        ...tab,
        data: filterTicketsBySearch(tab.data, appliedFilters, {
          user,
          messageReads
        })
      })),
    [appliedFilters, messageReads, myView.tabs, user]
  );
  const tabFromUrl = searchParams.get('tab');

  useEffect(() => {
    if (!myView.tabs.length) return;

    const hasActiveTab = myView.tabs.some((tab) => tab.key === activeTab);
    const nextTab = tabFromUrl && myView.tabs.some((tab) => tab.key === tabFromUrl)
      ? tabFromUrl
      : hasActiveTab
        ? activeTab
        : myView.defaultTab || 'ALL';

    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, myView.defaultTab, myView.tabs, tabFromUrl]);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Space style={{ display: 'flex', justifyContent: 'space-between' }} wrap>
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{myView.heading}</Typography.Text>
            <Typography.Text type="secondary">
              共 {myView.total} 条工单 · 当前视图：{title || myView.subheading}
            </Typography.Text>
          </Space>
          <DataActionBar />
        </Space>
      </Card>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap align="start">
            <Input
              allowClear
              placeholder="工单编号"
              value={filters.ticketId}
              onChange={(event) => setFilters((prev) => ({ ...prev, ticketId: event.target.value }))}
              style={{ width: 220 }}
            />
            <Input
              allowClear
              placeholder="工单标题"
              value={filters.title}
              onChange={(event) => setFilters((prev) => ({ ...prev, title: event.target.value }))}
              style={{ width: 260 }}
            />
            <Select
              allowClear
              placeholder="状态"
              options={statusOptions}
              value={filters.status}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              style={{ width: 160 }}
            />
            <Select
              allowClear
              placeholder="优先级"
              options={PRIORITY_OPTIONS}
              value={filters.priority}
              onChange={(value) => setFilters((prev) => ({ ...prev, priority: value }))}
              style={{ width: 150 }}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => setAppliedFilters(filters)}>
              查询
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setAppliedFilters(EMPTY_FILTERS);
              }}
            >
              重置
            </Button>
            <Button
              type="link"
              icon={filtersExpanded ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setFiltersExpanded((prev) => !prev)}
            >
              {filtersExpanded ? '收起' : '展开全部'}
            </Button>
          </Space>
          {filtersExpanded && (
            <Space wrap align="start">
              <Select
                allowClear
                placeholder="工单类型"
                options={TOOL_TYPE_OPTIONS}
                value={filters.toolType}
                onChange={(value) => setFilters((prev) => ({ ...prev, toolType: value }))}
                style={{ width: 220 }}
              />
              <Select
                allowClear
                placeholder="处理子状态"
                options={Object.entries(PROCESSING_SUB_STATUS_LABELS).map(([value, label]) => ({
                  value,
                  label
                }))}
                value={filters.processingSubStatus}
                onChange={(value) => setFilters((prev) => ({ ...prev, processingSubStatus: value }))}
                style={{ width: 180 }}
              />
              <Select
                allowClear
                showSearch
                placeholder="所属系统"
                optionFilterProp="label"
                loading={systemsLoading}
                options={systems}
                value={filters.systemKeyword || undefined}
                onChange={(value) => setFilters((prev) => ({ ...prev, systemKeyword: value || '' }))}
                style={{ width: 240 }}
              />
              {user?.role !== ROLES.REQUESTER && (
                <Input
                  allowClear
                  placeholder="提单人"
                  value={filters.requesterName}
                  onChange={(event) => setFilters((prev) => ({ ...prev, requesterName: event.target.value }))}
                  style={{ width: 180 }}
                />
              )}
              <Input
                allowClear
                placeholder="处理人"
                value={filters.assigneeName}
                onChange={(event) => setFilters((prev) => ({ ...prev, assigneeName: event.target.value }))}
                style={{ width: 180 }}
              />
              <Input
                allowClear
                placeholder="联系电话"
                value={filters.reporterPhone}
                onChange={(event) => setFilters((prev) => ({ ...prev, reporterPhone: event.target.value }))}
                style={{ width: 180 }}
              />
              <Input
                allowClear
                placeholder="自定义标签"
                value={filters.customTag}
                onChange={(event) => setFilters((prev) => ({ ...prev, customTag: event.target.value }))}
                style={{ width: 180 }}
              />
              <RangePicker
                placeholder={['创建开始', '创建结束']}
                value={filters.createdRange}
                onChange={(value) => setFilters((prev) => ({ ...prev, createdRange: value }))}
                style={{ width: 260 }}
              />
              <RangePicker
                placeholder={['更新开始', '更新结束']}
                value={filters.updatedRange}
                onChange={(value) => setFilters((prev) => ({ ...prev, updatedRange: value }))}
                style={{ width: 260 }}
              />
              <Select
                allowClear
                placeholder="有未读消息"
                options={YES_NO_OPTIONS}
                value={filters.hasUnread}
                onChange={(value) => setFilters((prev) => ({ ...prev, hasUnread: value }))}
                style={{ width: 150 }}
              />
              <Select
                allowClear
                placeholder="SLA超期"
                options={YES_NO_OPTIONS}
                value={filters.isOverdue}
                onChange={(value) => setFilters((prev) => ({ ...prev, isOverdue: value }))}
                style={{ width: 140 }}
              />
              <Select
                allowClear
                placeholder="已打缺陷标"
                options={YES_NO_OPTIONS}
                value={filters.hasDefectTag}
                onChange={(value) => setFilters((prev) => ({ ...prev, hasDefectTag: value }))}
                style={{ width: 150 }}
              />
              <Select
                allowClear
                placeholder="已关联缺陷"
                options={YES_NO_OPTIONS}
                value={filters.hasLinkedDefect}
                onChange={(value) => setFilters((prev) => ({ ...prev, hasLinkedDefect: value }))}
                style={{ width: 150 }}
              />
            </Space>
          )}
          {myView.hideTabs ? (
            <TicketTable
              dataSource={filteredTabs[0]?.data || []}
              showRequester={user.role !== ROLES.REQUESTER}
            />
          ) : (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={filteredTabs.map((t) => ({
                key: t.key,
                label: (
                  <span>
                    {t.label} <Badge count={t.data.length} color={t.color || 'blue'} showZero />
                  </span>
                ),
                children: <TicketTable dataSource={t.data} showRequester={user.role !== ROLES.REQUESTER} />
              }))}
            />
          )}
        </Space>
      </Card>

      <Card size="small">
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <DataActionBar />
        </Space>
      </Card>
    </Space>
  );
}

function buildStatusOptions(user) {
  const statuses = user?.role === ROLES.ADMIN
    ? Array.from(new Set([...REQUESTER_STATUSES, ...SUPPORT_STATUSES]))
    : user?.role === ROLES.REQUESTER
      ? REQUESTER_STATUSES
      : SUPPORT_STATUSES;
  return statuses.map((status) => ({
    value: status,
    label: STATUS_LABELS[status] || status
  }));
}
