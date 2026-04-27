'use client';

import React, { useMemo } from 'react';
import { Card, Descriptions, Table, Tag, Space, Typography, Alert } from 'antd';
import {
  TRANSITIONS,
  EVENT_LABELS,
  ROLE_EVENT_PERMISSIONS
} from '../../state-machine/ticketStateMachine.js';
import {
  PROCESSING_SUB_STATUS_LABELS,
  STATUS_LABELS,
  REQUESTER_STATUSES,
  SUPPORT_STATUSES
} from '../../constants/ticketStatus.js';
import { ROLE_LABELS } from '../../constants/roles.js';
import StateMachineDiagram from '../../components/StateMachine/StateMachineDiagram.jsx';
import { generatePlantUmlStateDiagram } from '../../utils/stateMachineDiagram.js';

/**
 * 工单流转状态机可视化页面
 * - 状态列表
 * - 转移表
 * - 角色-事件权限矩阵
 */
export default function StateMachinePage() {
  const plantUmlSource = useMemo(
    () => generatePlantUmlStateDiagram(TRANSITIONS, STATUS_LABELS, EVENT_LABELS),
    []
  );

  const transitionColumns = [
    { title: '编号', dataIndex: 'id', render: (v) => <Tag color="magenta">{v}</Tag> },
    { title: '起始状态', dataIndex: 'from', render: (v) => STATUS_LABELS[v] || (v === null ? '(创建)' : v) },
    { title: '起始子状态', dataIndex: 'fromSubStatus', render: (v) => PROCESSING_SUB_STATUS_LABELS[v] || '-' },
    { title: '事件', dataIndex: 'event', render: (e) => EVENT_LABELS[e] || e },
    { title: '目标状态', dataIndex: 'to', render: (v) => <Tag color="blue">{STATUS_LABELS[v]}</Tag> },
    { title: '目标子状态', dataIndex: 'toSubStatus', render: (v) => PROCESSING_SUB_STATUS_LABELS[v] || '-' },
    { title: '操作角色', dataIndex: 'role', render: (r) => <Tag color="geekblue">{ROLE_LABELS[r] || r}</Tag> },
    {
      title: '前置条件 (guard)',
      dataIndex: 'guard',
      render: (g) => (g ? <Typography.Text type="warning">需满足业务约束</Typography.Text> : '-')
    }
  ];

  const permissionRows = Object.entries(ROLE_EVENT_PERMISSIONS).map(([role, events]) => ({
    role,
    events
  }));

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="工单流转状态机声明"
        description="本系统所有工单流转都由 src/state-machine/ticketStateMachine.js 的 TRANSITIONS 规则驱动，canTransition + applyTransition 是唯一的业务入口。"
      />

      <Card title="状态列表">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="提单人状态">
            <Space wrap>
              {REQUESTER_STATUSES.map((status) => (
                <Tag key={status} color="blue">{STATUS_LABELS[status]}</Tag>
              ))}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="技术支持状态">
            <Space wrap>
              {SUPPORT_STATUSES.map((status) => (
                <Tag key={status} color="geekblue">{STATUS_LABELS[status]}</Tag>
              ))}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="处理中子状态" span={2}>
            <Space wrap>
              {Object.entries(PROCESSING_SUB_STATUS_LABELS).map(([key, label]) => (
                <Tag key={key} color="purple">{label}</Tag>
              ))}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="状态转移表">
        <Table
          rowKey={(r) => r.id || `${r.from || 'INIT'}_${r.event}`}
          dataSource={TRANSITIONS}
          columns={transitionColumns}
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="PlantUML 源码">
        <Typography.Paragraph type="secondary">
          以下源码由当前状态转移表自动生成，可直接复制用于本地 PlantUML 工具。
        </Typography.Paragraph>
        <pre style={{ background: '#fafafa', padding: 16, overflow: 'auto', margin: 0 }}>
          {plantUmlSource}
        </pre>
      </Card>

      <Card title="本地渲染状态图">
        <Typography.Paragraph type="secondary">
          图形由 react-plantuml 根据上方 PlantUML 源码渲染，允许访问 PlantUML 在线 SVG 服务。
        </Typography.Paragraph>
        <StateMachineDiagram
          plantUmlSource={plantUmlSource}
        />
      </Card>

      <Card title="角色-事件权限矩阵">
        <Descriptions column={1} bordered size="small">
          {permissionRows.map((r) => (
            <Descriptions.Item label={ROLE_LABELS[r.role] || r.role} key={r.role}>
              <Space wrap>
                {r.events.map((e) => (
                  <Tag key={e} color="purple">{EVENT_LABELS[e] || e}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Card>
    </Space>
  );
}
