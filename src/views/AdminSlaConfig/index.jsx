'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined
} from '@ant-design/icons';
import {
  SLA_CHANNELS,
  SLA_PRIORITIES,
  SLA_TIME_NODES,
  buildDefaultSlaConfig,
  validateSlaConfig
} from '../../utils/slaConfig.js';

const API_URL = '/api/admin/sla-rules';

const CHANNEL_LABELS = {
  DATA_EXTRACT: '生产系统数据提取',
  DATA_FIX: '生产系统数据修正',
  PERMISSION: '账号及权限申请',
  CONSULT: '常规咨询问题'
};

const PRIORITY_LABELS = {
  P0: 'P0（紧急）',
  P1: 'P1（高）',
  P2: 'P2（中）',
  P3: 'P3（低）'
};

const WARNING_NODE_OPTIONS = [
  { value: SLA_TIME_NODES.RESPONSE, label: '响应时效' },
  { value: SLA_TIME_NODES.FIRST_HANDLE, label: '首次处理时效' },
  { value: SLA_TIME_NODES.RESOLVE, label: '办结时效' }
];

const WARNING_TARGET_OPTIONS = [
  { value: 'ASSIGNEE', label: '当前处理人' },
  { value: 'GROUP_LEADER', label: '小组长' },
  { value: 'DEPARTMENT_LEADER', label: '部门负责人' },
  { value: 'ADMIN', label: '系统管理员' }
];

const NOTIFICATION_CHANNEL_OPTIONS = [
  { value: 'DINGTALK', label: '钉钉' },
  { value: 'SYSTEM', label: '系统消息' }
];

const ESCALATION_TARGET_OPTIONS = [
  { value: 'GROUP_LEADER', label: '小组长' },
  { value: 'DEPARTMENT_LEADER', label: '部门负责人' },
  { value: 'ADMIN', label: '系统管理员' }
];

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  return { response, data };
}

export default function AdminSlaConfigPage() {
  const { message } = AntdApp.useApp();
  const [config, setConfig] = useState(() => buildDefaultSlaConfig());
  const [activeChannel, setActiveChannel] = useState(SLA_CHANNELS[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  const loadConfig = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载 SLA 配置失败');
      }
      setConfig(data.config || buildDefaultSlaConfig());
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '加载 SLA 配置失败' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const tabs = useMemo(
    () => SLA_CHANNELS.map((channel) => ({ key: channel, label: CHANNEL_LABELS[channel] || channel })),
    []
  );

  const activeRows = useMemo(
    () => SLA_PRIORITIES.map((priority) => ({
      key: priority,
      priority,
      rule: config.rules?.[activeChannel]?.[priority] || {}
    })),
    [activeChannel, config]
  );

  const getRule = (source, channel, priority) =>
    source.rules?.[channel]?.[priority] || buildDefaultSlaConfig().rules[channel][priority];

  const updateRule = (channel, priority, patch) => {
    setConfig((prev) => ({
      ...prev,
      rules: {
        ...prev.rules,
        [channel]: {
          ...prev.rules?.[channel],
          [priority]: {
            ...getRule(prev, channel, priority),
            ...patch
          }
        }
      }
    }));
  };

  const updateWarning = (channel, priority, warningId, patch) => {
    const rule = getRule(config, channel, priority);
    updateRule(channel, priority, {
      warnings: rule.warnings.map((warning) =>
        warning.id === warningId ? { ...warning, ...patch } : warning
      )
    });
  };

  const addWarning = (channel, priority) => {
    const rule = getRule(config, channel, priority);
    updateRule(channel, priority, {
      warnings: [
        ...rule.warnings,
        {
          id: `warning_${Date.now()}`,
          node: SLA_TIME_NODES.RESPONSE,
          beforeMinutes: 60,
          targets: ['ASSIGNEE'],
          channels: ['DINGTALK'],
          frequencyMinutes: 60
        }
      ]
    });
  };

  const removeWarning = (channel, priority, warningId) => {
    const rule = getRule(config, channel, priority);
    updateRule(channel, priority, {
      warnings: rule.warnings.filter((warning) => warning.id !== warningId)
    });
  };

  const updateEscalation = (channel, priority, escalationId, patch) => {
    const rule = getRule(config, channel, priority);
    updateRule(channel, priority, {
      escalations: rule.escalations.map((escalation) =>
        escalation.id === escalationId ? { ...escalation, ...patch } : escalation
      )
    });
  };

  const addEscalation = (channel, priority) => {
    const rule = getRule(config, channel, priority);
    updateRule(channel, priority, {
      escalations: [
        ...rule.escalations,
        {
          id: `escalation_${Date.now()}`,
          afterMinutes: 60,
          target: 'GROUP_LEADER',
          useOrgHierarchy: true
        }
      ]
    });
  };

  const removeEscalation = (channel, priority, escalationId) => {
    const rule = getRule(config, channel, priority);
    updateRule(channel, priority, {
      escalations: rule.escalations.filter((escalation) => escalation.id !== escalationId)
    });
  };

  const handleSave = async () => {
    const validation = validateSlaConfig(config);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL, {
        method: 'PUT',
        body: JSON.stringify(validation.value)
      });
      if (!response.ok || data?.ok === false) {
        setErrors(data?.errors || [{ message: data?.reason || '保存 SLA 配置失败' }]);
        return;
      }
      setConfig(data.config || validation.value);
      message.success('SLA 配置已保存');
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '保存 SLA 配置失败' }]);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 130,
      render: (priority) => <Tag color={priority === 'P0' ? 'red' : 'blue'}>{PRIORITY_LABELS[priority]}</Tag>
    },
    {
      title: '规则状态',
      dataIndex: ['rule', 'enabled'],
      width: 120,
      render: (_, row) => (
        <Switch
          checked={row.rule.enabled !== false}
          checkedChildren="启用"
          unCheckedChildren="停用"
          onChange={(enabled) => updateRule(activeChannel, row.priority, { enabled })}
        />
      )
    },
    {
      title: '响应时效（分钟）',
      dataIndex: ['rule', 'responseMinutes'],
      render: (value, row) => (
        <InputNumber
          min={1}
          value={value}
          onChange={(nextValue) => updateRule(activeChannel, row.priority, { responseMinutes: nextValue })}
        />
      )
    },
    {
      title: '首次处理时效（分钟）',
      dataIndex: ['rule', 'firstHandleMinutes'],
      render: (value, row) => (
        <InputNumber
          min={1}
          value={value}
          onChange={(nextValue) => updateRule(activeChannel, row.priority, { firstHandleMinutes: nextValue })}
        />
      )
    },
    {
      title: '办结时效（分钟）',
      dataIndex: ['rule', 'resolveMinutes'],
      render: (value, row) => (
        <InputNumber
          min={1}
          value={value}
          onChange={(nextValue) => updateRule(activeChannel, row.priority, { resolveMinutes: nextValue })}
        />
      )
    },
    {
      title: '预警 / 升级',
      key: 'summary',
      width: 180,
      render: (_, row) => (
        <Space size={4} wrap>
          <Tag>多级预警 {row.rule.warnings?.length || 0}</Tag>
          <Tag>自动升级 {row.rule.escalations?.length || 0}</Tag>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      <Card>
        <div className="admin-config-toolbar">
          <Space direction="vertical" size={2}>
            <Typography.Title level={5} style={{ margin: 0 }}>SLA 配置</Typography.Title>
            <Typography.Text type="secondary">
              按工单通道和优先级维护响应、首次处理、办结时效，以及多级预警和自动升级规则。
            </Typography.Text>
          </Space>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadConfig} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              保存配置
            </Button>
          </Space>
        </div>
      </Card>

      {errors.length > 0 && (
        <Alert
          type="error"
          showIcon
          message="SLA 配置校验失败"
          description={(
            <ul className="admin-config-error-list">
              {errors.map((error, index) => (
                <li key={`${error.message}_${index}`}>{error.message}</li>
              ))}
            </ul>
          )}
        />
      )}

      <Card>
        <Spin spinning={loading}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Tabs activeKey={activeChannel} items={tabs} onChange={setActiveChannel} />
            <Table
              rowKey="priority"
              columns={columns}
              dataSource={activeRows}
              pagination={false}
              expandable={{
                expandedRowRender: (row) => (
                  <RuleDetails
                    channel={activeChannel}
                    priority={row.priority}
                    rule={row.rule}
                    onAddWarning={addWarning}
                    onUpdateWarning={updateWarning}
                    onRemoveWarning={removeWarning}
                    onAddEscalation={addEscalation}
                    onUpdateEscalation={updateEscalation}
                    onRemoveEscalation={removeEscalation}
                  />
                )
              }}
              locale={{ emptyText: <Empty description="暂无 SLA 规则" /> }}
            />
          </Space>
        </Spin>
      </Card>
    </Space>
  );
}

function RuleDetails({
  channel,
  priority,
  rule,
  onAddWarning,
  onUpdateWarning,
  onRemoveWarning,
  onAddEscalation,
  onUpdateEscalation,
  onRemoveEscalation
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div className="admin-config-toolbar">
        <Typography.Text strong>多级预警</Typography.Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => onAddWarning(channel, priority)}>
          添加预警
        </Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={rule.warnings || []}
        columns={[
          {
            title: '时效节点',
            dataIndex: 'node',
            render: (value, row) => (
              <Select
                value={value}
                options={WARNING_NODE_OPTIONS}
                style={{ width: 160 }}
                onChange={(node) => onUpdateWarning(channel, priority, row.id, { node })}
              />
            )
          },
          {
            title: '提前时间（分钟）',
            dataIndex: 'beforeMinutes',
            render: (value, row) => (
              <InputNumber
                min={1}
                value={value}
                onChange={(beforeMinutes) => onUpdateWarning(channel, priority, row.id, { beforeMinutes })}
              />
            )
          },
          {
            title: '预警对象',
            dataIndex: 'targets',
            render: (value, row) => (
              <Select
                mode="multiple"
                value={value}
                options={WARNING_TARGET_OPTIONS}
                style={{ minWidth: 220 }}
                onChange={(targets) => onUpdateWarning(channel, priority, row.id, { targets })}
              />
            )
          },
          {
            title: '通知渠道',
            dataIndex: 'channels',
            render: (value, row) => (
              <Select
                mode="multiple"
                value={value}
                options={NOTIFICATION_CHANNEL_OPTIONS}
                style={{ minWidth: 180 }}
                onChange={(channels) => onUpdateWarning(channel, priority, row.id, { channels })}
              />
            )
          },
          {
            title: '通知频率（分钟）',
            dataIndex: 'frequencyMinutes',
            render: (value, row) => (
              <InputNumber
                min={1}
                value={value}
                onChange={(frequencyMinutes) => onUpdateWarning(channel, priority, row.id, { frequencyMinutes })}
              />
            )
          },
          {
            title: '操作',
            width: 90,
            render: (_, row) => (
              <Popconfirm
                title="删除预警"
                description="确认删除这条预警配置？"
                onConfirm={() => onRemoveWarning(channel, priority, row.id)}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )
          }
        ]}
      />

      <div className="admin-config-toolbar">
        <Typography.Text strong>自动升级流程</Typography.Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => onAddEscalation(channel, priority)}>
          添加升级
        </Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={rule.escalations || []}
        columns={[
          {
            title: '超时后（分钟）',
            dataIndex: 'afterMinutes',
            render: (value, row) => (
              <InputNumber
                min={1}
                value={value}
                onChange={(afterMinutes) => onUpdateEscalation(channel, priority, row.id, { afterMinutes })}
              />
            )
          },
          {
            title: '升级对象',
            dataIndex: 'target',
            render: (value, row) => (
              <Select
                value={value}
                options={ESCALATION_TARGET_OPTIONS}
                style={{ width: 180 }}
                onChange={(target) => onUpdateEscalation(channel, priority, row.id, { target })}
              />
            )
          },
          {
            title: '钉钉组织架构联动',
            dataIndex: 'useOrgHierarchy',
            render: (value, row) => (
              <Switch
                checked={value}
                checkedChildren="启用"
                unCheckedChildren="停用"
                onChange={(useOrgHierarchy) =>
                  onUpdateEscalation(channel, priority, row.id, { useOrgHierarchy })}
              />
            )
          },
          {
            title: '操作',
            width: 90,
            render: (_, row) => (
              <Popconfirm
                title="删除升级"
                description="确认删除这条自动升级配置？"
                onConfirm={() => onRemoveEscalation(channel, priority, row.id)}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )
          }
        ]}
      />
    </Space>
  );
}
