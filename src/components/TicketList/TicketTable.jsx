'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, Typography, Button, Tag, Space, Badge, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import StatusTag from '../common/StatusTag.jsx';
import { ROLES } from '../../constants/roles.js';
import {
  PROCESSING_SUB_STATUS_LABELS,
  STATUS,
  getProcessingSubStatus,
  getRequesterStatus,
  getSupportStatus
} from '../../constants/ticketStatus.js';
import { TOOL_TYPE_LABELS } from '../../constants/toolTypes.js';
import { SUBTASK_STATUS_LABELS } from '../../constants/subtaskStatus.js';
import { PRIORITIES, PRIORITY_LABELS, PRIORITY_ORDER } from '../../constants/priorities.js';
import { formatDateTime } from '../../utils/format.js';
import {
  formatTicketRemaining,
  getTicketExpiresAt,
  isTicketOverdue,
  shouldUseSecondRefresh,
  sortTicketsByPriorityAndCreatedAt
} from '../../utils/sla.js';
import {
  getAssigneeColumnTitle,
  getAssigneeDisplay,
  getTicketNumberDisplay,
  getTitleColumnWidth,
  getTitleColumnTitle,
  shouldShowStatusSubLabel,
  shouldShowSlaColumn
} from '../../utils/ticketListDisplay.js';

export default function TicketTable({ dataSource = [], showRequester = true }) {
  const router = useRouter();
  const { user } = useAuth();
  const { messageReads } = useTickets();
  const sortedDataSource = useMemo(
    () => sortTicketsByPriorityAndCreatedAt(dataSource),
    [dataSource]
  );
  const { now, pulse } = useSlaClock(sortedDataSource);
  const showSlaColumn = shouldShowSlaColumn(user);

  const columns = [
    {
      title: '工单编号',
      dataIndex: 'id',
      width: 240,
      fixed: 'left',
      render: (id, record) => (
        <Space size={8} wrap>
          <Space size={4} wrap={false}>
            <Button type="link" style={{ padding: 0 }} onClick={() => router.push(`/tickets/${id}`)}>
              {getTicketNumberDisplay(record)}
            </Button>
            <CopyTextButton copyableText={getTicketNumberDisplay(record)} label="工单编号" />
          </Space>
          <UnreadMessageBadge
            ticket={record}
            user={user}
            messageReads={messageReads}
            compact
          />
        </Space>
      )
    },
    {
      title: getTitleColumnTitle(user),
      width: getTitleColumnWidth(user),
      dataIndex: 'title',
      ellipsis: true,
      render: (text, record) => (
        <Space size={4} wrap={false}>
          <Typography.Link onClick={() => router.push(`/tickets/${record.id}`)}>
            {text}
          </Typography.Link>
          <CopyTextButton copyableText={text} label="工单标题" />
        </Space>
      )
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 120,
      render: (priority) => <PriorityTag priority={priority} />,
      sorter: (left, right) => getPrioritySortValue(left.priority) - getPrioritySortValue(right.priority)
    },
    {
      title: '工单类型',
      dataIndex: 'toolType',
      width: 150,
      render: (_, record) => getTicketTypeDisplay(record)
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_, record) => <VisibleStatus ticket={record} user={user} />
    },
    ...(showSlaColumn
      ? [
          {
            title: 'SLA剩余',
            dataIndex: 'expiresAt',
            width: 170,
            render: (_, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text
                  className={[
                    'sla-remaining-text',
                    pulse ? 'sla-remaining-refreshing' : '',
                    isTicketOverdue(record, now) ? 'sla-remaining-overdue' : '',
                    record.priority === PRIORITIES.P0 ? 'sla-remaining-p0' : ''
                  ].filter(Boolean).join(' ')}
                >
                  {formatTicketRemaining(record, now)}
                </Typography.Text>
                <Typography.Text type="secondary" className="sla-expire-time">
                  到期：{formatDateTime(getTicketExpiresAt(record))}
                </Typography.Text>
              </Space>
            )
          }
        ]
      : []),
    ...(showRequester
      ? [
          {
            title: '提单人',
            dataIndex: 'requesterName',
            width: 160
          }
        ]
      : []),
    {
      title: getAssigneeColumnTitle(user),
      width: 200,
      render: (_, record) => getAssigneeDisplay(record, user)
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (value) => formatDateTime(value),
      sorter: (left, right) => new Date(left.createdAt) - new Date(right.createdAt)
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      render: (value) => formatDateTime(value)
    },
    {
      title: '操作',
      fixed: 'right',
      width: 90,
      render: (_, record) => (
        <Space size={2} wrap>
          <Button type="link" size="small" onClick={() => router.push(`/tickets/${record.id}`)}>
            查看
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Table
      rowKey="id"
      size="middle"
      scroll={{ x: 1500 }}
      columns={columns}
      dataSource={sortedDataSource}
      rowClassName={(record) =>
        [
          record.priority === PRIORITIES.P0 ? 'ticket-row-priority-p0' : '',
          isTicketOverdue(record, now) ? 'ticket-row-overdue' : ''
        ].filter(Boolean).join(' ')
      }
      pagination={{ pageSize: 10, showSizeChanger: true }}
    />
  );
}

function CopyTextButton({ copyableText, label }) {
  return (
    <Button
      type="text"
      size="small"
      icon={<CopyOutlined />}
      aria-label={`复制${label}`}
      title={`复制${label}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        handleCopyText(copyableText, label);
      }}
    />
  );
}

async function handleCopyText(text, label) {
  const value = String(text || '');
  if (!value) {
    message.warning(`${label}为空，无法复制`);
    return;
  }

  try {
    await copyTextToClipboard(value);
    message.success(`${label}已复制`);
  } catch (error) {
    console.error(error);
    message.error(`${label}复制失败`);
  }
}

async function copyTextToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('copy command failed');
  }
}

function getVisibleStatus(ticket, user) {
  if (ticket?.isSubtask) {
    return ticket.subtaskStatus;
  }
  if (user?.role === ROLES.REQUESTER) {
    return getRequesterStatus(ticket);
  }
  return getSupportStatus(ticket);
}

function VisibleStatus({ ticket, user }) {
  const status = getVisibleStatus(ticket, user);
  if (ticket?.isSubtask) {
    return <Tag color={status === 'COMPLETED' ? 'success' : status === 'PROCESSING' ? 'processing' : 'warning'}>{SUBTASK_STATUS_LABELS[status] || status}</Tag>;
  }
  const subStatus =
    shouldShowStatusSubLabel(user) && status === STATUS.PROCESSING
      ? getProcessingSubStatus(ticket)
      : null;
  return (
    <Space direction="vertical" size={0}>
      <StatusTag status={status} />
      {subStatus && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {PROCESSING_SUB_STATUS_LABELS[subStatus]}
        </Typography.Text>
      )}
    </Space>
  );
}

function getTicketTypeDisplay(ticket) {
  if (ticket?.isSubtask) return '子任务';
  return TOOL_TYPE_LABELS[ticket?.toolType] || ticket?.toolType;
}

function UnreadMessageBadge({ ticket, user, messageReads, compact = false }) {
  const messages = ticket.messages || [];
  const latestMessage = [...messages].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )[0];
  const readKey = user ? `${user.id}:${ticket.id}` : '';
  const lastReadTime = messageReads?.[readKey]
    ? new Date(messageReads[readKey]).getTime()
    : 0;
  const unreadCount = user
    ? messages.filter((message) => {
        if (message.authorId === user.id) return false;
        return new Date(message.createdAt).getTime() > lastReadTime;
      }).length
    : 0;

  if (!messages.length) {
    return <Typography.Text type="secondary">暂无回复</Typography.Text>;
  }

  return (
    unreadCount > 0 ? (
      <Badge
        count={`未读 ${unreadCount}`}
        className={`ticket-unread-badge${compact ? ' ticket-unread-badge-compact' : ''}`}
      />
    ) : (
      <Tag color="success" className={`ticket-read-tag${compact ? ' ticket-read-tag-compact' : ''}`}>全部已读</Tag>
    )
  );
}

function PriorityTag({ priority }) {
  const color = priority === PRIORITIES.P0
    ? 'red'
    : priority === PRIORITIES.P1
      ? 'orange'
      : priority === PRIORITIES.P2
        ? 'blue'
        : 'default';

  return (
    <Tag color={color} className={priority === PRIORITIES.P0 ? 'priority-tag-p0' : ''}>
      {PRIORITY_LABELS[priority] || priority || PRIORITY_LABELS[PRIORITIES.P3]}
    </Tag>
  );
}

function getPrioritySortValue(priority) {
  return PRIORITY_ORDER[priority] || PRIORITY_ORDER[PRIORITIES.P3];
}

function useSlaClock(tickets) {
  const [now, setNow] = useState(Date.now());
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const refreshBySecond = shouldUseSecondRefresh(tickets, now);
    const delay = refreshBySecond ? 1000 : 60 * 1000;
    let pulseTimer;

    const timer = window.setTimeout(() => {
      setNow(Date.now());

      if (!refreshBySecond) {
        setPulse(true);
        pulseTimer = window.setTimeout(() => setPulse(false), 900);
      }
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (pulseTimer) window.clearTimeout(pulseTimer);
    };
  }, [tickets, now]);

  return { now, pulse };
}
