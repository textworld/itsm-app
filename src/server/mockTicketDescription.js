import { PRIORITY_LABELS } from '../constants/priorities.js';
import { SYSTEM_LABELS } from '../constants/systems.js';
import { TOOL_TYPE_LABELS, TOOL_TYPES } from '../constants/toolTypes.js';

const ASSISTANT_ARTIFACT_PATTERNS = [
  /(^|\n)\s*可以[，,]/,
  /工单摘要/,
  /建议补充的信息/,
  /建议补充/,
  /处理建议/,
  /排查建议/,
  /字段清单/,
  /(^|\n)\s*[-*]\s+/,
  /标题：/,
  /工单类型：/,
  /优先级：/
];
const MIN_DESCRIPTION_LENGTH = 80;

export function buildMockTicketDescriptionMessages(ticket = {}) {
  return [
    {
      role: 'system',
      content:
        '你是企业 ITSM 系统里的提单人，请以提单人视角撰写“问题描述正文”。' +
        '正文必须像真实问题工单描述，包含问题现象、影响范围、复现或发现步骤、期望处理结果。' +
        '不要输出处理建议、排查方案、工单摘要、字段清单，也不要输出建议补充的信息。' +
        '不要 Markdown、不要标题、不要列表、不要寒暄，不要说“可以”。' +
        '只输出 120 到 220 字中文问题描述正文。'
    },
    {
      role: 'user',
      content: [
        '请根据以下工单基本信息生成问题描述正文，不要复述字段清单：',
        `标题：${formatTitle(ticket)}`,
        `工单类型：${formatToolType(ticket.toolType)}`,
        `优先级：${formatPriority(ticket.priority)}`,
        `系统：${formatSystem(ticket)}`,
        '输出要求：直接描述遇到的问题和业务影响，不要给解决方案或建议。'
      ].join('\n')
    }
  ];
}

export function prepareGeneratedMockTicketDescription(description, ticket = {}) {
  const normalizedDescription = normalizeDescription(description);
  if (!normalizedDescription) return '';

  const plainDescription = stripMarkdownMarkers(normalizedDescription);
  if (
    plainDescription.length < MIN_DESCRIPTION_LENGTH ||
    !/[。！？]$/.test(plainDescription) ||
    ASSISTANT_ARTIFACT_PATTERNS.some((pattern) => pattern.test(plainDescription))
  ) {
    return buildLocalMockTicketDescription(ticket);
  }

  return plainDescription;
}

export function buildLocalMockTicketDescription(ticket = {}) {
  const title = stripMockPrefix(formatTitle(ticket));
  const system = formatSystem(ticket);
  const toolType = formatToolType(ticket.toolType);
  const priority = formatPriority(ticket.priority);

  if (ticket.toolType === TOOL_TYPES.DATA_FIX) {
    return [
      `${system}在处理“${title}”相关业务时出现数据状态与实际业务不一致的情况，部分记录无法继续进入后续流程。`,
      `该问题归类为${toolType}，当前优先级为${priority}，已影响业务人员对账、发货或结果确认。`,
      '复现方式为进入对应业务列表后按异常条件筛选，可看到多笔记录停留在旧状态或显示结果不一致。',
      '期望协助核查受影响数据范围，并将异常记录修正为与实际业务一致的状态。'
    ].join('\n');
  }

  if (ticket.toolType === TOOL_TYPES.DATA_EXTRACT) {
    return [
      `${system}中需要围绕“${title}”获取业务数据，但当前页面导出范围和字段无法满足核对要求。`,
      `该问题归类为${toolType}，当前优先级为${priority}，影响业务人员按时完成统计、核算或运营分析。`,
      '复现方式为进入相关查询页面后按业务条件筛选，页面仅能查看部分结果，无法一次性获取完整明细。',
      '期望协助提取符合条件的数据明细，并确认字段口径和数据时间范围准确。'
    ].join('\n');
  }

  if (ticket.toolType === TOOL_TYPES.PERMISSION) {
    return [
      `${system}中“${title}”相关权限无法正常使用，用户进入页面后看不到必要菜单或执行操作时提示无权限。`,
      `该问题归类为${toolType}，当前优先级为${priority}，影响相关人员办理日常业务和审批流转。`,
      '复现方式为使用当前账号登录系统，进入对应模块后尝试查看或提交数据，系统限制继续操作。',
      '期望协助核查账号权限配置，并按业务岗位补齐所需菜单、数据范围或操作权限。'
    ].join('\n');
  }

  return [
    `${system}在使用“${title}”相关功能时出现异常表现，当前结果与业务预期不一致，影响正常操作。`,
    `该问题归类为${toolType}，当前优先级为${priority}，需要尽快确认问题范围和影响原因。`,
    '复现方式为进入对应业务模块后按日常操作路径处理，可观察到页面结果异常、数据不一致或流程无法继续。',
    '期望协助定位异常原因，并恢复相关功能或给出明确处理结果，避免继续影响业务使用。'
  ].join('\n');
}

function formatTitle(ticket) {
  return normalizeField(ticket.title, '模拟问题工单');
}

function formatToolType(toolType) {
  if (!toolType) return '未指定工单类型';
  return TOOL_TYPE_LABELS[toolType] || toolType;
}

function formatPriority(priority) {
  if (!priority) return '未指定优先级';
  return PRIORITY_LABELS[priority] || priority;
}

function formatSystem(ticket) {
  const systemCode = normalizeField(ticket.systemName || ticket.systemCode, '');
  if (!systemCode) return '相关业务系统';

  const systemLabel = SYSTEM_LABELS[systemCode];
  if (!systemLabel || systemLabel === systemCode) return systemCode;
  return `${systemLabel}（${systemCode}）`;
}

function stripMockPrefix(title) {
  return title.replace(/^【模拟】/, '');
}

function normalizeField(value, fallback) {
  const normalizedValue = String(value || '').trim();
  return normalizedValue || fallback;
}

function normalizeDescription(description) {
  return String(description || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function stripMarkdownMarkers(description) {
  return description
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}
