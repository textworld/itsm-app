import { ROLES } from '../constants/roles.js';
import { STATUS, getRequesterStatus } from '../constants/ticketStatus.js';

export function shouldShowSlaColumn(user) {
  return user?.role !== ROLES.REQUESTER;
}

export function shouldShowStatusSubLabel(user) {
  return user?.role !== ROLES.REQUESTER;
}

export function getTitleColumnTitle(user) {
  return user?.role === ROLES.REQUESTER ? '标题' : '工单标题';
}

export function getTitleColumnWidth(user) {
  return user?.role === ROLES.L1 ? 360 : 280;
}

export function getAssigneeColumnTitle(user) {
  return user?.role === ROLES.REQUESTER ? '技术支持' : '处理人';
}

export function getTicketNumberDisplay(ticket) {
  if (isInternalDraftId(ticket?.id) && getRequesterStatus(ticket) === STATUS.DRAFT) {
    return ticket.id;
  }
  return ticket?.id || '-';
}

export function getAssigneeDisplay(ticket, user) {
  if (user?.role === ROLES.REQUESTER && getRequesterStatus(ticket) === STATUS.PENDING) {
    return '等待技术支持受理中';
  }

  if (user?.role === ROLES.REQUESTER) {
    return ticket?.assigneeL1Name ? `一线: ${ticket.assigneeL1Name}` : '-';
  }

  const parts = [];
  if (ticket?.assigneeL1Name) parts.push(`一线: ${ticket.assigneeL1Name}`);
  if (ticket?.assigneeL2Name) parts.push(`二线: ${ticket.assigneeL2Name}`);
  return parts.join(' / ') || '-';
}

function isInternalDraftId(id) {
  return typeof id === 'string' && id.startsWith('draft_');
}
