export const INSURANCE_DICTIONARY_TYPE = 'INSURANCE_TYPE';
export const SCHEDULE_CONFIG_KEY = 'SCHEDULE_CONFIG';
export const SUPPORT_REST_CONFIG_KEY = 'SUPPORT_REST_CONFIG';
export const DATA_FIX_SCHEME_CONFIG_KEY = 'DATA_FIX_SCHEME_CONFIG';
export const SYSTEM_CONFIG_KEY = 'SYSTEM_CONFIG';
export const SYSTEM_CATEGORIES = ['OLD', 'NEW'];

export function validateInsuranceTypeInput(input = {}, existingItems = [], currentId = null) {
  const code = normalizeCode(input.code);
  const name = String(input.name || '').trim();
  const errors = [];

  if (!code) {
    errors.push({ path: ['code'], message: '请输入险种编码' });
  }
  if (!name) {
    errors.push({ path: ['name'], message: '请输入险种名称' });
  }

  const comparableItems = existingItems.filter((item) => item.id !== currentId);
  if (code && comparableItems.some((item) => normalizeCode(item.code) === code)) {
    errors.push({ path: ['code'], message: '险种编码已存在' });
  }
  if (name && comparableItems.some((item) => String(item.name || '').trim() === name)) {
    errors.push({ path: ['name'], message: '险种名称已存在' });
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      code,
      name,
      enabled: input.enabled !== false
    }
  };
}

export function normalizeScheduleConfig(input = {}) {
  return {
    groups: Array.isArray(input.groups)
      ? input.groups.map((group, groupIndex) => ({
          id: String(group.id || `grp_${groupIndex + 1}`),
          name: String(group.name || '').trim(),
          systemCodes: uniqueStrings(group.systemCodes),
          baseSchedule: {
            userIds: uniqueStrings(group.baseSchedule?.userIds)
          },
          insuranceTeams: Array.isArray(group.insuranceTeams)
            ? group.insuranceTeams.map((team, teamIndex) => ({
                id: String(team.id || `team_${groupIndex + 1}_${teamIndex + 1}`),
                name: String(team.name || '').trim(),
                userIds: uniqueStrings(team.userIds),
                insuranceTypeCodes: uniqueStrings(team.insuranceTypeCodes)
              }))
            : [],
          flexibleRules: Array.isArray(group.flexibleRules)
            ? group.flexibleRules.map((rule, ruleIndex) => ({
                id: String(rule.id || `flex_${groupIndex + 1}_${ruleIndex + 1}`),
                systemCodes: uniqueStrings(rule.systemCodes),
                assignees: Array.isArray(rule.assignees)
                  ? rule.assignees.map((assignee) => ({
                      userId: String(assignee.userId || '').trim(),
                      ratio: Number(assignee.ratio)
                    }))
                  : []
              }))
            : []
        }))
      : []
  };
}

export function validateScheduleConfig(input = {}, context = {}) {
  const value = normalizeScheduleConfig(input);
  const errors = [];
  const systemsByCode = new Map((context.systems || []).map((item) => [item.value, item]));
  const insuranceByCode = new Map((context.enabledInsuranceTypes || []).map((item) => [item.code, item]));
  const userById = new Map((context.assignableUsers || []).map((item) => [item.id, item]));
  const systemOwner = new Map();

  value.groups.forEach((group, groupIndex) => {
    if (!group.name) {
      errors.push({ path: ['groups', groupIndex, 'name'], message: '请输入排班分组名称' });
    }
    if (!group.systemCodes.length) {
      errors.push({ path: ['groups', groupIndex, 'systemCodes'], message: '请选择系统' });
    }
    if (!group.baseSchedule.userIds.length) {
      errors.push({ path: ['groups', groupIndex, 'baseSchedule', 'userIds'], message: '基础排班至少选择一名一线人员' });
    }

    for (const systemCode of group.systemCodes) {
      if (!systemsByCode.has(systemCode)) {
        errors.push({ path: ['groups', groupIndex, 'systemCodes'], message: `系统 ${systemCode} 不存在` });
      } else if (systemOwner.has(systemCode)) {
        errors.push({ path: ['groups', groupIndex, 'systemCodes'], message: `${systemsByCode.get(systemCode).label}已出现在其他排班分组中` });
      } else {
        systemOwner.set(systemCode, groupIndex);
      }
    }

    for (const userId of group.baseSchedule.userIds) {
      if (!userById.has(userId)) {
        errors.push({ path: ['groups', groupIndex, 'baseSchedule', 'userIds'], message: `人员 ${userId} 不是可选一线人员` });
      }
    }

    validateInsuranceTeams(group, groupIndex, userById, insuranceByCode, errors);
    validateFlexibleRules(group, groupIndex, systemsByCode, userById, errors);
  });

  return { ok: errors.length === 0, errors, value };
}

export function normalizeSupportRestConfig(input = {}) {
  return {
    restPeriods: Array.isArray(input.restPeriods)
      ? input.restPeriods.map((period, periodIndex) => ({
          id: String(period.id || `rest_${periodIndex + 1}`),
          userIds: uniqueStrings(period.userIds),
          startsAt: normalizeIsoTime(period.startsAt),
          endsAt: normalizeIsoTime(period.endsAt),
          reason: String(period.reason || '').trim()
        }))
      : []
  };
}

export function validateSupportRestConfig(input = {}, context = {}) {
  const value = normalizeSupportRestConfig(input);
  const errors = [];
  const userById = new Map((context.assignableUsers || []).map((item) => [item.id, item]));
  const periodsByUser = new Map();

  value.restPeriods.forEach((period, periodIndex) => {
    const startsAtTime = Date.parse(period.startsAt);
    const endsAtTime = Date.parse(period.endsAt);
    const hasValidStart = Number.isFinite(startsAtTime);
    const hasValidEnd = Number.isFinite(endsAtTime);

    if (!period.userIds.length) {
      errors.push({ path: ['restPeriods', periodIndex, 'userIds'], message: '请选择一线技术支持人员' });
    }
    if (!hasValidStart) {
      errors.push({ path: ['restPeriods', periodIndex, 'startsAt'], message: '请选择休息开始时间' });
    }
    if (!hasValidEnd) {
      errors.push({ path: ['restPeriods', periodIndex, 'endsAt'], message: '请选择休息结束时间' });
    }
    if (hasValidStart && hasValidEnd && startsAtTime >= endsAtTime) {
      errors.push({ path: ['restPeriods', periodIndex, 'endsAt'], message: '结束时间必须晚于开始时间' });
    }

    for (const userId of period.userIds) {
      const user = userById.get(userId);
      if (!user) {
        errors.push({ path: ['restPeriods', periodIndex, 'userIds'], message: `人员 ${userId} 不是可选一线人员` });
        continue;
      }

      if (!hasValidStart || !hasValidEnd || startsAtTime >= endsAtTime) {
        continue;
      }

      const currentUserPeriods = periodsByUser.get(userId) || [];
      if (currentUserPeriods.some((existing) => startsAtTime < existing.endsAtTime && existing.startsAtTime < endsAtTime)) {
        errors.push({ path: ['restPeriods', periodIndex, 'startsAt'], message: `${user.name} 存在重叠休息时间` });
      }
      currentUserPeriods.push({ startsAtTime, endsAtTime });
      periodsByUser.set(userId, currentUserPeriods);
    }
  });

  return { ok: errors.length === 0, errors, value };
}

export function normalizeDataFixSchemeConfig(input = {}) {
  return {
    schemes: Array.isArray(input.schemes)
      ? input.schemes.map((scheme, schemeIndex) => ({
          id: String(scheme.id || `scheme_${schemeIndex + 1}`),
          title: String(scheme.title || '').trim(),
          description: String(scheme.description || '').trim()
        }))
      : []
  };
}

export function normalizeSystemConfig(input = {}) {
  return {
    systems: Array.isArray(input.systems)
      ? input.systems.map((system, systemIndex) => {
          const code = normalizeCode(system.code || system.value);
          return {
            id: String(system.id || `sys_${code || systemIndex + 1}`),
            code,
            name: String(system.name || system.label || '').trim(),
            category: SYSTEM_CATEGORIES.includes(system.category) ? system.category : 'OLD',
            visibleInSubmit: system.visibleInSubmit !== false
          };
        })
      : []
  };
}

export function validateSystemConfig(input = {}) {
  const value = normalizeSystemConfig(input);
  const errors = [];
  const codeOwner = new Map();

  value.systems.forEach((system, systemIndex) => {
    if (!system.code) {
      errors.push({ path: ['systems', systemIndex, 'code'], message: '请输入系统编码' });
    }
    if (!system.name) {
      errors.push({ path: ['systems', systemIndex, 'name'], message: '请输入系统名称' });
    }
    if (!SYSTEM_CATEGORIES.includes(system.category)) {
      errors.push({ path: ['systems', systemIndex, 'category'], message: '请选择新老系统标签' });
    }
    if (system.code) {
      if (codeOwner.has(system.code)) {
        errors.push({ path: ['systems', systemIndex, 'code'], message: `系统编码 ${system.code} 已存在` });
      } else {
        codeOwner.set(system.code, systemIndex);
      }
    }
  });

  return { ok: errors.length === 0, errors, value };
}

export function validateDataFixSchemeConfig(input = {}) {
  const value = normalizeDataFixSchemeConfig(input);
  const errors = [];

  value.schemes.forEach((scheme, schemeIndex) => {
    if (!scheme.title) {
      errors.push({ path: ['schemes', schemeIndex, 'title'], message: '请输入方案标题' });
    }
    if (!scheme.description) {
      errors.push({ path: ['schemes', schemeIndex, 'description'], message: '请输入方案描述' });
    }
  });

  return { ok: errors.length === 0, errors, value };
}

export function buildUpcomingSupportRestDays(config = {}, users = [], options = {}) {
  const rangeDays = Number(options.days || 14);
  const windowStart = startOfLocalDay(options.from ? new Date(options.from) : new Date());
  const windowEnd = new Date(windowStart.getTime() + rangeDays * 24 * 60 * 60 * 1000);
  const userById = new Map((users || []).map((user) => [user.id, user]));
  const normalized = normalizeSupportRestConfig(config);

  const days = [];
  for (let dayIndex = 0; dayIndex < rangeDays; dayIndex += 1) {
    const dayStart = new Date(windowStart.getTime() + dayIndex * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const items = [];

    for (const period of normalized.restPeriods) {
      const startsAtTime = Date.parse(period.startsAt);
      const endsAtTime = Date.parse(period.endsAt);
      if (!Number.isFinite(startsAtTime) || !Number.isFinite(endsAtTime)) continue;
      if (startsAtTime >= endsAtTime) continue;
      if (startsAtTime >= windowEnd.getTime() || endsAtTime <= windowStart.getTime()) continue;
      if (startsAtTime >= dayEnd.getTime() || endsAtTime <= dayStart.getTime()) continue;

      const dayStartsAt = new Date(Math.max(startsAtTime, dayStart.getTime())).toISOString();
      const dayEndsAt = new Date(Math.min(endsAtTime, dayEnd.getTime())).toISOString();
      items.push({
        id: period.id,
        userIds: period.userIds,
        userNames: period.userIds.map((userId) => userById.get(userId)?.name || userId),
        startsAt: period.startsAt,
        endsAt: period.endsAt,
        dayStartsAt,
        dayEndsAt,
        reason: period.reason
      });
    }

    if (items.length) {
      days.push({
        date: formatLocalDate(dayStart),
        items: items.sort((left, right) => left.dayStartsAt.localeCompare(right.dayStartsAt))
      });
    }
  }

  return days;
}

function validateInsuranceTeams(group, groupIndex, userById, insuranceByCode, errors) {
  const teamUserOwner = new Map();
  const teamInsuranceOwner = new Map();

  group.insuranceTeams.forEach((team, teamIndex) => {
    for (const userId of team.userIds) {
      if (!userById.has(userId)) {
        errors.push({ path: ['groups', groupIndex, 'insuranceTeams', teamIndex, 'userIds'], message: `人员 ${userId} 不是可选一线人员` });
      } else if (teamUserOwner.has(userId)) {
        errors.push({ path: ['groups', groupIndex, 'insuranceTeams', teamIndex, 'userIds'], message: `${userById.get(userId).name} 已出现在本分组其他险种小组中` });
      } else {
        teamUserOwner.set(userId, teamIndex);
      }
    }

    for (const insuranceCode of team.insuranceTypeCodes) {
      if (!insuranceByCode.has(insuranceCode)) {
        errors.push({ path: ['groups', groupIndex, 'insuranceTeams', teamIndex, 'insuranceTypeCodes'], message: `险种 ${insuranceCode} 不存在或未启用` });
      } else if (teamInsuranceOwner.has(insuranceCode)) {
        errors.push({ path: ['groups', groupIndex, 'insuranceTeams', teamIndex, 'insuranceTypeCodes'], message: `${insuranceByCode.get(insuranceCode).name} 已出现在本分组其他险种小组中` });
      } else {
        teamInsuranceOwner.set(insuranceCode, teamIndex);
      }
    }
  });
}

function validateFlexibleRules(group, groupIndex, systemsByCode, userById, errors) {
  const groupSystemCodes = new Set(group.systemCodes);
  const flexibleSystemOwner = new Map();

  group.flexibleRules.forEach((rule, ruleIndex) => {
    const ruleUserOwner = new Map();

    if (!rule.systemCodes.length) {
      errors.push({ path: ['groups', groupIndex, 'flexibleRules', ruleIndex, 'systemCodes'], message: '灵活规则至少选择一个系统' });
    }

    if (!rule.assignees.length) {
      errors.push({ path: ['groups', groupIndex, 'flexibleRules', ruleIndex, 'assignees'], message: '灵活规则至少配置一名人员' });
    }

    for (const systemCode of rule.systemCodes) {
      const system = systemsByCode.get(systemCode);
      if (!system) {
        errors.push({ path: ['groups', groupIndex, 'flexibleRules', ruleIndex, 'systemCodes'], message: `系统 ${systemCode} 不存在` });
        continue;
      }
      if (!groupSystemCodes.has(systemCode)) {
        errors.push({ path: ['groups', groupIndex, 'flexibleRules', ruleIndex, 'systemCodes'], message: `${system.label}不在当前排班规则系统范围内` });
        continue;
      }
      if (flexibleSystemOwner.has(systemCode)) {
        errors.push({ path: ['groups', groupIndex, 'flexibleRules', ruleIndex, 'systemCodes'], message: `${system.label}已出现在本分组其他灵活规则中` });
        continue;
      }
      flexibleSystemOwner.set(systemCode, ruleIndex);
    }

    rule.assignees.forEach((assignee, assigneeIndex) => {
      const user = userById.get(assignee.userId);
      const userName = user?.name || assignee.userId || '人员';

      if (!user) {
        errors.push({
          path: ['groups', groupIndex, 'flexibleRules', ruleIndex, 'assignees', assigneeIndex, 'userId'],
          message: `人员 ${assignee.userId} 不是可选一线人员`
        });
      } else if (ruleUserOwner.has(assignee.userId)) {
        errors.push({
          path: ['groups', groupIndex, 'flexibleRules', ruleIndex, 'assignees', assigneeIndex, 'userId'],
          message: `${user.name} 已出现在本灵活规则中`
        });
      } else {
        ruleUserOwner.set(assignee.userId, assigneeIndex);
      }

      if (!Number.isFinite(assignee.ratio) || assignee.ratio <= 0) {
        errors.push({
          path: ['groups', groupIndex, 'flexibleRules', ruleIndex, 'assignees', assigneeIndex, 'ratio'],
          message: `${userName} 的派单比例必须大于 0`
        });
      }
    });
  });
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeIsoTime(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : String(value || '').trim();
}

function startOfLocalDay(date) {
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
