'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  buildUpcomingSupportRestDays,
  validateSupportRestConfig
} from '../../utils/adminConfigValidation.js';
import {
  SUPPORT_REST_SLOT_OPTIONS,
  buildSupportRestPeriodFromQuickAdd,
  isSupportRestPeriodVisible
} from '../../utils/supportRestTimeSlots.js';

const API_URL = '/api/config/admin/support-rests';
const UPCOMING_RANGE_OPTIONS = [
  { label: '未来 7 天', value: 7 },
  { label: '未来 14 天', value: 14 },
  { label: '未来 30 天', value: 30 }
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

export default function AdminSupportRestConfigPage() {
  const { message } = AntdApp.useApp();
  const [restPeriods, setRestPeriods] = useState([]);
  const [users, setUsers] = useState([]);
  const [rangeDays, setRangeDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickForm] = Form.useForm();

  const userOptions = users.map((user) => ({
    value: user.id,
    label: `${user.name}${user.department ? ` · ${user.department}` : ''}`
  }));

  const visibleRestPeriods = useMemo(
    () => restPeriods.filter((period) => isSupportRestPeriodVisible(period)),
    [restPeriods]
  );

  const upcomingDays = useMemo(
    () => buildUpcomingSupportRestDays({ restPeriods }, users, { days: rangeDays }),
    [rangeDays, restPeriods, users]
  );

  const loadConfig = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载休息时间配置失败');
      }
      setRestPeriods(data.config?.restPeriods || []);
      setUsers(data.users || []);
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '加载休息时间配置失败' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const openQuickModal = () => {
    quickForm.resetFields();
    quickForm.setFieldsValue({
      restDate: dayjs(),
      slot: 'MORNING',
      userIds: [],
      reason: ''
    });
    setQuickModalOpen(true);
  };

  const closeQuickModal = () => {
    setQuickModalOpen(false);
    setQuickSaving(false);
  };

  const addRestPeriod = () => {
    const period = buildSupportRestPeriodFromQuickAdd({
      date: dayjs().add(1, 'day'),
      slot: 'FULL_DAY',
      userIds: [],
      reason: ''
    });
    setRestPeriods((prev) => [...prev, period]);
  };

  const updateRestPeriod = (periodId, patch) => {
    setRestPeriods((prev) =>
      prev.map((period) => (period.id === periodId ? { ...period, ...patch } : period))
    );
  };

  const removeRestPeriod = (periodId) => {
    setRestPeriods((prev) => prev.filter((period) => period.id !== periodId));
  };

  const handleQuickAddConfirm = async () => {
    try {
      const values = await quickForm.validateFields();
      setQuickSaving(true);
      const period = buildSupportRestPeriodFromQuickAdd({
        date: values.restDate,
        slot: values.slot,
        userIds: values.userIds,
        reason: values.reason
      });
      setRestPeriods((prev) => [...prev, period]);
      closeQuickModal();
      message.success('快捷休息时间已添加');
    } catch (error) {
      if (error?.errorFields) return;
      console.error(error);
      message.error(error.message || '快捷新增失败');
      setQuickSaving(false);
    }
  };

  const handleSave = async () => {
    const validation = validateSupportRestConfig({ restPeriods }, { assignableUsers: users });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL, {
        method: 'PUT',
        body: JSON.stringify({ restPeriods })
      });
      if (!response.ok || data?.ok === false) {
        setErrors(data?.errors || [{ message: data?.reason || '保存休息时间配置失败' }]);
        return;
      }
      setRestPeriods(data.config?.restPeriods || []);
      message.success('休息时间配置已保存');
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '保存休息时间配置失败' }]);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '一线技术支持',
      dataIndex: 'userIds',
      width: 280,
      render: (value, record) => (
        <Select
          mode="multiple"
          value={value}
          options={userOptions}
          placeholder="请选择一线人员"
          onChange={(userIds) => updateRestPeriod(record.id, { userIds })}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: '休息时间',
      dataIndex: 'startsAt',
      width: 360,
      render: (_value, record) => (
        <DatePicker.RangePicker
          showTime
          value={[
            record.startsAt ? dayjs(record.startsAt) : null,
            record.endsAt ? dayjs(record.endsAt) : null
          ]}
          onChange={(dates) => {
            updateRestPeriod(record.id, {
              startsAt: dates?.[0] ? dates[0].toISOString() : '',
              endsAt: dates?.[1] ? dates[1].toISOString() : ''
            });
          }}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: '备注',
      dataIndex: 'reason',
      render: (value, record) => (
        <Input
          value={value}
          placeholder="例如 调休、培训、年假"
          onChange={(event) => updateRestPeriod(record.id, { reason: event.target.value })}
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 96,
      render: (_value, record) => (
        <Popconfirm
          title="删除休息时间"
          description="确认删除该休息时间记录？"
          onConfirm={() => removeRestPeriod(record.id)}
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
            <Typography.Title level={5} style={{ margin: 0 }}>一线休息时间配置</Typography.Title>
            <Typography.Text type="secondary">
              仅展示今日及未来的休息记录；本配置暂不影响自动派单和工单流转。
            </Typography.Text>
          </Space>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadConfig} loading={loading}>
              刷新
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={openQuickModal}>
              快捷新增
            </Button>
            <Button icon={<PlusOutlined />} onClick={addRestPeriod}>
              新增休息时间
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

      <Spin spinning={loading}>
        <Card title="休息时间维护">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={visibleRestPeriods}
            pagination={false}
            scroll={{ x: 900 }}
            locale={{
              emptyText: (
                <Empty description="暂无今日及未来的休息时间配置">
                  <Button type="primary" icon={<PlusOutlined />} onClick={openQuickModal}>
                    快捷新增
                  </Button>
                </Empty>
              )
            }}
          />
        </Card>

        <Card
          title="未来休息清单"
          extra={(
            <Segmented
              value={rangeDays}
              options={UPCOMING_RANGE_OPTIONS}
              onChange={setRangeDays}
            />
          )}
        >
          {upcomingDays.length === 0 ? (
            <Empty description={`未来 ${rangeDays} 天暂无休息人员`} />
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {upcomingDays.map((day) => (
                <Card key={day.date} size="small" title={day.date}>
                  <List
                    dataSource={day.items}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          title={(
                            <Space wrap>
                              {item.userNames.map((name) => (
                                <Tag color="blue" key={name}>{name}</Tag>
                              ))}
                              <Typography.Text>
                                {formatTime(item.dayStartsAt)} - {formatTime(item.dayEndsAt)}
                              </Typography.Text>
                            </Space>
                          )}
                          description={item.reason || '无备注'}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              ))}
            </Space>
          )}
        </Card>
      </Spin>

      <Modal
        title="快捷新增休息时间"
        open={quickModalOpen}
        onCancel={closeQuickModal}
        onOk={handleQuickAddConfirm}
        okText="确定"
        cancelText="取消"
        confirmLoading={quickSaving}
        destroyOnClose
      >
        <Form
          form={quickForm}
          layout="vertical"
          initialValues={{
            restDate: dayjs(),
            slot: 'MORNING',
            userIds: [],
            reason: ''
          }}
        >
          <Form.Item
            name="restDate"
            label="具体日期"
            rules={[{ required: true, message: '请选择具体日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="slot"
            label="休息时段"
            rules={[{ required: true, message: '请选择休息时段' }]}
          >
            <Segmented options={SUPPORT_REST_SLOT_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="userIds"
            label="一线技术支持"
            rules={[{ required: true, message: '请选择一线人员' }]}
          >
            <Select
              mode="multiple"
              options={userOptions}
              placeholder="请选择一线人员"
            />
          </Form.Item>
          <Form.Item name="reason" label="备注">
            <Input placeholder="例如 调休、培训、年假" />
          </Form.Item>
          <Typography.Text type="secondary">
            上午 9:00-12:00，下午 13:30-18:30，全天 9:00-18:30。
          </Typography.Text>
        </Form>
      </Modal>
    </Space>
  );
}

function formatTime(value) {
  return dayjs(value).format('HH:mm');
}
