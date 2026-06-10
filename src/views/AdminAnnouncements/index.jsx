'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';
import {
  CheckOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  PushpinOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SendOutlined,
  StopOutlined
} from '@ant-design/icons';
import RichTextEditor from '../../components/common/RichTextEditor.jsx';
import {
  ANNOUNCEMENT_STATUS,
  ANNOUNCEMENT_STATUS_LABELS
} from '../../utils/announcements.js';
import { formatDateTime } from '../../utils/format.js';
import { richTextHasContent } from '../../utils/richText.js';
import { ROLES } from '../../constants/roles.js';

const API_URL = '/api/admin/announcements';
const SESSION_URL = '/api/auth/session';
const { RangePicker } = DatePicker;
const ACTION_PATHS = {
  submit: '/submit',
  approve: '/approve',
  reject: '/reject',
  withdraw: '/withdraw',
  pin: '/pin'
};

const STATUS_COLORS = {
  [ANNOUNCEMENT_STATUS.DRAFT]: 'default',
  [ANNOUNCEMENT_STATUS.PENDING_APPROVAL]: 'processing',
  [ANNOUNCEMENT_STATUS.REJECTED]: 'error',
  [ANNOUNCEMENT_STATUS.PUBLISHED]: 'success',
  [ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL]: 'warning',
  [ANNOUNCEMENT_STATUS.WITHDRAWN]: 'default'
};

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

export default function AdminAnnouncementsPage() {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm();
  const [announcements, setAnnouncements] = useState([]);
  const [systems, setSystems] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [supportUsers, setSupportUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [drawerErrors, setDrawerErrors] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAnnouncement, setDetailAnnouncement] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const systemOptions = useMemo(
    () => systems.map((system) => ({
      value: system.code || system.value,
      label: system.name || system.label || system.code
    })),
    [systems]
  );

  const adminOptions = useMemo(
    () => adminUsers.map((user) => ({
      value: user.id,
      label: user.name || user.username || user.id
    })),
    [adminUsers]
  );

  const supportOptions = useMemo(
    () => supportUsers
      .filter((user) => user.role === 'L1' || user.role === 'L2')
      .map((user) => ({
        value: user.id,
        label: `${user.name || user.username || user.id}（${user.role}）`
      })),
    [supportUsers]
  );

  const loadAnnouncements = async (filters = filterForm.getFieldsValue()) => {
    setLoading(true);
    setError('');
    try {
      const query = buildQuery(filters);
      const { response, data } = await requestJson(`${API_URL}${query}`);
      if (!response.ok || data?.ok === false) {
        throw new Error(formatValidationMessage(data, '加载公告失败'));
      }
      setAnnouncements(data.announcements || []);
      setSystems(data.systems || []);
      setAdminUsers(data.adminUsers || []);
      setSupportUsers(data.supportUsers || []);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || '加载公告失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const { response, data } = await requestJson(SESSION_URL);
      if (response.ok && data?.ok !== false) {
        setCurrentUser(data.user || null);
      }
    } catch (sessionError) {
      console.error(sessionError);
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    loadAnnouncements();
    loadCurrentUser();
  }, []);

  const openCreateDrawer = () => {
    setEditingAnnouncement(null);
    setDrawerErrors([]);
    form.setFieldsValue({
      title: '',
      affectedSystemCodes: [],
      faultDescriptionDoc: '',
      progressDoc: '',
      estimatedRecoveryAt: null,
      handlerIds: [],
      approverId: undefined,
      display: {
        scrollSpeed: 40,
        durationSeconds: 1800,
        pinned: false
      }
    });
    setEditorOpen(true);
  };

  const openEditDrawer = (announcement) => {
    const snapshot = getEditSnapshot(announcement);
    setEditingAnnouncement(announcement);
    setDrawerErrors([]);
    form.setFieldsValue({
      title: snapshot.title || announcement.title || '',
      affectedSystemCodes: (snapshot.affectedSystems || announcement.affectedSystems || [])
        .map((system) => system.code),
      faultDescriptionDoc: snapshot.faultDescriptionHtml || '',
      progressDoc: snapshot.progressHtml || '',
      estimatedRecoveryAt: snapshot.estimatedRecoveryAt ? dayjs(snapshot.estimatedRecoveryAt) : null,
      handlerIds: (snapshot.handlers || announcement.handlers || []).map((handler) => handler.id),
      approverId: snapshot.approver?.id || announcement.approver?.id,
      display: {
        scrollSpeed: snapshot.display?.scrollSpeed || 40,
        durationSeconds: snapshot.display?.durationSeconds || 1800,
        pinned: snapshot.display?.pinned === true
      }
    });
    setEditorOpen(true);
  };

  const saveAnnouncement = async (submit) => {
    const values = await form.validateFields();
    const payload = buildPayload(values, submit);
    const isEdit = Boolean(editingAnnouncement?.id);
    setSaving(true);
    setError('');
    setDrawerErrors([]);
    try {
      const { response, data } = isEdit
        ? await requestJson(`${API_URL}/${editingAnnouncement.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        : await requestJson(API_URL, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      if (!response.ok || data?.ok === false) {
        const messages = formatValidationMessages(data, submit ? '提交审批失败' : '保存草稿失败');
        setDrawerErrors(messages);
        throw new Error(messages.join('；'));
      }
      message.success(submit ? '已提交审批' : '草稿已保存');
      setDrawerErrors([]);
      setEditorOpen(false);
      await loadAnnouncements();
    } catch (saveError) {
      console.error(saveError);
      const messageText = saveError.message || (submit ? '提交审批失败' : '保存草稿失败');
      setError(messageText);
      setDrawerErrors((previous) => previous.length ? previous : [messageText]);
    } finally {
      setSaving(false);
    }
  };

  const loadDetail = async (announcement) => {
    setDetailOpen(true);
    setDetailAnnouncement(announcement);
    setDetailLoading(true);
    try {
      const { response, data } = await requestJson(`${API_URL}/${announcement.id}`);
      if (!response.ok || data?.ok === false) {
        throw new Error(formatValidationMessage(data, '加载公告详情失败'));
      }
      setDetailAnnouncement(data.announcement || announcement);
    } catch (detailError) {
      console.error(detailError);
      message.error(detailError.message || '加载公告详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const callAction = async (announcement, actionPath, body = {}, successText = '操作已完成') => {
    setSaving(true);
    setError('');
    try {
      const { response, data } = await requestJson(`${API_URL}/${announcement.id}${actionPath}`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      if (!response.ok || data?.ok === false) {
        throw new Error(formatValidationMessage(data, '操作失败'));
      }
      message.success(successText);
      await loadAnnouncements();
      if (detailOpen && detailAnnouncement?.id === announcement.id) {
        setDetailAnnouncement(data.announcement || detailAnnouncement);
      }
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  const promptAction = (announcement, action, title, fieldName, successText) => {
    let value = '';
    Modal.confirm({
      title,
      content: (
        <Input.TextArea
          rows={4}
          maxLength={500}
          showCount
          placeholder="请输入意见或原因"
          onChange={(event) => {
            value = event.target.value;
          }}
        />
      ),
      okText: '确认',
      cancelText: '取消',
      onOk: () => callAction(announcement, action, { [fieldName]: value }, successText)
    });
  };

  const columns = [
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>
          {ANNOUNCEMENT_STATUS_LABELS[status] || status || '-'}
        </Tag>
      )
    },
    {
      title: '公告标题',
      dataIndex: 'title',
      width: 240,
      render: (_value, record) => (
        <Typography.Text strong>{getListSnapshot(record).title || '-'}</Typography.Text>
      )
    },
    {
      title: '故障影响范围',
      dataIndex: 'affectedSystems',
      width: 220,
      render: (_value, record) => renderSystems(getListSnapshot(record).affectedSystems)
    },
    {
      title: '审批人',
      dataIndex: 'approver',
      width: 140,
      render: (_value, record) => getListSnapshot(record).approver?.name || '-'
    },
    {
      title: '预计恢复时间',
      dataIndex: 'estimatedRecoveryAt',
      width: 180,
      render: (_value, record) => formatDateTime(getListSnapshot(record).estimatedRecoveryAt)
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      width: 180,
      render: formatDateTime
    },
    {
      title: '创建人/发布人',
      key: 'actors',
      width: 170,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.creator?.name || '-'}</span>
          <Typography.Text type="secondary">{record.publisher?.name || '-'}</Typography.Text>
        </Space>
      )
    },
    {
      title: '置顶',
      key: 'pinned',
      width: 100,
      render: (_value, record) => {
        const pinned = getListSnapshot(record).display?.pinned === true;
        return (
          <Switch
            size="small"
            checked={pinned}
            disabled={saving || !canTogglePinned(record, currentUser)}
            onChange={(checked) => callAction(record, ACTION_PATHS.pin, { pinned: checked }, checked ? '已置顶' : '已取消置顶')}
          />
        );
      }
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 300,
      render: (_value, record) => (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => loadDetail(record)}>
            详情
          </Button>
          {canEdit(record) && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditDrawer(record)}>
              编辑
            </Button>
          )}
          {canSubmit(record) && (
            <Popconfirm
              title="提交审批"
              description="确认提交该公告审批？"
              okText="提交"
              cancelText="取消"
              onConfirm={() => callAction(record, ACTION_PATHS.submit, {}, '已提交审批')}
            >
              <Button size="small" icon={<SendOutlined />}>
                提交审批
              </Button>
            </Popconfirm>
          )}
          {canApprove(record, currentUser) && (
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => promptAction(record, ACTION_PATHS.approve, '审批通过', 'opinion', '审批已通过')}
            >
              审批通过
            </Button>
          )}
          {canApprove(record, currentUser) && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => promptAction(record, ACTION_PATHS.reject, '驳回公告', 'opinion', '已驳回')}
            >
              驳回
            </Button>
          )}
          {canWithdraw(record) && (
            <Button
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => promptAction(record, ACTION_PATHS.withdraw, '撤回公告', 'reason', '已撤回')}
            >
              撤回
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      {error && <Alert type="error" showIcon message={error} />}

      <Card
        title="公告管理"
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadAnnouncements()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
              发布公告
            </Button>
          </Space>
        )}
      >
        <Form form={filterForm} layout="inline" onFinish={loadAnnouncements}>
          <Form.Item name="keyword">
            <Input allowClear placeholder="标题/描述/进度" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="systemCode">
            <Select allowClear placeholder="故障影响范围" options={systemOptions} style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="status">
            <Select
              allowClear
              placeholder="状态"
              options={Object.entries(ANNOUNCEMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              style={{ width: 160 }}
            />
          </Form.Item>
          <Form.Item name="publishedRange">
            <RangePicker showTime placeholder={['发布开始', '发布结束']} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                筛选
              </Button>
              <Button
                onClick={() => {
                  filterForm.resetFields();
                  loadAnnouncements({});
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="公告列表">
        <Table
          rowKey="id"
          loading={loading || saving}
          columns={columns}
          dataSource={announcements}
          scroll={{ x: 1500 }}
          locale={{ emptyText: <Empty description="暂无公告" /> }}
        />
      </Card>

      <Drawer
        title={editingAnnouncement ? '编辑公告' : '发布公告'}
        width={760}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        destroyOnClose
        extra={(
          <Space>
            <Button onClick={() => setEditorOpen(false)}>取消</Button>
            <Button loading={saving} onClick={() => saveAnnouncement(false)}>
              保存草稿
            </Button>
            <Button type="primary" loading={saving} onClick={() => saveAnnouncement(true)}>
              提交审批
            </Button>
          </Space>
        )}
      >
        {drawerErrors.length > 0 && <Alert
          type="error"
          showIcon
          message="保存失败"
          description={(
            <Space direction="vertical" size={0}>
              {drawerErrors.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </Space>
          )}
          style={{ marginBottom: 16 }}
        />}
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入公告标题' }]}>
            <Input maxLength={80} showCount allowClear />
          </Form.Item>
          <Form.Item
            name="affectedSystemCodes"
            label="故障影响范围"
            rules={[{ required: true, message: '请选择故障影响范围' }]}
          >
            <Select mode="multiple" allowClear options={systemOptions} />
          </Form.Item>
          <Form.Item
            name="faultDescriptionDoc"
            label="故障描述"
            rules={[requiredRichTextRule('请输入故障描述')]}
          >
            <RichTextEditor placeholder="请输入故障描述" />
          </Form.Item>
          <Form.Item
            name="progressDoc"
            label="当前处置进度"
            rules={[requiredRichTextRule('请输入当前处置进度')]}
          >
            <RichTextEditor placeholder="请输入当前处置进度" />
          </Form.Item>
          <Form.Item
            name="estimatedRecoveryAt"
            label="预计恢复时间"
            rules={[{ required: true, message: '请选择预计恢复时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="handlerIds"
            label="故障处置负责人"
            rules={[{ required: true, message: '请选择故障处置负责人' }]}
          >
            <Select mode="multiple" allowClear options={supportOptions} />
          </Form.Item>
          <Form.Item name="approverId" label="审批人" rules={[{ required: true, message: '请选择审批人' }]}>
            <Select allowClear options={adminOptions} />
          </Form.Item>
          <Space size="large" align="start" wrap>
            <Form.Item name={['display', 'scrollSpeed']} label="滚动速度">
              <InputNumber min={1} addonAfter="px/s" />
            </Form.Item>
            <Form.Item name={['display', 'durationSeconds']} label="展示时长">
              <InputNumber min={1} addonAfter="秒" />
            </Form.Item>
            <Form.Item name={['display', 'pinned']} label="置顶" valuePropName="checked">
              <Switch checkedChildren={<PushpinOutlined />} unCheckedChildren="否" />
            </Form.Item>
          </Space>
        </Form>
      </Drawer>

      <Drawer
        title="公告详情"
        width={820}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        destroyOnClose
      >
        {detailAnnouncement ? (
          <AnnouncementDetail announcement={detailAnnouncement} />
        ) : (
          <Empty description="暂无公告详情" />
        )}
      </Drawer>
    </Space>
  );
}

function AnnouncementDetail({ announcement }) {
  const currentSnapshot = getListSnapshot(announcement);
  const pendingSnapshot = announcement.status === ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
    ? announcement.pendingSnapshot
    : null;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card title="公告详情">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="状态">
            {ANNOUNCEMENT_STATUS_LABELS[announcement.status] || announcement.status || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="置顶">
            {currentSnapshot.display?.pinned ? '是' : '否'}
          </Descriptions.Item>
          <Descriptions.Item label="公告标题" span={2}>
            {currentSnapshot.title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="故障影响范围" span={2}>
            {renderSystems(currentSnapshot.affectedSystems)}
          </Descriptions.Item>
          <Descriptions.Item label="预计恢复时间">
            {formatDateTime(currentSnapshot.estimatedRecoveryAt)}
          </Descriptions.Item>
          <Descriptions.Item label="审批人">
            {currentSnapshot.approver?.name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="故障处置负责人" span={2}>
            {renderHandlers(currentSnapshot.handlers)}
          </Descriptions.Item>
          <Descriptions.Item label="滚动速度">
            {currentSnapshot.display?.scrollSpeed || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="展示时长">
            {currentSnapshot.display?.durationSeconds || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <RichTextCard title="故障描述" html={currentSnapshot.faultDescriptionHtml} />
      <RichTextCard title="当前处置进度" html={currentSnapshot.progressHtml} />
      {pendingSnapshot && (
        <Card title="待审批更新内容">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="公告标题" span={2}>
              {pendingSnapshot.title || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="故障影响范围" span={2}>
              {renderSystems(pendingSnapshot.affectedSystems)}
            </Descriptions.Item>
            <Descriptions.Item label="预计恢复时间">
              {formatDateTime(pendingSnapshot.estimatedRecoveryAt)}
            </Descriptions.Item>
            <Descriptions.Item label="审批人">
              {pendingSnapshot.approver?.name || '-'}
            </Descriptions.Item>
          </Descriptions>
          <RichTextCard title="故障描述" html={pendingSnapshot.faultDescriptionHtml} />
          <RichTextCard title="当前处置进度" html={pendingSnapshot.progressHtml} />
        </Card>
      )}
      <RecordsCard title="审批记录" records={announcement.approvalRecords} />
      <RecordsCard title="操作日志" records={announcement.operationLogs} />
    </Space>
  );
}

function RichTextCard({ title, html }) {
  return (
    <Card title={title}>
      {html ? (
        <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <Typography.Text type="secondary">暂无内容</Typography.Text>
      )}
    </Card>
  );
}

function RecordsCard({ title, records = [] }) {
  return (
    <Card title={title}>
      <Table
        size="small"
        rowKey={(record, index) => `${record.action || record.status || 'record'}_${record.handledAt || record.createdAt || record.at || index}`}
        pagination={false}
        dataSource={records}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`暂无${title}`} /> }}
        columns={[
          {
            title: '时间',
            dataIndex: 'handledAt',
            width: 180,
            render: (value, record) => formatDateTime(value || record.createdAt || record.at)
          },
          {
            title: '操作',
            dataIndex: 'action',
            width: 140,
            render: (value, record) => value || record.status || '-'
          },
          {
            title: '处理人',
            dataIndex: 'operator',
            width: 140,
            render: (operator, record) => operator?.name || record.actor?.name || '-'
          },
          {
            title: '说明',
            dataIndex: 'message',
            render: (value, record) => value || record.opinion || record.reason || '-'
          }
        ]}
      />
    </Card>
  );
}

function buildQuery(filters = {}) {
  const params = new URLSearchParams();
  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.systemCode) params.set('systemCode', filters.systemCode);
  if (filters.status) params.set('status', filters.status);
  const [publishedFrom, publishedTo] = filters.publishedRange || [];
  if (publishedFrom) params.set('publishedFrom', publishedFrom.toISOString());
  if (publishedTo) params.set('publishedTo', publishedTo.toISOString());
  const query = params.toString();
  return query ? `?${query}` : '';
}

function buildPayload(values, submit) {
  return {
    title: values.title,
    affectedSystemCodes: values.affectedSystemCodes || [],
    faultDescriptionDoc: values.faultDescriptionDoc,
    progressDoc: values.progressDoc,
    estimatedRecoveryAt: values.estimatedRecoveryAt?.toISOString(),
    handlerIds: values.handlerIds || [],
    approverId: values.approverId,
    display: {
      scrollSpeed: values.display?.scrollSpeed,
      durationSeconds: values.display?.durationSeconds,
      pinned: values.display?.pinned === true
    },
    submit
  };
}

function getListSnapshot(announcement = {}) {
  const published = announcement.publishedSnapshot || {};
  return {
    ...published,
    title: announcement.title || published.title || announcement.pendingSnapshot?.title,
    affectedSystems: firstArray(announcement.affectedSystems, published.affectedSystems, announcement.pendingSnapshot?.affectedSystems),
    handlers: firstArray(announcement.handlers, published.handlers, announcement.pendingSnapshot?.handlers),
    approver: announcement.approver || published.approver || announcement.pendingSnapshot?.approver,
    estimatedRecoveryAt: announcement.estimatedRecoveryAt || published.estimatedRecoveryAt || announcement.pendingSnapshot?.estimatedRecoveryAt,
    faultDescriptionHtml: announcement.faultDescriptionHtml || published.faultDescriptionHtml || announcement.pendingSnapshot?.faultDescriptionHtml,
    progressHtml: announcement.progressHtml || published.progressHtml || announcement.pendingSnapshot?.progressHtml,
    display: announcement.display || published.display || announcement.pendingSnapshot?.display || {}
  };
}

function getEditSnapshot(announcement = {}) {
  return announcement.pendingSnapshot || announcement.publishedSnapshot || getListSnapshot(announcement);
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length > 0) || [];
}

function renderSystems(systems = []) {
  if (!systems.length) return '-';
  return (
    <Space size={[4, 4]} wrap>
      {systems.map((system) => (
        <Tag key={system.code || system.name}>{system.name || system.code}</Tag>
      ))}
    </Space>
  );
}

function renderHandlers(handlers = []) {
  if (!handlers?.length) return '-';
  return handlers.map((handler) => `${handler.name || handler.id}${handler.role ? `（${handler.role}）` : ''}`).join('、');
}

function canEdit(announcement) {
  return [
    ANNOUNCEMENT_STATUS.DRAFT,
    ANNOUNCEMENT_STATUS.REJECTED,
    ANNOUNCEMENT_STATUS.PUBLISHED
  ].includes(announcement.status);
}

function canSubmit(announcement) {
  return [
    ANNOUNCEMENT_STATUS.DRAFT,
    ANNOUNCEMENT_STATUS.REJECTED
  ].includes(announcement.status);
}

function canApprove(announcement, currentUser) {
  const approverId = announcement.pendingSnapshot?.approver?.id || announcement.approver?.id;
  return Boolean(currentUser?.id && approverId) && [
    ANNOUNCEMENT_STATUS.PENDING_APPROVAL,
    ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
  ].includes(announcement.status) && String(approverId) === String(currentUser?.id);
}

function canWithdraw(announcement) {
  return [
    ANNOUNCEMENT_STATUS.PUBLISHED,
    ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
  ].includes(announcement.status);
}

function canTogglePinned(announcement, currentUser) {
  if (currentUser?.role !== ROLES.ADMIN) {
    return false;
  }

  return [
    ANNOUNCEMENT_STATUS.PUBLISHED,
    ANNOUNCEMENT_STATUS.UPDATE_PENDING_APPROVAL
  ].includes(announcement.status);
}

function formatValidationMessage(data, fallback) {
  return formatValidationMessages(data, fallback).join('；');
}

function formatValidationMessages(data, fallback) {
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map((item) => item.message);
  }
  return [data?.reason || fallback];
}

function requiredRichTextRule(message) {
  return {
    validator: (_rule, value) => (
      richTextHasContent(value)
        ? Promise.resolve()
        : Promise.reject(new Error(message))
    )
  };
}
