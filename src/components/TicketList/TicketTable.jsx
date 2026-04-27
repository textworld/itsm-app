'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, Typography, Button, Tag, Space, Badge, Dropdown, App as AntdApp } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
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
import { getTicketListActions } from '../../utils/ticketListActions.js';
import { shortId } from '../../utils/idGenerator.js';

export default function TicketTable({ dataSource = [], showRequester = true }) {
  const router = useRouter();
  const { user } = useAuth();
  const { messageReads, dispatchEvent, addMessage } = useTickets();
  const { message, modal } = AntdApp.useApp();
  const sortedDataSource = useMemo(
    () => sortTicketsByPriorityAndCreatedAt(dataSource),
    [dataSource]
  );
  const { now, pulse } = useSlaClock(sortedDataSource);
  const showSlaColumn = shouldShowSlaColumn(user);

  const handleTicketAction = (record, action) => {
    if (!user || action.disabled) return;

    modal.confirm({
      title: action.confirmTitle,
      content: action.confirmDescription,
      okText: action.okText || '确认',
      cancelText: '取消',
      onOk: async () => {
        const result = await dispatchEvent(record.id, action.event, action.payload || {}, user);
        if (!result.ok) {
          message.error(result.reason || `${action.label}失败`);
          return;
        }

        const targetTicketId = result.ticket?.id || record.id;
        if (action.systemMessage) {
          await addMessage(targetTicketId, {
            id: shortId('m'),
            authorId: user.id,
            authorName: user.name,
            authorRole: user.role,
            content: action.systemMessage,
            attachments: [],
            createdAt: new Date().toISOString()
          });
        }

        message.success(action.successMessage || `${action.label}成功`);
        if (action.key === 'accept') {
          router.push(`/tickets/${targetTicketId}`);
        }
      }
    });
  };

  const columns = [
    {
      title: '工单编号',
      dataIndex: 'id',
      width: 240,
      fixed: 'left',
      render: (id, record) => (
        <Space size={8} wrap>
          <Button type="link" style={{ padding: 0 }} onClick={() => router.push(`/tickets/${id}`)}>
            {getTicketNumberDisplay(record)}
          </Button>
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
        <Typography.Link onClick={() => router.push(`/tickets/${record.id}`)}>
          {text}
        </Typography.Link>
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
      render: (type) => TOOL_TYPE_LABELS[type] || type
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
                    record.priority === PRIORITIES.P1 ? 'sla-remaining-p1' : ''
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
      width: 200,
      render: (_, record) => {
        const ticketActions = getTicketListActions(record, user);
        const directActions = ticketActions.slice(0, 2);
        const overflowActions = ticketActions.slice(2);

        return (
          <Space size={2} wrap>
            <Button type="link" size="small" onClick={() => router.push(`/tickets/${record.id}`)}>
              查看
            </Button>
            {directActions.map((action) => (
              <Button
                key={action.key}
                type="link"
                size="small"
                disabled={action.disabled}
                onClick={() => handleTicketAction(record, action)}
              >
                {action.label}
              </Button>
            ))}
            {overflowActions.length > 0 && (
              <Dropdown
                menu={{
                  items: overflowActions.map((action) => ({
                    key: action.key,
                    label: action.label,
                    disabled: action.disabled,
                    onClick: () => handleTicketAction(record, action)
                  }))
                }}
              >
                <Button type="text" size="small" icon={<MoreOutlined />} />
              </Dropdown>
            )}
          </Space>
        );
      }
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
          record.priority === PRIORITIES.P1 ? 'ticket-row-priority-p1' : '',
          isTicketOverdue(record, now) ? 'ticket-row-overdue' : ''
        ].filter(Boolean).join(' ')
      }
      pagination={{ pageSize: 10, showSizeChanger: true }}
    />
  );
}

function getVisibleStatus(ticket, user) {
  if (user?.role === ROLES.REQUESTER) {
    return getRequesterStatus(ticket);
  }
  return getSupportStatus(ticket);
}

function VisibleStatus({ ticket, user }) {
  const status = getVisibleStatus(ticket, user);
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
  const color = priority === PRIORITIES.P1
    ? 'red'
    : priority === PRIORITIES.P2
      ? 'orange'
      : priority === PRIORITIES.P3
        ? 'blue'
        : 'default';

  return (
    <Tag color={color} className={priority === PRIORITIES.P1 ? 'priority-tag-p1' : ''}>
      {PRIORITY_LABELS[priority] || priority || PRIORITY_LABELS[PRIORITIES.P4]}
    </Tag>
  );
}

function getPrioritySortValue(priority) {
  return PRIORITY_ORDER[priority] || PRIORITY_ORDER[PRIORITIES.P4];
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
