'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Row, Col, Button, Result, Space, Spin, Tabs, Card, Timeline, Typography, Empty } from 'antd';
import { useTickets } from '../../context/TicketContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import TicketInfoCard from '../../components/TicketDetail/TicketInfoCard.jsx';
import MessageBoard from '../../components/TicketDetail/MessageBoard.jsx';
import QuickMessageCard from '../../components/TicketDetail/QuickMessageCard.jsx';
import RequesterActions from '../../components/TicketDetail/RequesterActions.jsx';
import L1Actions from '../../components/TicketDetail/L1Actions.jsx';
import L2Actions from '../../components/TicketDetail/L2Actions.jsx';
import SubtaskActions from '../../components/TicketDetail/SubtaskActions.jsx';
import SubtaskPanel from '../../components/TicketDetail/SubtaskPanel.jsx';
import CustomTicketTags from '../../components/TicketDetail/CustomTicketTags.jsx';
import { ROLE_LABELS, ROLES } from '../../constants/roles.js';
import { STATUS, getRequesterStatus } from '../../constants/ticketStatus.js';
import { TicketSubmitForm } from '../TicketSubmit/index.jsx';
import { formatDateTime } from '../../utils/format.js';

/**
 * 工单处理页
 * 左侧 (16 栅格)：基本信息 + 流转轨迹 + 留言区
 * 右侧 (8  栅格)：按角色渲染操作区
 */
export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const { tickets, initialized, markMessagesRead } = useTickets();
  const { user } = useAuth();
  const messageBoardRef = useRef(null);

  const ticket = useMemo(() => tickets.find((t) => t.id === id), [tickets, id]);

  useEffect(() => {
    if (!ticket || !user) return;
    markMessagesRead(ticket.id, user.id);
  }, [ticket, user, markMessagesRead]);

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
        title="工单不存在"
        subTitle={`工单号：${id}`}
        extra={
          <Button type="primary" onClick={() => router.push('/tickets')}>
            返回工单列表
          </Button>
        }
      />
    );
  }

  const isDraftTicket = getRequesterStatus(ticket) === STATUS.DRAFT;

  const renderActions = () => {
    if (!user) return null;
    if (ticket.isSubtask) return <SubtaskActions ticket={ticket} />;
    if (user.role === ROLES.REQUESTER) return <RequesterActions ticket={ticket} />;
    if (user.role === ROLES.L1) return <L1Actions ticket={ticket} />;
    if (user.role === ROLES.L2) return <L2Actions ticket={ticket} />;
    return null;
  };

  const handleViewAllMessages = () => {
    messageBoardRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  const detailTabs = [
    {
      key: 'info',
      label: '工单信息',
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <TicketInfoCard ticket={ticket} />
          <div ref={messageBoardRef}>
            <MessageBoard ticket={ticket} />
          </div>
        </Space>
      )
    },
    {
      key: 'timeline',
      label: '流转轨迹',
      children: <TicketTimeline ticket={ticket} />
    },
    {
      key: 'subtasks',
      label: '子任务',
      children: ticket.isSubtask ? (
        <Card title="父工单">
          <Button type="link" onClick={() => router.push(`/tickets/${ticket.parentTicketId}`)}>
            查看父工单 {ticket.parentTicketId}
          </Button>
        </Card>
      ) : (
        <SubtaskPanel ticket={ticket} />
      )
    }
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {isDraftTicket ? (
              <TicketSubmitForm draftTicket={ticket} />
            ) : (
              <Tabs className="ticket-detail-sticky-tabs" items={detailTabs} />
            )}
          </Space>
        </Col>
        <Col xs={24} lg={8}>
          <div style={{ position: 'sticky', top: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card title="自定义标签">
                <CustomTicketTags ticket={ticket} />
              </Card>
              {renderActions()}
              {!isDraftTicket && <QuickMessageCard ticket={ticket} onViewAllMessages={handleViewAllMessages} />}
            </Space>
          </div>
        </Col>
      </Row>
    </Space>
  );
}

function TicketTimeline({ ticket }) {
  const items = (ticket.timeline || []).map((timelineItem) => ({
    color: colorOfRole(timelineItem.role),
    children: (
      <Space direction="vertical" size={0}>
        <Typography.Text strong>{timelineItem.actionLabel || timelineItem.action}</Typography.Text>
        <Typography.Text type="secondary">
          {formatDateTime(timelineItem.at)} · {timelineItem.operator}
          {timelineItem.role ? `（${ROLE_LABELS[timelineItem.role] || timelineItem.role}）` : ''}
        </Typography.Text>
        {timelineItem.remark && <Typography.Text>{timelineItem.remark}</Typography.Text>}
      </Space>
    )
  }));

  return (
    <Card title="流转轨迹">
      {items.length ? <Timeline items={items} /> : <Empty description="暂无流转轨迹" />}
    </Card>
  );
}

function colorOfRole(role) {
  switch (role) {
    case ROLES.REQUESTER:
      return 'blue';
    case ROLES.L1:
      return 'green';
    case ROLES.L2:
      return 'red';
    default:
      return 'gray';
  }
}
