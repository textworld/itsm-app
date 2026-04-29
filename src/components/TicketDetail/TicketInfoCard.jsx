import React from 'react';
import { Button, Card, Descriptions, Typography, Space, Divider, Tag } from 'antd';
import StatusTag from '../common/StatusTag.jsx';
import AttachmentList from '../common/AttachmentList.jsx';
import RichContentPreview from '../common/RichContentPreview.jsx';
import DescriptionHistoryModal from './DescriptionHistoryModal.jsx';
import DraftTicketEditButton from './DraftTicketEditButton.jsx';
import {
  PROCESSING_SUB_STATUS_LABELS,
  STATUS,
  getProcessingSubStatus,
  getRequesterStatus,
  getSupportStatus
} from '../../constants/ticketStatus.js';
import { TOOL_TYPE_LABELS } from '../../constants/toolTypes.js';
import { PRIORITY_LABELS } from '../../constants/priorities.js';
import { ROLES } from '../../constants/roles.js';
import { formatDateTime } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function TicketInfoCard({ ticket }) {
  const { user } = useAuth();
  const [historyOpen, setHistoryOpen] = React.useState(false);

  if (!ticket) return null;

  return (
    <Card
      title="工单基本信息"
      extra={<DraftTicketEditButton ticket={ticket} />}
      >
      <div className="ticket-assignee-summary">
        <div className="ticket-assignee-summary-item">
          <Typography.Text type="secondary">一线处理人</Typography.Text>
          <Typography.Text strong className="ticket-assignee-highlight">
            {ticket.assigneeL1Name || '-'}
          </Typography.Text>
        </div>
        {user?.role !== ROLES.REQUESTER && (
          <div className="ticket-assignee-summary-item">
            <Typography.Text type="secondary">二线处理人</Typography.Text>
            <Typography.Text strong className="ticket-assignee-highlight">
              {ticket.assigneeL2Name || '-'}
            </Typography.Text>
          </div>
        )}
      </div>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="工单编号">{ticket.id}</Descriptions.Item>
        <Descriptions.Item label="提单人状态">
          <StatusTag status={getRequesterStatus(ticket)} />
        </Descriptions.Item>
        <Descriptions.Item label="技术支持状态">
          <StatusTag status={getSupportStatus(ticket)} />
        </Descriptions.Item>
        {getSupportStatus(ticket) === STATUS.PROCESSING && (
          <Descriptions.Item label="处理子状态">
            {PROCESSING_SUB_STATUS_LABELS[getProcessingSubStatus(ticket)] || '-'}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="工单标题" span={2}>
          {ticket.title}
        </Descriptions.Item>
        <Descriptions.Item label="工单类型">
          {TOOL_TYPE_LABELS[ticket.toolType] || ticket.toolType}
        </Descriptions.Item>
        <Descriptions.Item label="优先级">
          {ticket.priorityLabel || PRIORITY_LABELS[ticket.priority] || ticket.priority || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="系统名称">
          {ticket.systemName || ticket.systemCode || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="提单人">{ticket.requesterName}</Descriptions.Item>
        <Descriptions.Item label="手机号码">
          {ticket.reporterPhone || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="邮箱">
          {ticket.reporterEmail || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="是否替他人上报">
          {ticket.reportForOthers ? '是' : '否'}
        </Descriptions.Item>
        <Descriptions.Item label="上报人姓名">
          {ticket.reportForOthers ? ticket.reportedUserName || '-' : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="上报人手机">
          {ticket.reportForOthers ? ticket.reportedUserPhone || '-' : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {formatDateTime(ticket.createdAt)}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {formatDateTime(ticket.updatedAt)}
        </Descriptions.Item>
      </Descriptions>

      <Divider />
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Space>
          <Typography.Title level={5} style={{ margin: 0 }}>问题描述</Typography.Title>
          <Tag color="blue">历史版本 {ticket.descriptionHistory?.length || 1}</Tag>
        </Space>
        <Button size="small" onClick={() => setHistoryOpen(true)}>
          查看历史记录
        </Button>
      </Space>
      <div className="ticket-description-section">
        <RichContentPreview
          className="ticket-rich-description"
          doc={ticket.descriptionDoc}
          html={ticket.descriptionHtml}
          text={ticket.description}
        />
      </div>
      <DescriptionHistoryModal
        ticket={ticket}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <Divider />
      <Typography.Title level={5}>附件</Typography.Title>
      <div className="ticket-attachment-section">
        <AttachmentList attachments={ticket.attachments} compact />
      </div>

      {ticket.defectTag && (
        <>
          <Divider />
          <Typography.Title level={5}>缺陷打标</Typography.Title>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="缺陷类型">{ticket.defectTag.type}</Descriptions.Item>
            <Descriptions.Item label="缺陷描述">{ticket.defectTag.description}</Descriptions.Item>
            <Descriptions.Item label="打标人">{ticket.defectTag.taggedBy}</Descriptions.Item>
            <Descriptions.Item label="打标时间">
              {formatDateTime(ticket.defectTag.taggedAt)}
            </Descriptions.Item>
          </Descriptions>
        </>
      )}

      {ticket.linkedDefect && (
        <>
          <Divider />
          <Typography.Title level={5}>关联项目缺陷</Typography.Title>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="缺陷 ID">
              {ticket.linkedDefect.defectId}
              {ticket.linkedDefect.isNew && (
                <Typography.Text type="success">（本工单新建）</Typography.Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="优先级">
              {ticket.linkedDefect.priority}
            </Descriptions.Item>
            <Descriptions.Item label="标题" span={2}>
              {ticket.linkedDefect.title}
            </Descriptions.Item>
            <Descriptions.Item label="模块">
              {ticket.linkedDefect.module}
            </Descriptions.Item>
          </Descriptions>
        </>
      )}

      {ticket.l2Conclusion && (
        <>
          <Divider />
          <Typography.Title level={5}>二线排查结论</Typography.Title>
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
            {ticket.l2Conclusion}
          </Typography.Paragraph>
        </>
      )}

      {ticket.summary && (
        <>
          <Divider />
          <Typography.Title level={5}>
            工单总结{ticket.summarySyncedToCorpus ? '（已同步语料库）' : ''}
          </Typography.Title>
          <RichContentPreview
            className="ticket-rich-summary"
            html={ticket.summary}
            text={ticket.summary}
          />
        </>
      )}

      {ticket.aiResolved && (
        <>
          <Divider />
          <Typography.Title level={5}>大模型解决</Typography.Title>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="解决方式">
              <Tag color="purple">大模型解决</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="解决时间">
              {formatDateTime(ticket.aiResolution?.resolvedAt || ticket.closedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="大模型答复">
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                {ticket.aiResolution?.answer || '-'}
              </Typography.Paragraph>
            </Descriptions.Item>
          </Descriptions>
        </>
      )}

      {ticket.rejectionReason && (
        <>
          <Divider />
          <Typography.Title level={5}>最近驳回原因</Typography.Title>
          <Typography.Paragraph type="danger" style={{ whiteSpace: 'pre-wrap' }}>
            {ticket.rejectionReason}
          </Typography.Paragraph>
        </>
      )}

      {ticket.withdrawalReason && (
        <>
          <Divider />
          <Typography.Title level={5}>最近撤回说明</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
            {ticket.withdrawalReason}
          </Typography.Paragraph>
        </>
      )}

      {ticket.satisfaction && (
        <>
          <Divider />
          <Typography.Title level={5}>
            满意度评价（{ticket.satisfaction.rating}/5）
          </Typography.Title>
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
            {ticket.satisfaction.comment || '未填写评价文本'}
          </Typography.Paragraph>
        </>
      )}

    </Card>
  );
}
