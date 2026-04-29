'use client';

import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Radio,
  Typography,
  App as AntdApp,
  Divider,
  Descriptions,
  Space,
  Tag
} from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES, ROLE_OPTIONS } from '../../constants/roles.js';
import { getDemoLoginAccountsByRole } from './demoAccounts.js';

/**
 * 登录页
 * - 支持 3 类角色的身份选择
 * - 登录成功后按角色跳转到工单列表
 * - 预设测试账号提示
 */
export default function LoginPage() {
  const { login, initialized, isAuthenticated } = useAuth();
  const router = useRouter();
  const { message } = AntdApp.useApp();
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm();

  const getRedirectTarget = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return '/tickets';
    }
    return new URLSearchParams(window.location.search).get('from') || '/tickets';
  }, []);

  React.useEffect(() => {
    if (initialized && isAuthenticated) {
      router.replace(getRedirectTarget());
    }
  }, [getRedirectTarget, initialized, isAuthenticated, router]);

  const handleFinish = async (values) => {
    setSubmitting(true);
    const { username, password, role } = values;
    const result = await login(username.trim(), password, role);
    setSubmitting(false);
    if (!result.ok) {
      message.error(result.reason || '登录失败');
      return;
    }
    message.success(`欢迎 ${result.user.name}`);
    router.replace(getRedirectTarget());
  };

  const fillDemo = (account) => {
    form.setFieldsValue({
      role: account.role,
      username: account.username,
      password: account.password
    });
  };

  const requesterAccounts = getDemoLoginAccountsByRole(ROLES.REQUESTER);
  const l1Accounts = getDemoLoginAccountsByRole(ROLES.L1);
  const l2Accounts = getDemoLoginAccountsByRole(ROLES.L2);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, #e6f4ff 0%, #f9f0ff 50%, #f0f5ff 100%)',
        padding: 24
      }}
    >
      <Card
        style={{ width: 520, boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}
        styles={{ body: { padding: 32 } }}
      >
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          ITSM 工单系统
        </Typography.Title>
        <Typography.Text type="secondary">
          请选择身份并登录以体验完整工单流程
        </Typography.Text>

        <Form
          form={form}
          layout="vertical"
          initialValues={{ role: ROLES.REQUESTER }}
          onFinish={handleFinish}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="role"
            label="身份"
            rules={[{ required: true, message: '请选择身份' }]}
          >
            <Radio.Group
              options={ROLE_OPTIONS}
              optionType="button"
              buttonStyle="solid"
            />
          </Form.Item>

          <Form.Item
            name="username"
            label="账号"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入账号" allowClear />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              block
              size="large"
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <Divider plain style={{ color: '#999' }}>测试账号 (点击可快速填充)</Divider>
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item
            label={<Tag color="blue">提单人</Tag>}
          >
            <Space wrap>
              {requesterAccounts.map((account) => (
                <Button key={account.username} size="small" onClick={() => fillDemo(account)}>
                  {account.username} / {account.password}
                </Button>
              ))}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item
            label={<Tag color="geekblue">一线技术支持</Tag>}
          >
            <Space wrap>
              {l1Accounts.map((account) => (
                <Button key={account.username} size="small" onClick={() => fillDemo(account)}>
                  {account.username} / {account.password}
                </Button>
              ))}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item
            label={<Tag color="purple">二线运维</Tag>}
          >
            <Space wrap>
              {l2Accounts.map((account) => (
                <Button key={account.username} size="small" onClick={() => fillDemo(account)}>
                  {account.username} / {account.password}
                </Button>
              ))}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
