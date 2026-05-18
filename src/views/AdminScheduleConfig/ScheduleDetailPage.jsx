'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Divider,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Typography
} from 'antd';
import { DeleteOutlined, PlusOutlined, SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
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

export default function ScheduleDetailPage({ mode = 'edit', groupId = null }) {
  const router = useRouter();
  const { message } = AntdApp.useApp();
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [systems, setSystems] = useState(SYSTEM_OPTIONS);
  const [insuranceTypes, setInsuranceTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [notFound, setNotFound] = useState(false);

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
  const isCreateMode = mode === 'create';

  const loadConfig = async () => {
    setLoading(true);
    setErrors([]);
    setNotFound(false);
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载排班配置失败');
      }

      const loadedGroups = data.config?.groups || [];
      setGroups(loadedGroups);
      setSystems(data.systems || SYSTEM_OPTIONS);
      setInsuranceTypes(data.insuranceTypes || []);
      setUsers(data.users || []);

      if (isCreateMode) {
        setGroup(createEmptyGroup());
        return;
      }

      const currentGroup = loadedGroups.find((item) => item.id === groupId);
      if (!currentGroup) {
        setGroup(null);
        setNotFound(true);
        return;
      }
      setGroup(currentGroup);
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '加载排班配置失败' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [groupId, mode]);

  const updateGroup = (patch) => {
    setGroup((previous) => ({ ...previous, ...patch }));
  };

  const updateBaseSchedule = (userIds) => {
    setGroup((previous) => ({
      ...previous,
      baseSchedule: { ...(previous.baseSchedule || {}), userIds }
    }));
  };

  const addInsuranceTeam = () => {
    setGroup((previous) => ({
      ...previous,
      insuranceTeams: [
        ...(previous.insuranceTeams || []),
        {
          id: localId('team'),
          userIds: [],
          insuranceTypeCodes: []
        }
      ]
    }));
  };

  const updateInsuranceTeam = (teamIndex, patch) => {
    setGroup((previous) => ({
      ...previous,
      insuranceTeams: (previous.insuranceTeams || []).map((team, currentTeamIndex) =>
        currentTeamIndex === teamIndex ? { ...team, ...patch } : team
      )
    }));
  };

  const removeInsuranceTeam = (teamIndex) => {
    setGroup((previous) => ({
      ...previous,
      insuranceTeams: (previous.insuranceTeams || []).filter((_, currentTeamIndex) => currentTeamIndex !== teamIndex)
    }));
  };

  const addFlexibleRule = () => {
    setGroup((previous) => ({
      ...previous,
      flexibleRules: [
        ...(previous.flexibleRules || []),
        {
          id: localId('flex'),
          systemCodes: [],
          assignees: []
        }
      ]
    }));
  };

  const updateFlexibleRule = (ruleIndex, patch) => {
    setGroup((previous) => ({
      ...previous,
      flexibleRules: (previous.flexibleRules || []).map((rule, currentRuleIndex) =>
        currentRuleIndex === ruleIndex ? { ...rule, ...patch } : rule
      )
    }));
  };

  const removeFlexibleRule = (ruleIndex) => {
    setGroup((previous) => ({
      ...previous,
      flexibleRules: (previous.flexibleRules || []).filter((_, currentRuleIndex) => currentRuleIndex !== ruleIndex)
    }));
  };

  const addFlexibleAssignee = (ruleIndex) => {
    setGroup((previous) => ({
      ...previous,
      flexibleRules: (previous.flexibleRules || []).map((rule, currentRuleIndex) =>
        currentRuleIndex === ruleIndex
          ? {
              ...rule,
              assignees: [
                ...(rule.assignees || []),
                {
                  userId: '',
                  ratio: 1
                }
              ]
            }
          : rule
      )
    }));
  };

  const updateFlexibleAssignee = (ruleIndex, assigneeIndex, patch) => {
    setGroup((previous) => ({
      ...previous,
      flexibleRules: (previous.flexibleRules || []).map((rule, currentRuleIndex) =>
        currentRuleIndex === ruleIndex
          ? {
              ...rule,
              assignees: (rule.assignees || []).map((assignee, currentAssigneeIndex) =>
                currentAssigneeIndex === assigneeIndex ? { ...assignee, ...patch } : assignee
              )
            }
          : rule
      )
    }));
  };

  const removeFlexibleAssignee = (ruleIndex, assigneeIndex) => {
    setGroup((previous) => ({
      ...previous,
      flexibleRules: (previous.flexibleRules || []).map((rule, currentRuleIndex) =>
        currentRuleIndex === ruleIndex
          ? {
              ...rule,
              assignees: (rule.assignees || []).filter((_, currentAssigneeIndex) => currentAssigneeIndex !== assigneeIndex)
            }
          : rule
      )
    }));
  };

  const buildNextGroups = (nextGroup) => {
    if (isCreateMode) {
      return [...groups, nextGroup];
    }
    return groups.map((item) => (item.id === nextGroup.id ? nextGroup : item));
  };

  const handleSave = async () => {
    const nextGroups = buildNextGroups(group);
    const validation = validateScheduleConfig({ groups: nextGroups }, validationContext);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL, {
        method: 'PUT',
        body: JSON.stringify({ groups: nextGroups })
      });
      if (!response.ok || data?.ok === false) {
        setErrors(data?.errors || [{ message: data?.reason || '保存排班配置失败' }]);
        return;
      }
      message.success('排班配置已保存');
      router.push('/schedules');
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '保存排班配置失败' }]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const nextGroups = groups.filter((item) => item.id !== group?.id);
    const validation = validateScheduleConfig({ groups: nextGroups }, validationContext);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL, {
        method: 'PUT',
        body: JSON.stringify({ groups: nextGroups })
      });
      if (!response.ok || data?.ok === false) {
        setErrors(data?.errors || [{ message: data?.reason || '删除排班规则失败' }]);
        return;
      }
      message.success('排班规则已删除');
      router.push('/schedules');
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '删除排班规则失败' }]);
    } finally {
      setSaving(false);
    }
  };

  if (notFound) {
    return (
      <Space direction="vertical" size="middle" className="admin-config-page">
        <Alert
          type="error"
          showIcon
          message="排班规则不存在"
          description="该排班规则可能已被删除，请返回列表重新选择。"
        />
        <Link href="/schedules">
          <Button icon={<ArrowLeftOutlined />}>返回列表</Button>
        </Link>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      <Card>
        <div className="admin-config-toolbar">
          <Space direction="vertical" size={2}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {isCreateMode ? '新增排班规则' : '编辑排班规则'}
            </Typography.Title>
            <Typography.Text type="secondary">
              配置分组名称、系统范围、基础排班和险种排班小组。
            </Typography.Text>
          </Space>
          <Space wrap>
            <Link href="/schedules">
              <Button icon={<ArrowLeftOutlined />}>返回列表</Button>
            </Link>
            {!isCreateMode && (
              <Popconfirm
                title="删除排班规则"
                description="确认删除该排班规则？"
                onConfirm={handleDelete}
              >
                <Button danger icon={<DeleteOutlined />} loading={saving}>
                  删除
                </Button>
              </Popconfirm>
            )}
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!group}>
              保存
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
        {group && (
          <Card className="schedule-group-card">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Typography.Text strong>分组名称</Typography.Text>
                <Input
                  value={group.name}
                  placeholder="例如 ERP 排班组"
                  onChange={(event) => updateGroup({ name: event.target.value })}
                />
              </Col>
              <Col xs={24} md={16}>
                <Typography.Text strong>系统范围</Typography.Text>
                <Select
                  mode="multiple"
                  value={group.systemCodes}
                  options={systemOptions}
                  placeholder="请选择系统"
                  onChange={(systemCodes) => updateGroup({ systemCodes })}
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
                  onChange={updateBaseSchedule}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>

            <Divider orientation="left">险种排班小组</Divider>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {(group.insuranceTeams || []).map((team, teamIndex) => (
                <div key={team.id} className="schedule-team-panel">
                  <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} md={10}>
                      <Typography.Text strong>人员</Typography.Text>
                      <Select
                        mode="multiple"
                        value={team.userIds}
                        options={userOptions}
                        placeholder="请选择一线人员"
                        onChange={(userIds) => updateInsuranceTeam(teamIndex, { userIds })}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col xs={24} md={10}>
                      <Typography.Text strong>险种</Typography.Text>
                      <Select
                        mode="multiple"
                        value={team.insuranceTypeCodes}
                        options={insuranceOptions}
                        placeholder="请选择启用险种"
                        onChange={(insuranceTypeCodes) => updateInsuranceTeam(teamIndex, { insuranceTypeCodes })}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col xs={24} md={2}>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeInsuranceTeam(teamIndex)}
                      />
                    </Col>
                  </Row>
                </div>
              ))}
              <Button icon={<PlusOutlined />} onClick={addInsuranceTeam}>
                新增险种小组
              </Button>
            </Space>

            <Divider orientation="left">灵活规则</Divider>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {(group.flexibleRules || []).map((rule, ruleIndex) => (
                <div key={rule.id} className="schedule-team-panel">
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Row gutter={[12, 12]} align="middle">
                      <Col xs={24} md={20}>
                        <Typography.Text strong>系统范围</Typography.Text>
                        <Select
                          mode="multiple"
                          value={rule.systemCodes}
                          options={systemOptions}
                          placeholder="请选择适用系统"
                          onChange={(systemCodes) => updateFlexibleRule(ruleIndex, { systemCodes })}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col xs={24} md={4}>
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeFlexibleRule(ruleIndex)}
                        >
                          删除规则
                        </Button>
                      </Col>
                    </Row>

                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      {(rule.assignees || []).map((assignee, assigneeIndex) => (
                        <Row key={`${rule.id}_${assigneeIndex}`} gutter={[12, 12]} align="middle">
                          <Col xs={24} md={10}>
                            <Typography.Text strong>人员</Typography.Text>
                            <Select
                              value={assignee.userId || undefined}
                              options={userOptions}
                              placeholder="请选择一线人员"
                              onChange={(userId) => updateFlexibleAssignee(ruleIndex, assigneeIndex, { userId })}
                              style={{ width: '100%' }}
                            />
                          </Col>
                          <Col xs={24} md={10}>
                            <Typography.Text strong>派单比例</Typography.Text>
                            <InputNumber
                              min={0}
                              value={assignee.ratio}
                              placeholder="请输入派单比例"
                              onChange={(ratio) => updateFlexibleAssignee(ruleIndex, assigneeIndex, { ratio })}
                              style={{ width: '100%' }}
                            />
                          </Col>
                          <Col xs={24} md={4}>
                            <Button
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => removeFlexibleAssignee(ruleIndex, assigneeIndex)}
                            />
                          </Col>
                        </Row>
                      ))}
                      <Button icon={<PlusOutlined />} onClick={() => addFlexibleAssignee(ruleIndex)}>
                        新增人员比例
                      </Button>
                    </Space>
                  </Space>
                </div>
              ))}
              <Button icon={<PlusOutlined />} onClick={addFlexibleRule}>
                新增灵活规则
              </Button>
            </Space>
          </Card>
        )}
      </Spin>
    </Space>
  );
}

function createEmptyGroup() {
  return {
    id: localId('grp'),
    name: '',
    systemCodes: [],
    baseSchedule: { userIds: [] },
    insuranceTeams: [],
    flexibleRules: []
  };
}

function localId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
