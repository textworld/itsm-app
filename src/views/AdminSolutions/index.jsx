'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
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
  Table,
  Tag,
  Typography
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';

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

export default function AdminSolutionsPage() {
  const { message } = AntdApp.useApp();
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSolution, setEditingSolution] = useState(null);
  const [thirdPartyOptions, setThirdPartyOptions] = useState([]);
  const [thirdPartyLoading, setThirdPartyLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [solutionDetail, setSolutionDetail] = useState(null);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referencesSolution, setReferencesSolution] = useState(null);
  const [references, setReferences] = useState([]);
  const [referenceSearchKeyword, setReferenceSearchKeyword] = useState('');
  const [referencePagination, setReferencePagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [form] = Form.useForm();

  const loadSolutions = async () => {
    setLoading(true);
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载方案库失败');
      }
      setSolutions(data.solutions || []);
    } catch (error) {
      console.error(error);
      message.error(error.message || '加载方案库失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSolutions();
  }, []);

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

  const findThirdPartyOption = (id) => thirdPartyOptions.find((item) => item.id === id) || null;

  const openCreateModal = () => {
    setEditingSolution(null);
    form.setFieldsValue({
      code: '',
      title: '',
      description: '',
      detail: '',
      thirdPartyDataFixSchemeId: undefined,
      enabled: true
    });
    loadThirdPartySchemes();
    setModalOpen(true);
  };

  const openEditModal = (solution) => {
    setEditingSolution(solution);
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

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const input = {
      code: values.code,
      title: values.title,
      description: values.description,
      detail: values.detail,
      thirdPartyDataFixScheme: findThirdPartyOption(values.thirdPartyDataFixSchemeId),
      enabled: values.enabled !== false,
      ticketTypes: ['DATA_FIX'],
      referencePermission: 'COMPANY'
    };
    const url = editingSolution ? `${API_URL}/${editingSolution.id}` : API_URL;
    const method = editingSolution ? 'PUT' : 'POST';
    setSaving(true);
    try {
      const { response, data } = await requestJson(url, {
        method,
        body: JSON.stringify(input)
      });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '保存方案失败');
      }
      message.success('方案已保存');
      setModalOpen(false);
      await loadSolutions();
    } catch (error) {
      console.error(error);
      message.error(error.message || '保存方案失败');
    } finally {
      setSaving(false);
    }
  };

  const removeSolution = async (solution) => {
    setSaving(true);
    try {
      const { response, data } = await requestJson(`${API_URL}/${solution.id}`, { method: 'DELETE' });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '删除方案失败');
      }
      message.success('方案已删除');
      await loadSolutions();
    } catch (error) {
      console.error(error);
      message.error(error.message || '删除方案失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (solution, enabled) => {
    const { response, data } = await requestJson(`${API_URL}/${solution.id}/enable`, {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
    if (!response.ok || data?.ok === false) {
      message.error(data?.reason || '更新启用状态失败');
      return;
    }
    message.success(enabled ? '方案已启用' : '方案已停用');
    await loadSolutions();
  };

  const openDetailDrawer = async (solution) => {
    setDetailOpen(true);
    setSolutionDetail(null);
    setDetailLoading(true);
    try {
      const { response, data } = await requestJson(`${API_URL}/${solution.id}`);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载方案详情失败');
      }
      setSolutionDetail(data);
    } catch (error) {
      console.error(error);
      message.error(error.message || '加载方案详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadReferences = async ({ solutionId, page = 1, pageSize = referencePagination.pageSize, keyword = referenceSearchKeyword }) => {
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

  const openReferencesDrawer = (solution) => {
    setReferencesSolution(solution);
    setReferencesOpen(true);
    setReferences([]);
    setReferenceSearchKeyword('');
    setReferencePagination({ page: 1, pageSize: 10, total: 0 });
    loadReferences({ solutionId: solution.id, page: 1, pageSize: 10, keyword: '' });
  };

  const columns = useMemo(
    () => [
      {
        title: '方案编码',
        dataIndex: 'code',
        width: 160,
        render: (value, record) => (
          <Button type="link" size="small" onClick={() => openDetailDrawer(record)} style={{ padding: 0 }}>
            <Typography.Text code>{value || '-'}</Typography.Text>
          </Button>
        )
      },
      {
        title: '方案标题',
        dataIndex: 'title',
        width: 220,
        render: (value, record) => (
          <Button type="link" size="small" onClick={() => openDetailDrawer(record)} style={{ padding: 0 }}>
            <Typography.Text strong>{value || '-'}</Typography.Text>
          </Button>
        )
      },
      {
        title: '方案描述',
        dataIndex: 'description',
        render: (value) => (
          <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
            {value || '-'}
          </Typography.Paragraph>
        )
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 130,
        render: (enabled, record) => (
          <Space>
            <Tag color={enabled === false ? 'default' : 'green'}>
              {enabled === false ? '停用' : '启用'}
            </Tag>
            <Switch
              size="small"
              checked={enabled !== false}
              checkedChildren="启用"
              unCheckedChildren="停用"
              onChange={(checked) => toggleEnabled(record, checked)}
            />
          </Space>
        )
      },
      {
        title: '版本',
        dataIndex: 'versionNo',
        width: 80,
        render: (value) => `v${value || 1}`
      },
      {
        title: '引用次数',
        dataIndex: ['stats', 'referenceCount'],
        width: 100,
        render: (value, record) => (
          <Button type="link" size="small" onClick={() => openReferencesDrawer(record)} style={{ padding: 0 }}>
            {value || 0}
          </Button>
        )
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        render: (_value, record) => (
          <Space>
            <Button size="small" onClick={() => openEditModal(record)}>
              编辑
            </Button>
            <Popconfirm
              title="删除方案"
              description="删除后当前列表不再展示，历史版本和引用记录仍保留。"
              okText="删除"
              cancelText="取消"
              onConfirm={() => removeSolution(record)}
            >
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ],
    [solutions]
  );

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      <Card>
        <div className="admin-config-toolbar">
          <Space direction="vertical" size={2}>
            <Typography.Title level={5} style={{ margin: 0 }}>标准解决方案库</Typography.Title>
            <Typography.Text type="secondary">
              替换原数据修正方案配置，统一维护可引用的标准处理方案。
            </Typography.Text>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSolutions} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增方案
            </Button>
          </Space>
        </div>
      </Card>

      <Spin spinning={loading || saving}>
        <Card title="方案列表">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={solutions}
            locale={{ emptyText: <Empty description="暂无方案" /> }}
          />
        </Card>
      </Spin>

      <Modal
        title={editingSolution ? '编辑方案' : '新增方案'}
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
            <Input maxLength={40} showCount allowClear disabled={Boolean(editingSolution)} />
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

      <Drawer
        title="方案详情"
        width={720}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        destroyOnClose
      >
        <Spin spinning={detailLoading}>
          {solutionDetail?.solution ? (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="方案编码">{solutionDetail.solution.code}</Descriptions.Item>
                <Descriptions.Item label="方案标题">{solutionDetail.solution.title}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={solutionDetail.solution.enabled === false ? 'default' : 'green'}>
                    {solutionDetail.solution.enabled === false ? '停用' : '启用'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="当前版本">v{solutionDetail.solution.versionNo || 1}</Descriptions.Item>
                <Descriptions.Item label="关联第三方数据修正方案">
                  {formatThirdPartyScheme(solutionDetail.solution.thirdPartyDataFixScheme)}
                </Descriptions.Item>
                <Descriptions.Item label="方案描述">{solutionDetail.solution.description || '-'}</Descriptions.Item>
              </Descriptions>

              <div>
                <Typography.Title level={5}>详细说明</Typography.Title>
                <div
                  className="solution-detail-content"
                  dangerouslySetInnerHTML={{ __html: solutionDetail.solution.detailHtml || '<p>-</p>' }}
                />
              </div>

              <Divider />
              <div>
                <Typography.Title level={5}>修改记录</Typography.Title>
                <List
                  dataSource={solutionDetail.versions || []}
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
              </div>
            </Space>
          ) : (
            <Empty description="暂无详情" />
          )}
        </Spin>
      </Drawer>

      <Drawer
        title={referencesSolution ? `引用工单：${referencesSolution.title}` : '引用工单'}
        width={760}
        open={referencesOpen}
        onClose={() => setReferencesOpen(false)}
        destroyOnClose
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="搜索工单号、标题、引用人"
            value={referenceSearchKeyword}
            onChange={(event) => setReferenceSearchKeyword(event.target.value)}
            onSearch={(keyword) => referencesSolution && loadReferences({
              solutionId: referencesSolution.id,
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
            onChange={(page, pageSize) => referencesSolution && loadReferences({
              solutionId: referencesSolution.id,
              page,
              pageSize,
              keyword: referenceSearchKeyword
            })}
          />
        </Space>
      </Drawer>
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
