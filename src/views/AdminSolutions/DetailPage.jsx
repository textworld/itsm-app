'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography
} from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';

const API_URL = '/api/admin/solutions';
const THIRD_PARTY_SCHEMES_API_URL = '/api/admin/third-party-data-fix-schemes';

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

export default function AdminSolutionDetailPage({ solutionId }) {
  const router = useRouter();
  const { message } = AntdApp.useApp();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [thirdPartyOptions, setThirdPartyOptions] = useState([]);
  const [thirdPartyLoading, setThirdPartyLoading] = useState(false);
  const [references, setReferences] = useState([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referenceSearchKeyword, setReferenceSearchKeyword] = useState('');
  const [referencePagination, setReferencePagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [form] = Form.useForm();

  const solution = detail?.solution || null;

  const loadSolutionDetail = async () => {
    setLoading(true);
    try {
      const { response, data } = await requestJson(`${API_URL}/${solutionId}`);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载方案详情失败');
      }
      setDetail(data);
    } catch (error) {
      console.error(error);
      message.error(error.message || '加载方案详情失败');
    } finally {
      setLoading(false);
    }
  };

  const mergeThirdPartyOptions = (items = []) => {
    setThirdPartyOptions((current) => {
      const map = new Map(current.map((item) => [item.id, item]));
      for (const item of items) {
        if (item?.id) map.set(item.id, item);
      }
      return [...map.values()];
    });
  };

  const loadThirdPartySchemes = async (keyword = '') => {
    setThirdPartyLoading(true);
    try {
      const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
      const { response, data } = await requestJson(`${THIRD_PARTY_SCHEMES_API_URL}${query}`);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载第三方数据修正方案失败');
      }
      mergeThirdPartyOptions(data.schemes || []);
    } catch (error) {
      console.error(error);
      message.error(error.message || '加载第三方数据修正方案失败');
    } finally {
      setThirdPartyLoading(false);
    }
  };

  const loadReferences = async ({ page = 1, pageSize = referencePagination.pageSize, keyword = referenceSearchKeyword } = {}) => {
    setReferencesLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (keyword) params.set('keyword', keyword);
      const { response, data } = await requestJson(`${API_URL}/${solutionId}/references?${params.toString()}`);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载引用工单失败');
      }
      setReferences(data.references || []);
      setReferencePagination(data.pagination || { page, pageSize, total: 0 });
    } catch (error) {
      console.error(error);
      message.error(error.message || '加载引用工单失败');
    } finally {
      setReferencesLoading(false);
    }
  };

  useEffect(() => {
    loadSolutionDetail();
    loadReferences({ page: 1, pageSize: 10, keyword: '' });
  }, [solutionId]);

  const openEditModal = () => {
    if (!solution) return;
    if (solution.thirdPartyDataFixScheme?.id) {
      mergeThirdPartyOptions([solution.thirdPartyDataFixScheme]);
    }
    form.setFieldsValue({
      code: solution.code,
      title: solution.title,
      description: solution.description,
      detail: solution.detailText || solution.description,
      thirdPartyDataFixSchemeId: solution.thirdPartyDataFixScheme?.id || undefined,
      enabled: solution.enabled !== false
    });
    loadThirdPartySchemes();
    setModalOpen(true);
  };

  const findThirdPartyOption = (id) => thirdPartyOptions.find((item) => item.id === id) || null;

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const input = {
      code: values.code,
      title: values.title,
      description: values.description,
      detail: values.detail,
      thirdPartyDataFixScheme: findThirdPartyOption(values.thirdPartyDataFixSchemeId),
      enabled: values.enabled !== false,
      ticketTypes: solution?.ticketTypes || ['DATA_FIX'],
      referencePermission: solution?.permissions?.referencePermission || 'COMPANY'
    };

    setSaving(true);
    try {
      const { response, data } = await requestJson(`${API_URL}/${solutionId}`, {
        method: 'PUT',
        body: JSON.stringify(input)
      });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '保存方案失败');
      }
      message.success('方案已保存');
      setModalOpen(false);
      await loadSolutionDetail();
    } catch (error) {
      console.error(error);
      message.error(error.message || '保存方案失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (enabled) => {
    setSaving(true);
    try {
      const { response, data } = await requestJson(`${API_URL}/${solutionId}/enable`, {
        method: 'POST',
        body: JSON.stringify({ enabled })
      });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '更新启用状态失败');
      }
      message.success(enabled ? '方案已启用' : '方案已停用');
      await loadSolutionDetail();
    } catch (error) {
      console.error(error);
      message.error(error.message || '更新启用状态失败');
    } finally {
      setSaving(false);
    }
  };

  const removeSolution = async () => {
    setSaving(true);
    try {
      const { response, data } = await requestJson(`${API_URL}/${solutionId}`, { method: 'DELETE' });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '删除方案失败');
      }
      message.success('方案已删除');
      router.push('/solutions');
    } catch (error) {
      console.error(error);
      message.error(error.message || '删除方案失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      <Card>
        <div className="admin-config-toolbar">
          <Space direction="vertical" size={2}>
            <Link href="/solutions">
              <Button type="link" icon={<ArrowLeftOutlined />} style={{ padding: 0 }}>
                返回方案库
              </Button>
            </Link>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {solution?.title || '方案详情'}
            </Typography.Title>
            <Typography.Text type="secondary">
              {solution?.code ? `${solution.code} · v${solution.versionNo || 1}` : '加载标准解决方案详情'}
            </Typography.Text>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSolutionDetail} loading={loading}>
              刷新
            </Button>
            <Button icon={<EditOutlined />} onClick={openEditModal} disabled={!solution}>
              编辑
            </Button>
            <Switch
              checked={solution?.enabled !== false}
              checkedChildren="启用"
              unCheckedChildren="停用"
              disabled={!solution}
              loading={saving}
              onChange={toggleEnabled}
            />
            <Popconfirm
              title="删除方案"
              description="删除后当前列表不再展示，历史版本和引用记录仍保留。"
              okText="删除"
              cancelText="取消"
              onConfirm={removeSolution}
            >
              <Button danger icon={<DeleteOutlined />} disabled={!solution}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </div>
      </Card>

      <Spin spinning={loading || saving}>
        {solution ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card title="基础信息">
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="方案编码">{solution.code}</Descriptions.Item>
                <Descriptions.Item label="方案标题">{solution.title}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={solution.enabled === false ? 'default' : 'green'}>
                    {solution.enabled === false ? '停用' : '启用'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="当前版本">v{solution.versionNo || 1}</Descriptions.Item>
                <Descriptions.Item label="引用次数">{solution.stats?.referenceCount || 0}</Descriptions.Item>
                <Descriptions.Item label="关联第三方数据修正方案">
                  {formatThirdPartyScheme(solution.thirdPartyDataFixScheme)}
                </Descriptions.Item>
                <Descriptions.Item label="方案描述">{solution.description || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="详细说明">
              <div
                className="solution-detail-content"
                dangerouslySetInnerHTML={{ __html: solution.detailHtml || '<p>-</p>' }}
              />
            </Card>

            <Card title="修改记录">
              <List
                dataSource={detail?.versions || []}
                locale={{ emptyText: <Empty description="暂无修改记录" /> }}
                renderItem={(version) => (
                  <List.Item>
                    <List.Item.Meta
                      title={`v${version.versionNo} ${formatChangeType(version.changeType)}`}
                      description={`${version.operator?.name || '系统'} · ${formatDateTime(version.createdAt)}`}
                    />
                  </List.Item>
                )}
              />
            </Card>

            <Card title="引用工单">
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Input.Search
                  allowClear
                  placeholder="搜索工单号、标题、引用人"
                  value={referenceSearchKeyword}
                  onChange={(event) => setReferenceSearchKeyword(event.target.value)}
                  onSearch={(keyword) => loadReferences({
                    page: 1,
                    pageSize: referencePagination.pageSize,
                    keyword
                  })}
                />
                <Spin spinning={referencesLoading}>
                  <List
                    dataSource={references}
                    locale={{ emptyText: <Empty description="暂无引用工单" /> }}
                    renderItem={(reference) => (
                      <List.Item>
                        <List.Item.Meta
                          title={`${reference.ticket?.id || reference.ticketId} ${reference.ticket?.title || ''}`}
                          description={`引用版本 v${reference.versionNo} · ${reference.operator?.name || '-'} · ${formatDateTime(reference.quotedAt)}`}
                        />
                        <Tag>{reference.ticket?.status || '-'}</Tag>
                      </List.Item>
                    )}
                  />
                </Spin>
                <Pagination
                  current={referencePagination.page}
                  pageSize={referencePagination.pageSize}
                  total={referencePagination.total}
                  showSizeChanger
                  showTotal={(total) => `共 ${total} 条`}
                  onChange={(page, pageSize) => loadReferences({
                    page,
                    pageSize,
                    keyword: referenceSearchKeyword
                  })}
                />
              </Space>
            </Card>
          </Space>
        ) : (
          <Card>
            <Empty description="暂无详情" />
          </Card>
        )}
      </Spin>

      <Modal
        title="编辑方案"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="方案编码"
            rules={[{ required: true, message: '请输入方案编码' }]}
          >
            <Input maxLength={40} showCount allowClear disabled />
          </Form.Item>
          <Form.Item
            name="title"
            label="方案标题"
            rules={[{ required: true, message: '请输入方案标题' }]}
          >
            <Input maxLength={80} showCount allowClear />
          </Form.Item>
          <Form.Item
            name="description"
            label="方案描述"
            rules={[{ required: true, message: '请输入方案描述' }]}
          >
            <Input.TextArea rows={4} maxLength={1000} showCount allowClear />
          </Form.Item>
          <Form.Item
            name="detail"
            label="详细说明"
            rules={[{ required: true, message: '请输入详细说明' }]}
          >
            <Input.TextArea rows={6} maxLength={4000} showCount allowClear />
          </Form.Item>
          <Form.Item name="thirdPartyDataFixSchemeId" label="关联第三方数据修正方案">
            <Select
              showSearch
              allowClear
              placeholder="可搜索第三方数据修正方案"
              loading={thirdPartyLoading}
              filterOption={false}
              onSearch={loadThirdPartySchemes}
              options={thirdPartyOptions.map((scheme) => ({
                value: scheme.id,
                label: `${scheme.code} ${scheme.title}`,
                scheme
              }))}
              optionRender={(option) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text>{option.data.label}</Typography.Text>
                  <Typography.Text type="secondary">{option.data.scheme.sourceSystem || '-'}</Typography.Text>
                </Space>
              )}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

function formatThirdPartyScheme(scheme) {
  if (!scheme) return '-';
  return [scheme.code, scheme.title, scheme.sourceSystem ? `(${scheme.sourceSystem})` : ''].filter(Boolean).join(' ');
}

function formatChangeType(type) {
  const names = {
    CREATE: '创建',
    UPDATE: '更新',
    ENABLE: '启用',
    DISABLE: '停用',
    ROLLBACK: '回滚',
    IMPORT: '导入'
  };
  return names[type] || type || '-';
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}
