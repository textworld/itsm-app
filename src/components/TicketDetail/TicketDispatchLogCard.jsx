'use client';

import React, { useEffect, useState } from 'react';
import { Card, Empty, Space, Tag, Timeline, Typography } from 'antd';
import { formatDateTime } from '../../utils/format.js';

const STATUS_META = {
  SUCCESS: { color: 'green', label: '派工成功' },
  SKIPPED: { color: 'orange', label: '跳过派工' },
  FAILED: { color: 'red', label: '派工失败' }
};

const RULE_LABELS = {
  INSURANCE_TEAM: '险种小组',
  FLEXIBLE_RULE: '灵活规则',
  BASE_SCHEDULE: '基础排班'
};

export default function TicketDispatchLogCard({ ticketId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!ticketId) {
      setLogs([]);
      return undefined;
    }

    setLoading(true);
    fetch(`/api/workflow/tickets/${ticketId}/dispatch-logs`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setLogs(data?.ok === false ? [] : data.logs || []);
      })
      .catch((error) => {
        console.error(error);
        if (active) setLogs([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticketId]);

  return (
    <Card title="派工日志" loading={loading}>
      {logs.length ? (
        <Timeline
          items={logs.map((log) => ({
            color: STATUS_META[log.status]?.color || 'gray',
            children: <DispatchLogItem log={log} />
          }))}
        />
      ) : (
        <Empty description="暂无派工日志" />
      )}
    </Card>
  );
}

function DispatchLogItem({ log }) {
  const statusMeta = STATUS_META[log.status] || { color: 'default', label: log.status || '未知状态' };
  const route = log.data?.route || {};
  const reason = log.data?.reason;

  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <Space size={8} wrap>
        <Typography.Text strong>{statusMeta.label}</Typography.Text>
        <Tag color={statusMeta.color}>{log.status}</Tag>
        {log.event && <Tag color="blue">{log.event}</Tag>}
        <Typography.Text type="secondary">{formatDateTime(log.createdAt)}</Typography.Text>
      </Space>
      <Space size={8} wrap>
        {log.ruleType && (
          <Tag color="geekblue">
            {RULE_LABELS[log.ruleType] || log.ruleType}
          </Tag>
        )}
        {log.ruleId && <Typography.Text type="secondary">规则ID：{log.ruleId}</Typography.Text>}
        {log.routeKey && <Typography.Text type="secondary">routeKey：{log.routeKey}</Typography.Text>}
      </Space>
      {log.assigneeName && (
        <Typography.Text>
          处理人：{log.assigneeName}
          {log.assigneeId ? ` (${log.assigneeId})` : ''}
        </Typography.Text>
      )}
      {Number.isInteger(route.sequenceIndex) && (
        <Typography.Text type="secondary">
          轮转位置：{route.sequenceIndex + 1}/{route.sequenceLength || '-'}
        </Typography.Text>
      )}
      {reason && <Typography.Text type="secondary">原因：{reason}</Typography.Text>}
    </Space>
  );
}
