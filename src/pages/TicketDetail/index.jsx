import React, { useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Button, Result, Space, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useTickets } from '../../context/TicketContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import TicketInfoCard from '../../components/TicketDetail/TicketInfoCard.jsx';
import MessageBoard from '../../components/TicketDetail/MessageBoard.jsx';
import QuickMessageCard from '../../components/TicketDetail/QuickMessageCard.jsx';
import RequesterActions from '../../components/TicketDetail/RequesterActions.jsx';
import L1Actions from '../../components/TicketDetail/L1Actions.jsx';
import L2Actions from '../../components/TicketDetail/L2Actions.jsx';
import { ROLES } from '../../constants/roles.js';

/**
 * 工单处理页
 * 左侧 (16 栅格)：基本信息 + 流转轨迹 + 留言区
 * 右侧 (8  栅格)：按角色渲染操作区
 */
export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
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
          <Button type="primary" onClick={() => navigate('/tickets')}>
            返回工单列表
          </Button>
        }
      />
    );
  }

  const renderActions = () => {
    if (!user) return null;
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

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
        返回
      </Button>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <TicketInfoCard ticket={ticket} />
            <div ref={messageBoardRef}>
              <MessageBoard ticket={ticket} />
            </div>
          </Space>
        </Col>
        <Col xs={24} lg={8}>
          <div style={{ position: 'sticky', top: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {renderActions()}
              <QuickMessageCard ticket={ticket} onViewAllMessages={handleViewAllMessages} />
            </Space>
          </div>
        </Col>
      </Row>
    </Space>
  );
}
