import { ROLES } from '../constants/roles.js';
import {
  PROCESSING_SUB_STATUS,
  STATUS,
  STATUS_LABELS,
  getProcessingSubStatus,
  getRequesterStatus,
  getSupportStatus
} from '../constants/ticketStatus.js';
import { L1_ACCEPTABLE_TOOL_TYPES } from '../constants/toolTypes.js';

export const TICKET_LIST_MODES = {
  CURRENT: 'current',
  HISTORY: 'history'
};

export function buildView(tickets, user, options = {}) {
  if (!user) {
    return { heading: '', subheading: '', total: 0, defaultTab: 'ALL', tabs: [] };
  }

  if (options.mode === TICKET_LIST_MODES.HISTORY) {
    return buildHistoryView(tickets, user);
  }

  if (user.role === ROLES.REQUESTER) {
    const mine = tickets.filter((t) => t.requesterId === user.id);
    const byStatus = (s) => mine.filter((t) => getRequesterStatus(t) === s);
    return {
      heading: '我提交的工单',
      subheading: '展示当前提单人账号下的所有工单',
      total: mine.length,
      defaultTab: 'ALL',
      tabs: [
        { key: 'ALL', label: '全部', data: mine, color: 'blue' },
        { key: STATUS.DRAFT, label: STATUS_LABELS[STATUS.DRAFT], data: byStatus(STATUS.DRAFT), color: 'default' },
        { key: STATUS.PENDING, label: STATUS_LABELS[STATUS.PENDING], data: byStatus(STATUS.PENDING), color: 'orange' },
        { key: STATUS.PROCESSING, label: STATUS_LABELS[STATUS.PROCESSING], data: byStatus(STATUS.PROCESSING), color: 'processing' },
        { key: STATUS.INFO_SUPPLEMENT, label: STATUS_LABELS[STATUS.INFO_SUPPLEMENT], data: byStatus(STATUS.INFO_SUPPLEMENT), color: 'cyan' },
        { key: STATUS.CONFIRMING, label: STATUS_LABELS[STATUS.CONFIRMING], data: byStatus(STATUS.CONFIRMING), color: 'gold' },
        { key: STATUS.CLOSED, label: STATUS_LABELS[STATUS.CLOSED], data: byStatus(STATUS.CLOSED), color: 'green' }
      ]
    };
  }

  if (user.role === ROLES.L1) {
    const allTickets = tickets.filter(
      (t) =>
        isCurrentAssigneeForUser(t, user) &&
        L1_ACCEPTABLE_TOOL_TYPES.includes(t.toolType) &&
        getSupportStatus(t) !== STATUS.DRAFT
    );
    const pending = allTickets.filter((t) => getSupportStatus(t) === STATUS.PENDING);
    const l1Processing = allTickets.filter(
      (t) =>
        getSupportStatus(t) === STATUS.PROCESSING &&
        getProcessingSubStatus(t) === PROCESSING_SUB_STATUS.L1_INVESTIGATION
    );
    const l2Processing = allTickets.filter(
      (t) =>
        getSupportStatus(t) === STATUS.PROCESSING &&
        getProcessingSubStatus(t) === PROCESSING_SUB_STATUS.L2_INVESTIGATION
    );
    const returned = allTickets.filter((t) => getSupportStatus(t) === STATUS.RETURNED);
    const suspended = allTickets.filter((t) => getSupportStatus(t) === STATUS.SUSPENDED);
    const infoSupplement = allTickets.filter((t) => getSupportStatus(t) === STATUS.INFO_SUPPLEMENT);
    const confirming = allTickets.filter((t) => getSupportStatus(t) === STATUS.CONFIRMING);
    const closed = allTickets.filter((t) => getSupportStatus(t) === STATUS.CLOSED);
    return {
      heading: '一线技术支持工作台',
      subheading: '展示全部工单，并按当前处理阶段分类',
      total: allTickets.length,
      defaultTab: 'ALL',
      tabs: [
        { key: 'ALL', label: '全部', data: allTickets, color: 'blue' },
        { key: STATUS.PENDING, label: '待受理', data: pending, color: 'orange' },
        { key: 'PROCESSING_L1', label: '处理中·一线排查', data: l1Processing, color: 'processing' },
        { key: 'PROCESSING_L2', label: '处理中·二线排查', data: l2Processing, color: 'volcano' },
        { key: STATUS.SUSPENDED, label: '已挂起', data: suspended, color: 'default' },
        { key: STATUS.INFO_SUPPLEMENT, label: '信息补充', data: infoSupplement, color: 'cyan' },
        { key: STATUS.RETURNED, label: '已回退', data: returned, color: 'red' },
        { key: STATUS.CONFIRMING, label: '待确认', data: confirming, color: 'gold' },
        { key: STATUS.CLOSED, label: '已办结', data: closed, color: 'green' }
      ]
    };
  }

  if (user.role === ROLES.L2) {
    const allTickets = tickets.filter(
      (ticket) => isCurrentAssigneeForUser(ticket, user) && getSupportStatus(ticket) !== STATUS.DRAFT
    );
    const investigating = allTickets.filter(
      (t) =>
        (getSupportStatus(t) === STATUS.PROCESSING &&
          getProcessingSubStatus(t) === PROCESSING_SUB_STATUS.L2_INVESTIGATION) ||
        (t.isSubtask &&
          getSupportStatus(t) !== STATUS.CLOSED &&
          t.assigneeL2Id === user.id)
    );
    const handled = allTickets.filter(
      (t) =>
        t.assigneeL2Id === user.id &&
        getProcessingSubStatus(t) !== PROCESSING_SUB_STATUS.L2_INVESTIGATION
    );
    return {
      heading: '二线运维工作台',
      subheading: '默认展示全部工单，可切换查看二线排查和我已处理',
      total: allTickets.length,
      defaultTab: 'ALL',
      tabs: [
        { key: 'ALL', label: '全部', data: allTickets, color: 'blue' },
        { key: 'PROCESSING_L2', label: '处理中·二线排查', data: investigating, color: 'volcano' },
        { key: 'HANDLED', label: '我已处理', data: handled, color: 'blue' }
      ]
    };
  }

  return { heading: '', subheading: '', total: 0, defaultTab: 'ALL', tabs: [] };
}

export function getVisibleTicketsForUser(tickets, user) {
  const source = Array.isArray(tickets) ? tickets : [];
  if (!user) return [];

  if (user.role === ROLES.REQUESTER) {
    return source.filter((ticket) => ticket.requesterId === user.id);
  }

  if (user.role === ROLES.L1 || user.role === ROLES.L2) {
    return source.filter(
      (ticket) =>
        isCurrentAssigneeForUser(ticket, user) ||
        wasTicketHandledByUser(ticket, user)
    );
  }

  return [];
}

export function isCurrentAssigneeForUser(ticket, user) {
  if (!ticket || !user) return false;
  if (user.role === ROLES.REQUESTER) return ticket.requesterId === user.id;
  if (user.role === ROLES.L1) return ticket.assigneeL1Id === user.id;
  if (user.role === ROLES.L2) return ticket.assigneeL2Id === user.id;
  return false;
}

export function wasTicketHandledByUser(ticket, user) {
  if (!ticket || !user || ![ROLES.L1, ROLES.L2].includes(user.role)) {
    return false;
  }

  return (
    isCurrentAssigneeForUser(ticket, user) ||
    (ticket.assigneeHistory || []).some(
      (entry) => entry?.role === user.role && entry?.assigneeId === user.id
    ) ||
    (ticket.timeline || []).some(
      (entry) => entry?.role === user.role && entry?.operatorId === user.id
    )
  );
}

function buildHistoryView(tickets, user) {
  const source = Array.isArray(tickets) ? tickets : [];
  const historyTickets =
    user.role === ROLES.REQUESTER
      ? source.filter((ticket) => ticket.requesterId === user.id)
      : source.filter(
          (ticket) =>
            wasTicketHandledByUser(ticket, user) &&
            !isCurrentAssigneeForUser(ticket, user) &&
            getSupportStatus(ticket) !== STATUS.DRAFT
        );

  return {
    heading: user.role === ROLES.REQUESTER ? '我的历史工单' : '历史工单列表',
    subheading:
      user.role === ROLES.REQUESTER
        ? '展示当前提单人账号下的历史工单'
        : '展示当前账号曾经处理且已转交给其他人的工单',
    total: historyTickets.length,
    defaultTab: 'HISTORY',
    hideTabs: true,
    tabs: [
      {
        key: 'HISTORY',
        label: '历史工单',
        data: historyTickets,
        color: 'blue'
      }
    ]
  };
}
