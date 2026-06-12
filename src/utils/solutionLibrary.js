import { ROLES } from '../constants/roles.js';
import { normalizeSystemCode } from '../constants/systems.js';
import { richTextHasContent, richTextPlainTextToDoc, richTextToPlainText, richTextValueToHtml } from './richText.js';

export const SOLUTION_EDIT_PERMISSION = {
  ADMIN_ONLY: 'ADMIN_ONLY',
  ASSIGNED_TEAMS: 'ASSIGNED_TEAMS'
};

export const SOLUTION_REFERENCE_PERMISSION = {
  COMPANY: 'COMPANY',
  ASSIGNED_GROUPS: 'ASSIGNED_GROUPS'
};

export const SOLUTION_CHANGE_TYPE = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  ENABLE: 'ENABLE',
  DISABLE: 'DISABLE',
  ROLLBACK: 'ROLLBACK',
  IMPORT: 'IMPORT'
};

export const SOLUTION_REFERENCE_CHANNEL = {
  MESSAGE_REPLY: 'MESSAGE_REPLY'
};

const SUPPORT_ROLES = new Set([ROLES.L1, ROLES.L2]);
const DISABLED_DISPLAY_VALUES = new Set(['停用', 'false', '否', 'disabled', 'disable', '0']);
const ENABLED_DISPLAY_VALUES = new Set(['启用', 'true', '是', 'enabled', 'enable', '1']);

export function normalizeSolutionInput(input = {}, context = {}) {
  const detailHtml = normalizeDetailHtml(input);
  const editPermission = Object.values(SOLUTION_EDIT_PERMISSION).includes(input.editPermission)
    ? input.editPermission
    : SOLUTION_EDIT_PERMISSION.ADMIN_ONLY;
  const referencePermission = Object.values(SOLUTION_REFERENCE_PERMISSION).includes(input.referencePermission)
    ? input.referencePermission
    : SOLUTION_REFERENCE_PERMISSION.COMPANY;

  return {
    code: String(input.code || '').trim().toUpperCase(),
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    detailHtml,
    detailText: richTextToPlainText(detailHtml),
    enabled: normalizeEnabled(input.enabled),
    insuranceTypeIds: uniqueStrings(input.insuranceTypeIds),
    relatedInternalSchemeIds: uniqueStrings(input.relatedInternalSchemeIds),
    thirdPartyDataFixScheme: normalizeThirdPartyDataFixScheme(input.thirdPartyDataFixScheme),
    ticketTypes: uniqueNormalizedStrings(input.ticketTypes, (value) => value.toUpperCase()),
    systemCodes: uniqueNormalizedStrings(input.systemCodes, normalizeSystemCode),
    problemTypeIds: uniqueStrings(input.problemTypeIds),
    permissions: {
      editPermission,
      teamRoles: normalizeSupportRoles(input.teamRoles),
      referencePermission,
      groupRoles: normalizeSupportRoles(input.groupRoles)
    }
  };
}

export function validateSolutionInput(input = {}, context = {}) {
  const value = normalizeSolutionInput(input, context);
  const errors = [];

  if (!value.code) errors.push({ path: ['code'], message: '请输入方案编码' });
  if (!value.title) errors.push({ path: ['title'], message: '请输入方案标题' });
  if (!value.description) errors.push({ path: ['description'], message: '请输入方案描述' });
  if (!richTextHasContent(value.detailHtml)) errors.push({ path: ['detailHtml'], message: '请输入详细说明' });

  const knownSystemCodes = new Set((context.systems || []).map((system) => normalizeSystemCode(system.code || system.value)).filter(Boolean));
  if (Array.isArray(context.systems) && value.systemCodes.some((code) => !knownSystemCodes.has(code))) {
    errors.push({ path: ['systemCodes'], message: '业务系统不存在' });
  }

  const knownInsuranceTypeIds = new Set((context.insuranceTypes || []).map((item) => String(item.id || '').trim()).filter(Boolean));
  if (Array.isArray(context.insuranceTypes) && value.insuranceTypeIds.some((id) => !knownInsuranceTypeIds.has(id))) {
    errors.push({ path: ['insuranceTypeIds'], message: '适用险种不存在' });
  }

  const knownProblemTypeIds = new Set((context.problemTypes || []).map((item) => String(item.id || '').trim()).filter(Boolean));
  if (Array.isArray(context.problemTypes) && value.problemTypeIds.some((id) => !knownProblemTypeIds.has(id))) {
    errors.push({ path: ['problemTypeIds'], message: '问题类型不存在' });
  }

  if (hasInvalidSupportRole(input.teamRoles)) {
    errors.push({ path: ['teamRoles'], message: '编辑团队只能选择一线或二线支持' });
  }
  if (hasInvalidSupportRole(input.groupRoles)) {
    errors.push({ path: ['groupRoles'], message: '引用处理组只能选择一线或二线支持' });
  }

  return { ok: errors.length === 0, errors, value };
}

export function buildSolutionSnapshot(solution = {}) {
  return {
    id: solution.id,
    code: solution.code,
    title: solution.title,
    versionNo: solution.versionNo,
    enabled: solution.enabled !== false,
    description: solution.description || '',
    detailHtml: solution.detailHtml || '',
    detailText: solution.detailText || '',
    classification: {
      insuranceTypeIds: uniqueStrings(solution.insuranceTypeIds || solution.classification?.insuranceTypeIds),
      relatedInternalSchemeIds: uniqueStrings(solution.relatedInternalSchemeIds || solution.classification?.relatedInternalSchemeIds),
      ticketTypes: uniqueStrings(solution.ticketTypes || solution.classification?.ticketTypes),
      systemCodes: uniqueStrings(solution.systemCodes || solution.classification?.systemCodes).map(normalizeSystemCode).filter(Boolean),
      problemTypeIds: uniqueStrings(solution.problemTypeIds || solution.classification?.problemTypeIds)
    },
    thirdPartyDataFixScheme: normalizeThirdPartyDataFixScheme(solution.thirdPartyDataFixScheme),
    permissions: clonePermissions(solution.permissions || solution),
    stats: deepCloneObject(solution.stats || {})
  };
}

export function filterSolutions(solutions = [], filters = {}) {
  const keyword = normalizeSearch(filters.keyword);
  const hasEnabledFilter = filters.enabled !== undefined && filters.enabled !== '';
  const enabled = normalizeEnabled(filters.enabled);
  const insuranceTypeId = String(filters.insuranceTypeId || '').trim();
  const systemCode = normalizeSystemCode(filters.systemCode);
  const problemTypeId = String(filters.problemTypeId || '').trim();
  const ticketType = String(filters.ticketType || '').trim().toUpperCase();

  return (Array.isArray(solutions) ? solutions : []).filter((item) => {
    const searchText = normalizeSearch([item.code, item.title, item.description, item.detailText].filter(Boolean).join(' '));

    if (keyword && !searchText.includes(keyword)) return false;
    if (hasEnabledFilter && (item.enabled !== false) !== enabled) return false;
    if (insuranceTypeId && !arrayIncludes(item.insuranceTypeIds || item.classification?.insuranceTypeIds, insuranceTypeId)) return false;
    if (systemCode && !uniqueStrings(item.systemCodes || item.classification?.systemCodes).map(normalizeSystemCode).includes(systemCode)) return false;
    if (problemTypeId && !arrayIncludes(item.problemTypeIds || item.classification?.problemTypeIds, problemTypeId)) return false;
    if (ticketType && !uniqueStrings(item.ticketTypes || item.classification?.ticketTypes).map((value) => value.toUpperCase()).includes(ticketType)) return false;
    return true;
  });
}

export function canEditSolution(solution, user) {
  if (user?.role === ROLES.ADMIN) return true;
  const permissions = solution?.permissions || {};
  if (permissions.editPermission !== SOLUTION_EDIT_PERMISSION.ASSIGNED_TEAMS) return false;
  return SUPPORT_ROLES.has(user?.role) && uniqueStrings(permissions.teamRoles).includes(user.role);
}

export function canReferenceSolution(solution, user) {
  if (!solution || solution.enabled === false) return false;
  if (!SUPPORT_ROLES.has(user?.role)) return false;

  const permissions = solution.permissions || {};
  if ((permissions.referencePermission || SOLUTION_REFERENCE_PERMISSION.COMPANY) === SOLUTION_REFERENCE_PERMISSION.COMPANY) {
    return true;
  }

  if (permissions.referencePermission === SOLUTION_REFERENCE_PERMISSION.ASSIGNED_GROUPS) {
    return uniqueStrings(permissions.groupRoles).includes(user.role);
  }

  return false;
}

export function mapSolutionToExportRow(solution, context = {}) {
  const permissions = clonePermissions(solution.permissions || solution);

  return {
    方案编码: solution.code || '',
    方案标题: solution.title || '',
    方案描述: solution.description || '',
    详细说明: solution.detailText || richTextToPlainText(solution.detailHtml || ''),
    启用状态: solution.enabled === false ? '停用' : '启用',
    适用险种: joinDisplayNames(solution.insuranceTypeIds || solution.classification?.insuranceTypeIds, buildDisplayMap(context.insuranceTypes, 'id')),
    关联内部方案: uniqueStrings(solution.relatedInternalSchemeIds || solution.classification?.relatedInternalSchemeIds).join('、'),
    关联第三方数据修正方案: formatThirdPartyDataFixScheme(solution.thirdPartyDataFixScheme),
    工单类型: uniqueStrings(solution.ticketTypes || solution.classification?.ticketTypes).join('、'),
    业务系统: joinDisplayNames(solution.systemCodes || solution.classification?.systemCodes, buildSystemDisplayMap(context.systems)),
    问题类型: joinDisplayNames(solution.problemTypeIds || solution.classification?.problemTypeIds, buildDisplayMap(context.problemTypes, 'id')),
    编辑权限: permissions.editPermission,
    编辑团队: permissions.teamRoles.join('、'),
    引用权限: permissions.referencePermission,
    引用处理组: permissions.groupRoles.join('、')
  };
}

export function parseSolutionImportRow(row, context = {}) {
  return {
    code: row?.方案编码,
    title: row?.方案标题,
    description: row?.方案描述,
    detail: row?.详细说明,
    enabled: parseEnabledDisplay(row?.启用状态),
    insuranceTypeIds: splitDisplayValues(row?.适用险种).map((value) => resolveDictionaryValue(value, context.insuranceTypes, 'id')),
    relatedInternalSchemeIds: splitDisplayValues(row?.关联内部方案),
    thirdPartyDataFixScheme: parseThirdPartyDataFixSchemeDisplay(row?.关联第三方数据修正方案),
    ticketTypes: splitDisplayValues(row?.工单类型).map((value) => value.toUpperCase()),
    systemCodes: splitDisplayValues(row?.业务系统).map((value) => resolveSystemValue(value, context.systems)),
    problemTypeIds: splitDisplayValues(row?.问题类型).map((value) => resolveDictionaryValue(value, context.problemTypes, 'id')),
    editPermission: row?.编辑权限,
    teamRoles: splitDisplayValues(row?.编辑团队),
    referencePermission: row?.引用权限,
    groupRoles: splitDisplayValues(row?.引用处理组)
  };
}

function normalizeDetailHtml(input) {
  if (input.detailDoc) return richTextValueToHtml(input.detailDoc);
  if (input.detailHtml !== undefined) return richTextValueToHtml(input.detailHtml);
  if (input.detail !== undefined) {
    const detail = String(input.detail || '');
    if (/<[a-z][\s\S]*>/i.test(detail)) return richTextValueToHtml(detail);
    return richTextValueToHtml(richTextPlainTextToDoc(detail));
  }
  return '';
}

function normalizeEnabled(value) {
  if (value === false) return false;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (DISABLED_DISPLAY_VALUES.has(normalized)) return false;
  return true;
}

function parseEnabledDisplay(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (DISABLED_DISPLAY_VALUES.has(normalized)) return false;
  if (ENABLED_DISPLAY_VALUES.has(normalized)) return true;
  return value;
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function uniqueNormalizedStrings(values = [], normalize) {
  return [...new Set(uniqueStrings(values).map(normalize).filter(Boolean))];
}

function normalizeSupportRoles(values = []) {
  return uniqueStrings(values).filter((role) => SUPPORT_ROLES.has(role));
}

function normalizeThirdPartyDataFixScheme(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return parseThirdPartyDataFixSchemeDisplay(value);
  }
  if (typeof value !== 'object') return null;
  const id = String(value.id || '').trim();
  const code = String(value.code || '').trim().toUpperCase();
  const title = String(value.title || value.name || '').trim();
  const sourceSystem = String(value.sourceSystem || '').trim();
  const description = String(value.description || '').trim();
  if (!id && !code && !title) return null;
  return { id, code, title, sourceSystem, description };
}

function formatThirdPartyDataFixScheme(value) {
  const scheme = normalizeThirdPartyDataFixScheme(value);
  if (!scheme) return '';
  return [scheme.code, scheme.title].filter(Boolean).join(' ');
}

function parseThirdPartyDataFixSchemeDisplay(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const [codeCandidate, ...titleParts] = text.split(/\s+/);
  const looksLikeCode = /^[A-Z0-9][A-Z0-9_-]*$/i.test(codeCandidate || '');
  return {
    id: '',
    code: looksLikeCode ? codeCandidate.toUpperCase() : '',
    title: looksLikeCode ? titleParts.join(' ').trim() : text,
    sourceSystem: '',
    description: ''
  };
}

function hasInvalidSupportRole(values = []) {
  return uniqueStrings(values).some((role) => !SUPPORT_ROLES.has(role));
}

function clonePermissions(value = {}) {
  return {
    editPermission: Object.values(SOLUTION_EDIT_PERMISSION).includes(value.editPermission)
      ? value.editPermission
      : SOLUTION_EDIT_PERMISSION.ADMIN_ONLY,
    teamRoles: normalizeSupportRoles(value.teamRoles),
    referencePermission: Object.values(SOLUTION_REFERENCE_PERMISSION).includes(value.referencePermission)
      ? value.referencePermission
      : SOLUTION_REFERENCE_PERMISSION.COMPANY,
    groupRoles: normalizeSupportRoles(value.groupRoles)
  };
}

function arrayIncludes(values, expected) {
  return uniqueStrings(values).includes(expected);
}

function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function buildDisplayMap(items = [], key = 'id') {
  return new Map((Array.isArray(items) ? items : []).flatMap((item) => {
    const id = String(item[key] || '').trim();
    const code = String(item.code || '').trim();
    const name = String(item.name || item.label || code || id).trim();
    return [
      id ? [id, name] : null,
      code ? [code, name] : null
    ].filter(Boolean);
  }));
}

function buildSystemDisplayMap(systems = []) {
  return new Map((Array.isArray(systems) ? systems : []).flatMap((system) => {
    const code = normalizeSystemCode(system.code || system.value);
    const name = String(system.name || system.label || code).trim();
    return code ? [[code, name]] : [];
  }));
}

function joinDisplayNames(values = [], displayMap = new Map()) {
  return uniqueStrings(values)
    .map((value) => displayMap.get(value) || value)
    .join('、');
}

function splitDisplayValues(value) {
  return String(value || '')
    .split(/[、,，;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveDictionaryValue(value, items = [], key = 'id') {
  const normalized = String(value || '').trim();
  const normalizedCode = normalized.toUpperCase();
  const match = (Array.isArray(items) ? items : []).find((item) => {
    const id = String(item[key] || '').trim();
    const code = String(item.code || '').trim().toUpperCase();
    const name = String(item.name || item.label || '').trim();
    return normalized === id || normalizedCode === code || normalized === name;
  });
  return match ? String(match[key] || '').trim() : normalized;
}

function resolveSystemValue(value, systems = []) {
  const normalized = String(value || '').trim();
  const normalizedCode = normalizeSystemCode(normalized);
  const match = (Array.isArray(systems) ? systems : []).find((system) => {
    const code = normalizeSystemCode(system.code || system.value);
    const name = String(system.name || system.label || '').trim();
    return normalizedCode === code || normalized === name;
  });
  return match ? normalizeSystemCode(match.code || match.value) : normalizedCode;
}

function deepCloneObject(value) {
  if (!value || typeof value !== 'object') return {};
  return JSON.parse(JSON.stringify(value));
}
