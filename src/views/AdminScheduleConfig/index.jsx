'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Typography
} from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { SYSTEM_OPTIONS } from '../../constants/systems.js';
import { validateScheduleConfig } from '../../utils/adminConfigValidation.js';

const API_URL = '/api/admin/schedules';

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

export default function AdminScheduleConfigPage() {
  const { message } = AntdApp.useApp();
  const [groups, setGroups] = useState([]);
  const [systems, setSystems] = useState(SYSTEM_OPTIONS);
  const [insuranceTypes, setInsuranceTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  const validationContext = useMemo(
    () => ({
      systems,
      enabledInsuranceTypes: insuranceTypes,
      assignableUsers: users
    }),
    [insuranceTypes, systems, users]
  );

  const systemOptions = systems.map((item) => ({ value: item.value, label: item.label }));
  const insuranceOptions = insuranceTypes.map((item) => ({ value: item.code, label: item.name }));
  const userOptions = users.map((item) => ({ value: item.id, label: item.name }));

  const loadConfig = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载排班配置失败');
      }
      setGroups(data.config?.groups || []);
      setSystems(data.systems || SYSTEM_OPTIONS);
      setInsuranceTypes(data.insuranceTypes || []);
      setUsers(data.users || []);
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '加载排班配置失败' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const addGroup = () => {
    setGroups((prev) => [
      ...prev,
      {
        id: localId('grp'),
        name: '',
        systemCodes: [],
        baseSchedule: { userIds: [] },
        insuranceTeams: []
      }
    ]);
  };

  const updateGroup = (groupIndex, patch) => {
    setGroups((prev) => prev.map((group, index) => (index === groupIndex ? { ...group, ...patch } : group)));
  };

  const removeGroup = (groupIndex) => {
    setGroups((prev) => prev.filter((_, index) => index !== groupIndex));
  };

  const updateBaseSchedule = (groupIndex, userIds) => {
    setGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? { ...group, baseSchedule: { ...(group.baseSchedule || {}), userIds } }
          : group
      )
    );
  };

  const addInsuranceTeam = (groupIndex) => {
    setGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              insuranceTeams: [
                ...(group.insuranceTeams || []),
                {
                  id: localId('team'),
                  name: '',
                  userIds: [],
                  insuranceTypeCodes: []
                }
              ]
            }
          : group
      )
    );
  };

  const updateInsuranceTeam = (groupIndex, teamIndex, patch) => {
    setGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              insuranceTeams: (group.insuranceTeams || []).map((team, currentTeamIndex) =>
                currentTeamIndex === teamIndex ? { ...team, ...patch } : team
              )
            }
          : group
      )
    );
  };

  const removeInsuranceTeam = (groupIndex, teamIndex) => {
    setGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              insuranceTeams: (group.insuranceTeams || []).filter((_, currentTeamIndex) => currentTeamIndex !== teamIndex)
            }
          : group
      )
    );
  };

  const handleSave = async () => {
    const validation = validateScheduleConfig({ groups }, validationContext);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL, {
        method: 'PUT',
        body: JSON.stringify({ groups })
      });
      if (!response.ok || data?.ok === false) {
        setErrors(data?.errors || [{ message: data?.reason || '保存排班配置失败' }]);
        return;
      }
      setGroups(data.config?.groups || []);
      message.success('排班配置已保存');
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '保存排班配置失败' }]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      <Card>
        <div className="admin-config-toolbar">
          <Space direction="vertical" size={2}>
            <Typography.Title level={5} style={{ margin: 0 }}>排班配置</Typography.Title>
            <Typography.Text type="secondary">
              系统不能跨分组重复；同一分组内人员和险种不能跨险种小组重复。
            </Typography.Text>
          </Space>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadConfig} loading={loading}>
              刷新
            </Button>
            <Button icon={<PlusOutlined />} onClick={addGroup}>
              新增分组
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
        {groups.length === 0 ? (
          <Card>
            <Empty description="暂无排班分组">
              <Button type="primary" icon={<PlusOutlined />} onClick={addGroup}>新增分组</Button>
            </Empty>
          </Card>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {groups.map((group, groupIndex) => (
              <Card
                key={group.id}
                className="schedule-group-card"
                title={`排班分组 ${groupIndex + 1}`}
                extra={(
                  <Popconfirm
                    title="删除排班分组"
                    description="确认删除该排班分组？"
                    onConfirm={() => removeGroup(groupIndex)}
                  >
                    <Button danger size="small" icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                )}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <Typography.Text strong>分组名称</Typography.Text>
                    <Input
                      value={group.name}
                      placeholder="例如 ERP 排班组"
                      onChange={(event) => updateGroup(groupIndex, { name: event.target.value })}
                    />
                  </Col>
                  <Col xs={24} md={16}>
                    <Typography.Text strong>系统范围</Typography.Text>
                    <Select
                      mode="multiple"
                      value={group.systemCodes}
                      options={systemOptions}
                      placeholder="请选择系统"
                      onChange={(systemCodes) => updateGroup(groupIndex, { systemCodes })}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={24}>
                    <Typography.Text strong>基础排班</Typography.Text>
                    <Select
                      mode="multiple"
                      value={group.baseSchedule?.userIds || []}
                      options={userOptions}
                      placeholder="请选择一线人员"
                      onChange={(userIds) => updateBaseSchedule(groupIndex, userIds)}
                      style={{ width: '100%' }}
                    />
                  </Col>
                </Row>

                <Divider orientation="left">险种排班小组</Divider>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {(group.insuranceTeams || []).map((team, teamIndex) => (
                    <div key={team.id} className="schedule-team-panel">
                      <Row gutter={[12, 12]} align="middle">
                        <Col xs={24} md={6}>
                          <Typography.Text strong>小组名称</Typography.Text>
                          <Input
                            value={team.name}
                            placeholder="例如 医疗险小组"
                            onChange={(event) => updateInsuranceTeam(groupIndex, teamIndex, { name: event.target.value })}
                          />
                        </Col>
                        <Col xs={24} md={8}>
                          <Typography.Text strong>人员</Typography.Text>
                          <Select
                            mode="multiple"
                            value={team.userIds}
                            options={userOptions}
                            placeholder="请选择一线人员"
                            onChange={(userIds) => updateInsuranceTeam(groupIndex, teamIndex, { userIds })}
                            style={{ width: '100%' }}
                          />
                        </Col>
                        <Col xs={24} md={8}>
                          <Typography.Text strong>险种</Typography.Text>
                          <Select
                            mode="multiple"
                            value={team.insuranceTypeCodes}
                            options={insuranceOptions}
                            placeholder="请选择启用险种"
                            onChange={(insuranceTypeCodes) => updateInsuranceTeam(groupIndex, teamIndex, { insuranceTypeCodes })}
                            style={{ width: '100%' }}
                          />
                        </Col>
                        <Col xs={24} md={2}>
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removeInsuranceTeam(groupIndex, teamIndex)}
                          />
                        </Col>
                      </Row>
                    </div>
                  ))}
                  <Button icon={<PlusOutlined />} onClick={() => addInsuranceTeam(groupIndex)}>
                    新增险种小组
                  </Button>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Spin>
    </Space>
  );
}

function localId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
