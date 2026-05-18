export function buildScheduleGroupRow(group = {}, context = {}) {
  const systemsByCode = buildSystemsByCode(context.systems);
  const usersById = buildUsersById(context.users);
  const systemSummary = summarizeSystems(group.systemCodes, systemsByCode);
  const userSummary = summarizeUsers(group, usersById);

  return {
    key: group.id,
    id: group.id,
    name: group.name || '未命名排班规则',
    systemSummary,
    userSummary,
    group
  };
}

export function filterScheduleGroups(groups = [], filters = {}, context = {}) {
  const systemKeyword = normalizeKeyword(filters.systemKeyword);
  const userKeyword = normalizeKeyword(filters.userKeyword);
  const systemsByCode = buildSystemsByCode(context.systems);
  const usersById = buildUsersById(context.users);

  return groups.filter((group) => {
    const matchesSystem = !systemKeyword || getGroupSystemSearchText(group, systemsByCode).includes(systemKeyword);
    const matchesUser = !userKeyword || getGroupUserSearchText(group, usersById).includes(userKeyword);
    return matchesSystem && matchesUser;
  });
}

function summarizeSystems(systemCodes = [], systemsByCode) {
  const names = systemCodes.map((code) => systemsByCode.get(code)?.label || code).filter(Boolean);
  return names.length ? names.join('、') : '未配置系统';
}

function summarizeUsers(group = {}, usersById) {
  const summaries = [];
  const baseNames = userIdsToNames(group.baseSchedule?.userIds, usersById);

  if (baseNames.length) {
    summaries.push(`基础：${baseNames.join('、')}`);
  }

  for (const team of group.insuranceTeams || []) {
    const teamNames = userIdsToNames(team.userIds, usersById);
    if (teamNames.length) {
      summaries.push(`${team.name || '险种小组'}：${teamNames.join('、')}`);
    }
  }

  return summaries.length ? summaries.join('；') : '未配置人员';
}

function getGroupSystemSearchText(group = {}, systemsByCode) {
  return normalizeKeyword(
    (group.systemCodes || [])
      .flatMap((code) => [code, systemsByCode.get(code)?.label])
      .filter(Boolean)
      .join(' ')
  );
}

function getGroupUserSearchText(group = {}, usersById) {
  const userIds = [
    ...(group.baseSchedule?.userIds || []),
    ...(group.insuranceTeams || []).flatMap((team) => team.userIds || [])
  ];

  return normalizeKeyword(
    userIds
      .flatMap((userId) => {
        const user = usersById.get(userId);
        return [userId, user?.name, user?.username];
      })
      .filter(Boolean)
      .join(' ')
  );
}

function userIdsToNames(userIds = [], usersById) {
  return userIds.map((userId) => usersById.get(userId)?.name || userId).filter(Boolean);
}

function buildSystemsByCode(systems = []) {
  return new Map(systems.map((item) => [item.value, item]));
}

function buildUsersById(users = []) {
  return new Map(users.map((item) => [item.id, item]));
}

function normalizeKeyword(value) {
  return String(value || '').trim().toLowerCase();
}
