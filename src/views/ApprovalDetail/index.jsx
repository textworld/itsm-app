'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, Descriptions, Divider, Empty, Result, Space, Spin, Typography } from 'antd';
import AttachmentList from '../../components/common/AttachmentList.jsx';
import { STATUS_LABELS } from '../../constants/ticketStatus.js';
import { TOOL_TYPE_LABELS } from '../../constants/toolTypes.js';
import { PRIORITY_LABELS } from '../../constants/priorities.js';
import { useTickets } from '../../context/TicketContext.jsx';
import { formatDateTime } from '../../utils/format.js';

export default function ApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const oaId = params?.oaId;
  const { tickets, initialized } = useTickets();

  const ticket = useMemo(
    () => tickets.find((item) => item.oaApplication?.oaId === oaId),
    [tickets, oaId]
  );

  if (!initialized) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin tip="加载中..." />
      </div>
    );
  }

  if (!ticket) {
    return (
      <Result
        status="404"
        title="审批单不存在或无权访问"
        subTitle={`OA 编号：${oaId || '-'}`}
        extra={
          <Button type="primary" onClick={() => router.push('/tickets')}>
            返回工单列表
          </Button>
        }
      />
    );
  }

  const approval = ticket.oaApplication || {};
  const approvalRecords = approval.approvalRecords || [];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card
        title="OA 审批详情"
        extra={
          <Button onClick={() => router.push(`/tickets/${ticket.id}`)}>
            返回工单
          </Button>
        }
      >
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="OA 编号">{approval.oaId || '-'}</Descriptions.Item>
          <Descriptions.Item label="审批状态">{approval.status || '-'}</Descriptions.Item>
          <Descriptions.Item label="工单编号">{ticket.id}</Descriptions.Item>
          <Descriptions.Item label="工单状态">
            {STATUS_LABELS[ticket.status] || ticket.status || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="工单标题" span={2}>{ticket.title || '-'}</Descriptions.Item>
          <Descriptions.Item label="工单类型">
            {TOOL_TYPE_LABELS[ticket.toolType] || ticket.toolType || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="优先级">
            {ticket.priorityLabel || PRIORITY_LABELS[ticket.priority] || ticket.priority || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="提单人">{ticket.requesterName || '-'}</Descriptions.Item>
          <Descriptions.Item label="系统名称">
            {ticket.systemName || ticket.systemCode || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(approval.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatDateTime(approval.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="锁定状态">
            {ticket.oaLocked ? '已锁定' : '未锁定'}
          </Descriptions.Item>
          <Descriptions.Item label="正式工单">
            {ticket.formalTicketCreated ? '已生成' : '未生成'}
          </Descriptions.Item>
        </Descriptions>

        <Divider />
        <Typography.Title level={5}>审批记录</Typography.Title>
        {approvalRecords.length ? (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {approvalRecords.map((record) => (
              <Descriptions
                key={record.id || `${record.action}-${record.handledAt}`}
                column={2}
                size="small"
                bordered
              >
                <Descriptions.Item label="动作">{record.action || '-'}</Descriptions.Item>
                <Descriptions.Item label="处理人">{record.operatorName || '-'}</Descriptions.Item>
                <Descriptions.Item label="处理时间">{formatDateTime(record.handledAt)}</Descriptions.Item>
                <Descriptions.Item label="意见">{record.opinion || '-'}</Descriptions.Item>
                <Descriptions.Item label="附件" span={2}>
                  <AttachmentList attachments={record.attachments || []} compact />
                </Descriptions.Item>
              </Descriptions>
            ))}
          </Space>
        ) : (
          <Empty description="暂无审批记录" />
        )}
      </Card>
    </Space>
  );
}
