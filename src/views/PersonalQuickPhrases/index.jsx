'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Input,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined
} from '@ant-design/icons';
import { validateQuickPhraseConfig } from '../../utils/quickPhrases.js';
import { shortId } from '../../utils/idGenerator.js';

const API_URL = '/api/config/personal/quick-phrases';

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

export default function PersonalQuickPhrasesPage() {
  const { message } = AntdApp.useApp();
  const [phrases, setPhrases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  const loadConfig = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载常用话术失败');
      }
      setPhrases(data.config?.phrases || []);
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '加载常用话术失败' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const addPhrase = () => {
    setPhrases((prev) => [
      ...prev,
      {
        id: shortId('phrase'),
        title: '',
        content: '',
        keywords: [],
        enabled: true
      }
    ]);
  };

  const updatePhrase = (phraseId, patch) => {
    setPhrases((prev) =>
      prev.map((phrase) => (phrase.id === phraseId ? { ...phrase, ...patch } : phrase))
    );
  };

  const removePhrase = (phraseId) => {
    setPhrases((prev) => prev.filter((phrase) => phrase.id !== phraseId));
  };

  const handleSave = async () => {
    const validation = validateQuickPhraseConfig({ phrases });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL, {
        method: 'PUT',
        body: JSON.stringify({ phrases })
      });
      if (!response.ok || data?.ok === false) {
        setErrors(data?.errors || [{ message: data?.reason || '保存常用话术失败' }]);
        return;
      }
      setPhrases(data.config?.phrases || []);
      message.success('常用话术已保存');
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '保存常用话术失败' }]);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '话术标题',
      dataIndex: 'title',
      width: 220,
      render: (value, record) => (
        <Input
          value={value}
          placeholder="例如：要求补充截图"
          onChange={(event) => updatePhrase(record.id, { title: event.target.value })}
        />
      )
    },
    {
      title: '关键词',
      dataIndex: 'keywords',
      width: 260,
      render: (value, record) => (
        <Input
          value={(value || []).join(', ')}
          placeholder="用逗号分隔，例如 截图, 路径"
          onChange={(event) => updatePhrase(record.id, { keywords: splitKeywords(event.target.value) })}
        />
      )
    },
    {
      title: '话术内容',
      dataIndex: 'content',
      render: (value, record) => (
        <Input.TextArea
          value={value}
          autoSize={{ minRows: 2, maxRows: 5 }}
          placeholder="输入要快捷插入到留言区的完整话术"
          onChange={(event) => updatePhrase(record.id, { content: event.target.value })}
        />
      )
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 110,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          checkedChildren="启用"
          unCheckedChildren="停用"
          onChange={(nextEnabled) => updatePhrase(record.id, { enabled: nextEnabled })}
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_value, record) => (
        <Popconfirm
          title="删除常用话术"
          description="确认删除这条常用话术？"
          onConfirm={() => removePhrase(record.id)}
        >
          <Button danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      )
    }
  ];

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      <Card>
        <div className="admin-config-toolbar">
          <Space direction="vertical" size={2}>
            <Typography.Title level={5} style={{ margin: 0 }}>常用话术维护</Typography.Title>
            <Typography.Text type="secondary">
              维护个人常用留言内容，在工单留言区输入 / 后可快速检索并插入。
            </Typography.Text>
          </Space>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadConfig} loading={loading}>
              刷新
            </Button>
            <Button icon={<PlusOutlined />} onClick={addPhrase}>
              新增话术
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
          message="配置校验失败"
          description={(
            <ul className="admin-config-error-list">
              {errors.map((error, index) => (
                <li key={`${error.message}_${index}`}>{error.message}</li>
              ))}
            </ul>
          )}
        />
      )}

      <Card
        title="常用话术"
        extra={<Tag color="blue">{phrases.length} 条</Tag>}
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={phrases}
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </Card>
    </Space>
  );
}

function splitKeywords(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
