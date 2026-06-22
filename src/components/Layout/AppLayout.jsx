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
  HistoryOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  CalendarOutlined,
  TeamOutlined,
  SearchOutlined,
  CoffeeOutlined,
  SettingOutlined,
  ProfileOutlined,
  FileTextOutlined,
  FileProtectOutlined,
  NotificationOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { ROLES, ROLE_LABELS } from '../../constants/roles.js';
import AnnouncementBanner from './AnnouncementBanner.jsx';

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
    if (user?.role === ROLES.L1 || user?.role === ROLES.L2) {
      base.push({
        key: '/tickets/history',
        icon: <HistoryOutlined />,
        label: <Link href="/tickets/history">历史工单</Link>
      });
      base.push({
        key: '/personal/quick-phrases',
        icon: <ProfileOutlined />,
        label: <Link href="/personal/quick-phrases">个人配置</Link>
      });
      base.push({
        key: '/announcements',
        icon: <NotificationOutlined />,
        label: <Link href="/announcements">公告管理</Link>
      });
    }
    if (user?.role === ROLES.ADMIN) {
      base.push({
        key: 'admin-management',
        icon: <SettingOutlined />,
        label: '后台管理',
        children: [
          {
            key: '/admin/users',
            icon: <TeamOutlined />,
            label: <Link href="/admin/users">账号管理</Link>
          },
          {
            key: '/admin/tickets',
            icon: <SearchOutlined />,
            label: <Link href="/admin/tickets">工单查询</Link>
          },
          {
            key: '/dictionaries/insurance-types',
            icon: <DatabaseOutlined />,
            label: <Link href="/dictionaries/insurance-types">险种词典</Link>
          },
          {
            key: '/systems',
            icon: <DatabaseOutlined />,
            label: <Link href="/systems">系统配置</Link>
          },
          {
            key: '/schedules',
            icon: <CalendarOutlined />,
            label: <Link href="/schedules">排班配置</Link>
          },
          {
            key: '/support-rests',
            icon: <CoffeeOutlined />,
            label: <Link href="/support-rests">休息时间配置</Link>
          },
          {
            key: '/solutions',
            icon: <FileTextOutlined />,
            label: <Link href="/solutions">标准解决方案库</Link>
          },
          {
            key: '/announcements',
            icon: <NotificationOutlined />,
            label: <Link href="/announcements">公告管理</Link>
          },
          {
            key: '/oa-simulator',
            icon: <FileProtectOutlined />,
            label: <Link href="/oa-simulator">OA 模拟审批台</Link>
          }
        ]
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
    if (pathname.startsWith('/tickets/history')) return '/tickets/history';
    if (pathname.startsWith('/personal/quick-phrases')) return '/personal/quick-phrases';
    if (pathname.startsWith('/admin/users')) return '/admin/users';
    if (pathname.startsWith('/admin/tickets')) return '/admin/tickets';
    if (pathname.startsWith('/dictionaries/insurance-types')) return '/dictionaries/insurance-types';
    if (pathname.startsWith('/systems')) return '/systems';
    if (pathname.startsWith('/schedules')) return '/schedules';
    if (pathname.startsWith('/support-rests')) return '/support-rests';
    if (pathname.startsWith('/solutions')) return '/solutions';
    if (pathname.startsWith('/announcements')) return '/announcements';
    if (pathname.startsWith('/oa-simulator')) return '/oa-simulator';
    if (pathname.startsWith('/tickets')) return '/tickets';
    if (pathname.startsWith('/state-machine')) return '/state-machine';
    return '/tickets';
  }, [pathname]);

  const isTicketDetailPage = pathname.startsWith('/tickets/') &&
    !pathname.startsWith('/tickets/new') &&
    !pathname.startsWith('/tickets/history');

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
      <AnnouncementBanner />
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
    case '/tickets/history':
      return '历史工单';
    case '/personal/quick-phrases':
      return '常用话术';
    case '/state-machine':
      return '工单流转规则';
    case '/admin/users':
      return '账号管理';
    case '/admin/tickets':
      return '工单查询';
    case '/dictionaries/insurance-types':
      return '险种词典';
    case '/systems':
      return '系统配置';
    case '/schedules':
      return '排班配置';
    case '/support-rests':
      return '休息时间配置';
    case '/solutions':
      return '标准解决方案库';
    case '/announcements':
      return '公告管理';
    case '/oa-simulator':
      return 'OA 模拟审批台';
    case '/tickets':
    default:
      return '工单列表';
  }
}
