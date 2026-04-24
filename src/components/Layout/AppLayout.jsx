import React, { useMemo } from 'react';
import {
  Layout,
  Menu,
  Typography,
  Space,
  Tag,
  Dropdown,
  Avatar,
  Button,
  Popconfirm,
  App as AntdApp
} from 'antd';
import {
  UnorderedListOutlined,
  PlusCircleOutlined,
  LogoutOutlined,
  UserOutlined,
  NodeIndexOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { ROLES, ROLE_LABELS } from '../../constants/roles.js';

const { Header, Sider, Content } = Layout;

/**
 * 三栏布局
 * - 左 Sider：菜单根据角色变化
 * - 顶 Header：系统标题 + 用户信息 + 登出
 * - 中 Content：子路由渲染入口
 */
export default function AppLayout() {
  const { user, logout } = useAuth();
  const { resetData } = useTickets();
  const { message } = AntdApp.useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const handleResetData = () => {
    resetData();
    message.success('已按 mock 数据重新初始化 localStorage 中的工单与缺陷');
  };

  const menuItems = useMemo(() => {
    const base = [
      {
        key: '/tickets',
        icon: <UnorderedListOutlined />,
        label: <Link to="/tickets">工单列表</Link>
      }
    ];
    if (user?.role === ROLES.REQUESTER) {
      base.push({
        key: '/tickets/new',
        icon: <PlusCircleOutlined />,
        label: <Link to="/tickets/new">提交工单</Link>
      });
    }
    base.push({
      key: '/state-machine',
      icon: <NodeIndexOutlined />,
      label: <Link to="/state-machine">流转规则</Link>
    });
    return base;
  }, [user]);

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/tickets/new')) return '/tickets/new';
    if (location.pathname.startsWith('/tickets')) return '/tickets';
    if (location.pathname.startsWith('/state-machine')) return '/state-machine';
    return '/tickets';
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220} breakpoint="lg" collapsible>
        <div
          style={{
            color: '#fff',
            padding: '16px',
            fontWeight: 600,
            fontSize: 16,
            borderBottom: '1px solid rgba(255,255,255,0.15)'
          }}
        >
          ITSM 工单系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            {pageTitle(selectedKey)}
          </Typography.Title>
          <Space size="middle">
            {user && (
              <Tag color="blue">{ROLE_LABELS[user.role] || user.role}</Tag>
            )}
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                    onClick: handleLogout
                  }
                ]
              }}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.name || '未登录'}</span>
              </Space>
            </Dropdown>
            <Popconfirm
              title="初始化数据"
              description="将根据 mock 数据重置 localStorage 中的工单与缺陷，已有修改会丢失，确认继续？"
              okText="确认初始化"
              cancelText="取消"
              onConfirm={handleResetData}
            >
              <Button type="link" icon={<ReloadOutlined />}>
                初始化数据
              </Button>
            </Popconfirm>
            <Button type="link" icon={<LogoutOutlined />} onClick={handleLogout}>
              登出
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

function pageTitle(key) {
  switch (key) {
    case '/tickets/new':
      return '提交工单';
    case '/state-machine':
      return '工单流转规则';
    case '/tickets':
    default:
      return '工单列表';
  }
}
