'use client';

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
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { ROLES, ROLE_LABELS } from '../../constants/roles.js';

const { Header, Content } = Layout;

/**
 * 上下布局
 * - 顶部 Header：系统标题 + 顶部菜单 + 用户信息
 * - 下方 Content：页面标题 + 子路由渲染入口
 */
export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { resetData } = useTickets();
  const { message } = AntdApp.useApp();
  const pathname = usePathname();
  const router = useRouter();

  const handleResetData = async () => {
    try {
      await resetData();
      message.success('已按 mock 数据重新初始化 SQLite 中的工单与缺陷');
    } catch (error) {
      console.error(error);
      message.error('初始化数据失败');
    }
  };

  const menuItems = useMemo(() => {
    const base = [
      {
        key: '/tickets',
        icon: <UnorderedListOutlined />,
        label: <Link href="/tickets">工单列表</Link>
      }
    ];
    if (user?.role === ROLES.REQUESTER) {
      base.push({
        key: '/tickets/new',
        icon: <PlusCircleOutlined />,
        label: <Link href="/tickets/new">提交工单</Link>
      });
    }
    base.push({
      key: '/state-machine',
      icon: <NodeIndexOutlined />,
      label: <Link href="/state-machine">流转规则</Link>
    });
    return base;
  }, [user]);

  const selectedKey = useMemo(() => {
    if (pathname.startsWith('/tickets/new')) return '/tickets/new';
    if (pathname.startsWith('/tickets')) return '/tickets';
    if (pathname.startsWith('/state-machine')) return '/state-machine';
    return '/tickets';
  }, [pathname]);

  const isTicketDetailPage = pathname.startsWith('/tickets/') && !pathname.startsWith('/tickets/new');

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
      <Header className="app-shell-header">
        <div className="app-shell-header-main">
          <div className="app-shell-brand">
            <Typography.Title level={4} className="app-shell-brand-title">
              ITSM 工单系统
            </Typography.Title>
            <Typography.Text className="app-shell-brand-subtitle">
              Enterprise Service Desk
            </Typography.Text>
          </div>
          <Space size="middle" wrap className="app-shell-toolbar">
            {user && (
              <Tag color="blue" className="app-shell-role-tag">
                {ROLE_LABELS[user.role] || user.role}
              </Tag>
            )}
            <Popconfirm
              title="初始化数据"
              description="将根据 mock 数据重置 SQLite 中的工单与缺陷，已有修改会丢失，确认继续？"
              okText="确认初始化"
              cancelText="取消"
              onConfirm={handleResetData}
            >
              <Button type="text" icon={<ReloadOutlined />} className="app-shell-toolbar-button">
                初始化数据
              </Button>
            </Popconfirm>
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
              <Space className="app-shell-user-trigger">
                <Avatar icon={<UserOutlined />} />
                <span>{user?.name || '未登录'}</span>
              </Space>
            </Dropdown>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className="app-shell-toolbar-button"
            >
              登出
            </Button>
          </Space>
        </div>
        <div className="app-shell-nav">
          <Menu
            mode="horizontal"
            theme="dark"
            selectedKeys={[selectedKey]}
            items={menuItems}
          />
        </div>
      </Header>
      <Content className="app-shell-content">
        <div className="app-shell-content-inner">
          {!isTicketDetailPage && (
            <Typography.Title level={4} className="app-shell-page-title">
              {pageTitle(selectedKey)}
            </Typography.Title>
          )}
          {children}
        </div>
      </Content>
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
