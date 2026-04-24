/**
 * 工单总结生成器
 * 一线技术支持"生成工单总结"按钮调用本工具，
 * 基于工单流程轨迹 + 问题描述 + 二线排查结论 + 关联缺陷 自动生成结构化总结文本。
 */
import { STATUS_LABELS, getSupportStatus } from '../constants/ticketStatus.js';
import { TOOL_TYPE_LABELS } from '../constants/toolTypes.js';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 生成工单总结 markdown-like 文本
 * @param {object} ticket 工单对象
 * @returns {string}
 */
export function generateSummary(ticket) {
  if (!ticket) return '';
  const lines = [];
  lines.push('【工单总结】');
  lines.push(`- 工单编号: ${ticket.id}`);
  lines.push(`- 工单标题: ${ticket.title}`);
  lines.push(`- 工具类型: ${TOOL_TYPE_LABELS[ticket.toolType] || ticket.toolType}`);
  lines.push(`- 提交人: ${ticket.requesterName || ticket.requesterId || '未知'}`);
  const supportStatus = getSupportStatus(ticket);
  lines.push(`- 当前状态: ${STATUS_LABELS[supportStatus] || supportStatus}`);
  lines.push('');
  lines.push('## 问题描述');
  lines.push(ticket.description || '(无)');
  lines.push('');

  lines.push('## 处理流程');
  if (ticket.timeline && ticket.timeline.length) {
    ticket.timeline.forEach((t, idx) => {
      lines.push(
        `${idx + 1}. ${formatDate(t.at)} · ${t.operator} (${t.role}) · ${t.actionLabel}${t.remark ? ` · ${t.remark}` : ''}`
      );
    });
  } else {
    lines.push('(无轨迹)');
  }
  lines.push('');

  if (ticket.defectTag) {
    lines.push('## 缺陷打标');
    lines.push(`- 缺陷类型: ${ticket.defectTag.type}`);
    lines.push(`- 缺陷描述: ${ticket.defectTag.description}`);
    lines.push(`- 打标人: ${ticket.defectTag.taggedBy}`);
    lines.push('');
  }

  if (ticket.linkedDefect) {
    lines.push('## 关联缺陷');
    lines.push(
      `- ${ticket.linkedDefect.defectId} | ${ticket.linkedDefect.title} | 模块: ${ticket.linkedDefect.module} | 优先级: ${ticket.linkedDefect.priority}${ticket.linkedDefect.isNew ? ' (本次新建)' : ''}`
    );
    lines.push('');
  }

  lines.push('## 处理结论');
  if (ticket.l2Conclusion) {
    lines.push(`(二线排查结论) ${ticket.l2Conclusion}`);
  } else if (ticket.linkedDefect) {
    lines.push('已关联缺陷，等待二线进一步排查处理。');
  } else {
    lines.push('一线已处理完成。');
  }

  return lines.join('\n');
}
