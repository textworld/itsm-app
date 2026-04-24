/**
 * ITSM 工单流转状态机
 *
 * 所有页面/组件触发工单流转，都必须通过 canTransition + applyTransition。
 * PROCESSING 支持 processingSubStatus：
 * - L1_INVESTIGATION：一线排查
 * - L2_INVESTIGATION：二线排查
 */
import {
  PROCESSING_SUB_STATUS,
  STATUS,
  getDualStatusesForWorkflowStatus,
  getProcessingSubStatus,
  getRequesterStatus,
  getRequesterStatusForSupportStatus,
  getSupportStatus
} from '../constants/ticketStatus.js';
import { ROLES } from '../constants/roles.js';

export const EVENTS = {
  SUBMIT: 'SUBMIT',
  ACCEPT: 'ACCEPT',
  REQUEST_L2_SUPPORT: 'REQUEST_L2_SUPPORT',
  RETURN_FOR_INFO: 'RETURN_FOR_INFO',
  COMPLETE_INFO_SUPPLEMENT: 'COMPLETE_INFO_SUPPLEMENT',
  L1_REVIEW: 'L1_REVIEW',
  INITIATE_CLOSURE: 'INITIATE_CLOSURE',
  VERIFY_YES: 'VERIFY_YES',
  VERIFY_NO: 'VERIFY_NO',

  // 兼容旧组件/历史 timeline
  TAG_DEFECT_AND_LINK: 'REQUEST_L2_SUPPORT',
  SUBMIT_CONCLUSION: 'L1_REVIEW',
  SUBMIT_REVIEW: 'INITIATE_CLOSURE',
  MOVE_TO_REVIEW: 'INITIATE_CLOSURE'
};

export const EVENT_LABELS = {
  [EVENTS.SUBMIT]: '提交工单',
  [EVENTS.ACCEPT]: '受理工单',
  [EVENTS.REQUEST_L2_SUPPORT]: '二线支持',
  [EVENTS.RETURN_FOR_INFO]: '退回提交人',
  [EVENTS.COMPLETE_INFO_SUPPLEMENT]: '已补充',
  [EVENTS.L1_REVIEW]: '一线复核',
  [EVENTS.INITIATE_CLOSURE]: '发起办结',
  [EVENTS.VERIFY_YES]: '验证通过',
  [EVENTS.VERIFY_NO]: '驳回（验证未通过）'
};

export const TRANSITIONS = [
  {
    id: 'T01',
    from: null,
    event: EVENTS.SUBMIT,
    to: STATUS.PENDING,
    role: ROLES.REQUESTER
  },
  {
    id: 'T02',
    from: STATUS.PENDING,
    event: EVENTS.ACCEPT,
    to: STATUS.PROCESSING,
    toSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    role: ROLES.L1
  },
  {
    id: 'T03',
    from: STATUS.PROCESSING,
    fromSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    event: EVENTS.REQUEST_L2_SUPPORT,
    to: STATUS.PROCESSING,
    toSubStatus: PROCESSING_SUB_STATUS.L2_INVESTIGATION,
    role: ROLES.L1,
    guard: (ticket, payload) => {
      const tag = payload?.defectTag ?? ticket.defectTag;
      const link = payload?.linkedDefect ?? ticket.linkedDefect;
      return Boolean(tag) && Boolean(link);
    }
  },
  {
    id: 'T04',
    from: STATUS.PROCESSING,
    event: EVENTS.RETURN_FOR_INFO,
    to: STATUS.INFO_SUPPLEMENT,
    role: ROLES.L1
  },
  {
    id: 'T05',
    from: STATUS.INFO_SUPPLEMENT,
    event: EVENTS.COMPLETE_INFO_SUPPLEMENT,
    to: STATUS.PROCESSING,
    toSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    role: ROLES.REQUESTER
  },
  {
    id: 'T06',
    from: STATUS.PROCESSING,
    fromSubStatus: PROCESSING_SUB_STATUS.L2_INVESTIGATION,
    event: EVENTS.L1_REVIEW,
    to: STATUS.PROCESSING,
    toSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    role: ROLES.L2,
    guard: (ticket, payload) => {
      const conclusion = payload?.l2Conclusion ?? ticket.l2Conclusion;
      return Boolean(conclusion && String(conclusion).trim());
    }
  },
  {
    id: 'T07',
    from: STATUS.PROCESSING,
    event: EVENTS.INITIATE_CLOSURE,
    to: STATUS.CONFIRMING,
    role: ROLES.L1
  },
  {
    id: 'T08',
    from: STATUS.CONFIRMING,
    event: EVENTS.VERIFY_YES,
    to: STATUS.CLOSED,
    role: ROLES.REQUESTER
  },
  {
    id: 'T09',
    from: STATUS.CONFIRMING,
    event: EVENTS.VERIFY_NO,
    to: STATUS.PROCESSING,
    toSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    role: ROLES.REQUESTER,
    guard: (ticket, payload) => {
      const reason = payload?.rejectionReason;
      return Boolean(reason && String(reason).trim());
    }
  }
];

export const ROLE_EVENT_PERMISSIONS = {
  [ROLES.REQUESTER]: [
    EVENTS.SUBMIT,
    EVENTS.COMPLETE_INFO_SUPPLEMENT,
    EVENTS.VERIFY_YES,
    EVENTS.VERIFY_NO
  ],
  [ROLES.L1]: [
    EVENTS.ACCEPT,
    EVENTS.REQUEST_L2_SUPPORT,
    EVENTS.RETURN_FOR_INFO,
    EVENTS.INITIATE_CLOSURE
  ],
  [ROLES.L2]: [EVENTS.L1_REVIEW]
};

export function findTransition(ticket, event, user) {
  if (!user) return null;
  const fromStatus = ticket ? ticket.status : null;
  const currentSubStatus = getProcessingSubStatus(ticket);
  return (
    TRANSITIONS.find(
      (transition) =>
        transition.from === fromStatus &&
        transition.event === event &&
        transition.role === user.role &&
        (!transition.fromSubStatus || transition.fromSubStatus === currentSubStatus)
    ) || null
  );
}

export function canTransition(ticket, event, user, payload) {
  const transition = findTransition(ticket, event, user);
  if (!transition) {
    return {
      ok: false,
      reason: '当前状态或角色无权执行该操作'
    };
  }
  if (transition.guard && !transition.guard(ticket, payload)) {
    return {
      ok: false,
      reason: '操作前置条件未满足',
      transition
    };
  }
  return { ok: true, transition };
}

export function applyTransition(ticket, event, payload = {}, user) {
  const check = canTransition(ticket, event, user, payload);
  if (!check.ok) {
    throw new Error(check.reason || '状态流转失败');
  }
  const { transition } = check;
  const now = new Date().toISOString();
  const nextDualStatuses = getNextDualStatuses(transition.to, event);
  const nextProcessingSubStatus =
    transition.to === STATUS.PROCESSING
      ? transition.toSubStatus || getProcessingSubStatus(ticket) || PROCESSING_SUB_STATUS.L1_INVESTIGATION
      : null;

  const nextTicket = {
    ...ticket,
    ...payload,
    status: transition.to,
    requesterStatus: nextDualStatuses.requesterStatus,
    supportStatus: nextDualStatuses.supportStatus,
    processingSubStatus: nextProcessingSubStatus,
    updatedAt: now,
    timeline: [
      ...(ticket?.timeline || []),
      {
        action: event,
        actionLabel: EVENT_LABELS[event] || event,
        fromStatus: ticket?.status ?? null,
        toStatus: transition.to,
        fromRequesterStatus: getRequesterStatus(ticket),
        toRequesterStatus: nextDualStatuses.requesterStatus,
        fromSupportStatus: getSupportStatus(ticket),
        toSupportStatus: nextDualStatuses.supportStatus,
        fromProcessingSubStatus: getProcessingSubStatus(ticket),
        toProcessingSubStatus: nextProcessingSubStatus,
        operator: user?.name || user?.id || '未知',
        operatorId: user?.id || null,
        role: user?.role || null,
        at: now,
        remark: payload?.__timelineRemark || ''
      }
    ]
  };
  delete nextTicket.__timelineRemark;
  return nextTicket;
}

function getNextDualStatuses(workflowStatus, event) {
  if (event === EVENTS.VERIFY_NO) {
    return {
      requesterStatus: getRequesterStatusForSupportStatus(STATUS.RETURNED),
      supportStatus: STATUS.RETURNED
    };
  }
  return getDualStatusesForWorkflowStatus(workflowStatus);
}

export function listAvailableEvents(ticket, user) {
  if (!user) return [];
  return TRANSITIONS.filter(
    (transition) =>
      transition.from === ticket.status &&
      transition.role === user.role &&
      (!transition.fromSubStatus || transition.fromSubStatus === getProcessingSubStatus(ticket))
  ).map((transition) => transition.event);
}
