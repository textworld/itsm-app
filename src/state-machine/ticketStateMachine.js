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
import { PRIORITIES, PRIORITY_LABELS } from '../constants/priorities.js';
import { SUBTASK_STATUS } from '../constants/subtaskStatus.js';
import { SYSTEM_CATEGORY, SYSTEM_LABELS } from '../constants/systems.js';
import { TOOL_TYPES } from '../constants/toolTypes.js';
import { buildDescriptionHistoryEntry, buildDescriptionUpdate } from '../utils/descriptionHistory.js';
import { buildDraftTicketUpdate } from '../utils/draftTicketEditing.js';
import { createEmptyRichTextDoc, richTextHtmlToDoc, richTextToPlainText } from '../utils/richText.js';
import { calculateTicketExpiresAt } from '../utils/sla.js';
import { canUserHandleSubtaskSystem } from '../utils/subtaskRouting.js';

export const EVENTS = {
  CREATE_DRAFT: 'CREATE_DRAFT',
  SUBMIT: 'SUBMIT',
  UPDATE_DRAFT: 'UPDATE_DRAFT',
  AI_RESOLVE: 'AI_RESOLVE',
  WITHDRAW: 'WITHDRAW',
  ACCEPT: 'ACCEPT',
  TAG_DEFECT: 'TAG_DEFECT',
  UPDATE_LINKED_DEFECT: 'UPDATE_LINKED_DEFECT',
  UPDATE_SUMMARY: 'UPDATE_SUMMARY',
  SUSPEND: 'SUSPEND',
  RESUME_FROM_SUSPEND: 'RESUME_FROM_SUSPEND',
  REQUEST_L2_SUPPORT: 'REQUEST_L2_SUPPORT',
  CREATE_SUBTASK: 'CREATE_SUBTASK',
  CREATE_SUBTASK_TICKET: 'CREATE_SUBTASK_TICKET',
  CLAIM_SUBTASK: 'CLAIM_SUBTASK',
  TRANSFER_SUBTASK: 'TRANSFER_SUBTASK',
  NO_ACTION_SUBTASK: 'NO_ACTION_SUBTASK',
  START_SUBTASK: 'START_SUBTASK',
  COMPLETE_SUBTASK: 'COMPLETE_SUBTASK',
  TRANSFER_TECH: 'TRANSFER_TECH',
  RETURN_FOR_INFO: 'RETURN_FOR_INFO',
  UPDATE_INFO_SUPPLEMENT: 'UPDATE_INFO_SUPPLEMENT',
  COMPLETE_INFO_SUPPLEMENT: 'COMPLETE_INFO_SUPPLEMENT',
  L1_REVIEW: 'L1_REVIEW',
  INITIATE_CLOSURE: 'INITIATE_CLOSURE',
  REQUESTER_CLOSE: 'REQUESTER_CLOSE',
  VERIFY_YES: 'VERIFY_YES',
  VERIFY_NO: 'VERIFY_NO',

  // 兼容旧组件/历史 timeline
  TAG_DEFECT_AND_LINK: 'REQUEST_L2_SUPPORT',
  SUBMIT_CONCLUSION: 'L1_REVIEW',
  SUBMIT_REVIEW: 'INITIATE_CLOSURE',
  MOVE_TO_REVIEW: 'INITIATE_CLOSURE'
};

export const EVENT_LABELS = {
  [EVENTS.CREATE_DRAFT]: '暂存草稿',
  [EVENTS.SUBMIT]: '提交工单',
  [EVENTS.UPDATE_DRAFT]: '修改草稿',
  [EVENTS.AI_RESOLVE]: '大模型解决',
  [EVENTS.WITHDRAW]: '撤回工单',
  [EVENTS.ACCEPT]: '受理工单',
  [EVENTS.TAG_DEFECT]: '缺陷打标',
  [EVENTS.UPDATE_LINKED_DEFECT]: '更新关联缺陷',
  [EVENTS.UPDATE_SUMMARY]: '更新工单总结',
  [EVENTS.SUSPEND]: '挂起工单',
  [EVENTS.RESUME_FROM_SUSPEND]: '取消挂起',
  [EVENTS.REQUEST_L2_SUPPORT]: '二线支持',
  [EVENTS.CREATE_SUBTASK]: '创建子任务',
  [EVENTS.CREATE_SUBTASK_TICKET]: '创建子任务工单',
  [EVENTS.CLAIM_SUBTASK]: '认领子任务',
  [EVENTS.TRANSFER_SUBTASK]: '转派子任务',
  [EVENTS.NO_ACTION_SUBTASK]: '子任务无需处理',
  [EVENTS.START_SUBTASK]: '开始处理子任务',
  [EVENTS.COMPLETE_SUBTASK]: '完成子任务',
  [EVENTS.TRANSFER_TECH]: '技术支持转交',
  [EVENTS.RETURN_FOR_INFO]: '退回提交人',
  [EVENTS.UPDATE_INFO_SUPPLEMENT]: '修改补充信息',
  [EVENTS.COMPLETE_INFO_SUPPLEMENT]: '已补充',
  [EVENTS.L1_REVIEW]: '一线复核',
  [EVENTS.INITIATE_CLOSURE]: '发起办结',
  [EVENTS.REQUESTER_CLOSE]: '提单人主动关单',
  [EVENTS.VERIFY_YES]: '验证通过',
  [EVENTS.VERIFY_NO]: '驳回（验证未通过）'
};

export const TRANSITIONS = [
  {
    id: 'T00',
    from: null,
    event: EVENTS.CREATE_DRAFT,
    to: STATUS.DRAFT,
    role: ROLES.REQUESTER,
    transform: (ticket, payload, user, now) => buildDraftTicket(ticket, payload, user, now)
  },
  {
    id: 'T01',
    from: null,
    event: EVENTS.SUBMIT,
    to: STATUS.PENDING,
    role: ROLES.REQUESTER,
    transform: (ticket, payload, user, now) => buildSubmittedTicket(ticket, payload, user, now)
  },
  {
    id: 'T01A',
    from: STATUS.DRAFT,
    event: EVENTS.UPDATE_DRAFT,
    to: STATUS.DRAFT,
    role: ROLES.REQUESTER,
    recordTimeline: false,
    transform: (ticket, payload, user, now) =>
      buildDraftTicketUpdate({
        ticket,
        values: payload.values,
        attachments: payload.attachments || [],
        user,
        updatedAt: now
      })
  },
  {
    id: 'T01B',
    from: STATUS.DRAFT,
    event: EVENTS.SUBMIT,
    to: STATUS.PENDING,
    role: ROLES.REQUESTER,
    transform: (ticket, payload, user, now) =>
      buildSubmittedTicket(
        ticket,
        {
          ...ticket,
          ...payload,
          draftCreatedAt: ticket?.draftCreatedAt || ticket?.createdAt || null,
          createdAt: payload.createdAt || now,
          submittedAt: payload.submittedAt || now
        },
        user,
        now
      )
  },
  {
    id: 'T01C',
    from: STATUS.DRAFT,
    event: EVENTS.AI_RESOLVE,
    to: STATUS.CLOSED,
    role: ROLES.REQUESTER,
    transform: (ticket, payload, user, now) => buildAiResolvedTicket(ticket, payload, user, now)
  },
  {
    id: 'T02',
    from: STATUS.PENDING,
    event: EVENTS.WITHDRAW,
    to: STATUS.DRAFT,
    role: ROLES.REQUESTER,
    transform: (ticket, payload, _user, now) => ({
      ...payload,
      id: payload.id || ticket.id,
      originalTicketId: ticket.originalTicketId || ticket.id,
      isDraft: true,
      updatedAt: now
    })
  },
  {
    id: 'T03',
    from: STATUS.PENDING,
    event: EVENTS.ACCEPT,
    to: STATUS.PROCESSING,
    toSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    role: ROLES.L1
  },
  {
    id: 'T03A',
    from: STATUS.PROCESSING,
    fromSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    event: EVENTS.TAG_DEFECT,
    to: STATUS.PROCESSING,
    toSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    role: ROLES.L1,
    recordTimeline: false,
    transform: (ticket, payload, user, now) => ({
      defectTag: {
        ...payload.defectTag,
        taggedAt: payload.defectTag?.taggedAt || now,
        taggedBy: payload.defectTag?.taggedBy || user?.name || ticket.defectTag?.taggedBy || ''
      },
      updatedAt: now
    })
  },
  {
    id: 'T03B',
    from: STATUS.PROCESSING,
    fromSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    event: EVENTS.UPDATE_LINKED_DEFECT,
    to: STATUS.PROCESSING,
    toSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    role: ROLES.L1,
    recordTimeline: false,
    transform: (ticket, payload, _user, now) => ({
      linkedDefect: payload.linkedDefect ?? null,
      updatedAt: now
    })
  },
  {
    id: 'T03C',
    from: STATUS.PROCESSING,
    event: EVENTS.UPDATE_SUMMARY,
    to: STATUS.PROCESSING,
    role: ROLES.L1,
    recordTimeline: false,
    transform: (ticket, payload, _user, now) => ({
      summary: payload.summary ?? ticket.summary ?? '',
      summarySyncedToCorpus: payload.summarySyncedToCorpus ?? ticket.summarySyncedToCorpus ?? false,
      updatedAt: now
    })
  },
  {
    id: 'T03D',
    from: STATUS.PROCESSING,
    event: EVENTS.SUSPEND,
    to: STATUS.SUSPENDED,
    role: ROLES.L1,
    transform: (ticket, payload, user, now) => ({
      ...payload,
      suspendedAt: now,
      suspendedBy: user?.name || '',
      suspendedReturnSubStatus: getProcessingSubStatus(ticket) || PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      updatedAt: now
    })
  },
  {
    id: 'T03E',
    from: STATUS.SUSPENDED,
    event: EVENTS.RESUME_FROM_SUSPEND,
    to: STATUS.PROCESSING,
    role: ROLES.L1,
    transform: (ticket, payload, user, now) => ({
      ...payload,
      resumedAt: now,
      resumedBy: user?.name || '',
      processingSubStatus: ticket.suspendedReturnSubStatus || PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      suspendedReturnSubStatus: null,
      updatedAt: now
    })
  },
  {
    id: 'T04',
    from: STATUS.PROCESSING,
    fromSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    event: EVENTS.REQUEST_L2_SUPPORT,
    to: STATUS.PROCESSING,
    toSubStatus: PROCESSING_SUB_STATUS.L2_INVESTIGATION,
    role: ROLES.L1
  },
  {
    id: 'T04-TRANSFER-L1',
    from: STATUS.PROCESSING,
    event: EVENTS.TRANSFER_TECH,
    to: STATUS.PROCESSING,
    role: ROLES.L1,
    guard: (_ticket, payload, user) => isSameRoleTransfer(payload, user),
    transform: (ticket, payload, user, now) => buildTechTransferUpdate(ticket, payload, user, now)
  },
  {
    id: 'T04-TRANSFER-L2',
    from: STATUS.PROCESSING,
    event: EVENTS.TRANSFER_TECH,
    to: STATUS.PROCESSING,
    role: ROLES.L2,
    guard: (_ticket, payload, user) => isSameRoleTransfer(payload, user),
    transform: (ticket, payload, user, now) => buildTechTransferUpdate(ticket, payload, user, now)
  },
  {
    id: 'T04A',
    from: STATUS.PROCESSING,
    event: EVENTS.CREATE_SUBTASK,
    to: STATUS.PROCESSING,
    role: ROLES.L1,
    recordTimeline: false,
    transform: (ticket, payload, user, now) => ({
      subtasks: [
        ...(ticket.subtasks || []),
        {
          ...(payload.subtask || {}),
          status: 'PENDING',
          createdAt: now,
          createdBy: user?.name || ''
        }
      ],
      updatedAt: now
    })
  },
  {
    id: 'T04B',
    from: STATUS.PROCESSING,
    event: EVENTS.START_SUBTASK,
    to: STATUS.PROCESSING,
    role: ROLES.L1,
    recordTimeline: false,
    transform: (ticket, payload, user, now) =>
      updateSubtask(
        ticket,
        payload.subtaskId,
        (subtask) => ({
          ...subtask,
          status: 'PROCESSING',
          startedAt: subtask.startedAt || now,
          startedBy: user?.name || ''
        }),
        now
      )
  },
  {
    id: 'T04B-L2',
    from: STATUS.PROCESSING,
    event: EVENTS.START_SUBTASK,
    to: STATUS.PROCESSING,
    role: ROLES.L2,
    recordTimeline: false,
    transform: (ticket, payload, user, now) =>
      updateSubtask(
        ticket,
        payload.subtaskId,
        (subtask) => ({
          ...subtask,
          status: 'PROCESSING',
          startedAt: subtask.startedAt || now,
          startedBy: user?.name || ''
        }),
        now
      )
  },
  {
    id: 'T04C',
    from: STATUS.PROCESSING,
    event: EVENTS.COMPLETE_SUBTASK,
    to: STATUS.PROCESSING,
    role: ROLES.L1,
    recordTimeline: false,
    transform: (ticket, payload, user, now) =>
      updateSubtask(
        ticket,
        payload.subtaskId,
        (subtask) => ({
          ...subtask,
          status: 'COMPLETED',
          noMainTicketActionRequired: payload.noMainTicketActionRequired === true,
          completedAt: now,
          completedBy: user?.name || ''
        }),
        now
      )
  },
  {
    id: 'T04C-L2',
    from: STATUS.PROCESSING,
    event: EVENTS.COMPLETE_SUBTASK,
    to: STATUS.PROCESSING,
    role: ROLES.L2,
    recordTimeline: false,
    transform: (ticket, payload, user, now) =>
      updateSubtask(
        ticket,
        payload.subtaskId,
        (subtask) => ({
          ...subtask,
          status: 'COMPLETED',
          noMainTicketActionRequired: payload.noMainTicketActionRequired === true,
          completedAt: now,
          completedBy: user?.name || ''
        }),
        now
      )
  },
  {
    id: 'T05',
    from: STATUS.PROCESSING,
    event: EVENTS.RETURN_FOR_INFO,
    to: STATUS.INFO_SUPPLEMENT,
    role: ROLES.L1,
    transform: (ticket, payload, _user, now) => ({
      ...payload,
      infoSupplementReturnStatus: ticket.status,
      infoSupplementReturnSubStatus: getProcessingSubStatus(ticket),
      updatedAt: now
    })
  },
  {
    id: 'T05A',
    from: STATUS.INFO_SUPPLEMENT,
    event: EVENTS.UPDATE_INFO_SUPPLEMENT,
    to: STATUS.INFO_SUPPLEMENT,
    role: ROLES.REQUESTER,
    recordTimeline: false,
    transform: (ticket, payload, user, now) => {
      const nextUpdate = buildDescriptionUpdate(ticket, {
        descriptionDoc: payload.descriptionDoc,
        descriptionHtml: payload.descriptionHtml,
        user,
        reason: '信息补充阶段修改工单描述'
      });
      const systemUpdate = payload.systemName
        ? {
            systemCategory: payload.systemCategory || ticket.systemCategory || SYSTEM_CATEGORY.OLD,
            systemCode: payload.systemName,
            systemName: SYSTEM_LABELS[payload.systemName] || payload.systemName
          }
        : {};

      return nextUpdate
        ? {
            ...nextUpdate,
            ...systemUpdate,
            updatedAt: now
          }
        : {
            ...systemUpdate,
            updatedAt: now
          };
    }
  },
  {
    id: 'T06',
    from: STATUS.INFO_SUPPLEMENT,
    event: EVENTS.COMPLETE_INFO_SUPPLEMENT,
    to: STATUS.PROCESSING,
    role: ROLES.REQUESTER,
    transform: (ticket, payload, _user, now) => ({
      ...payload,
      processingSubStatus: ticket.infoSupplementReturnSubStatus || PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      updatedAt: now
    })
  },
  {
    id: 'T07',
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
    id: 'T08',
    from: STATUS.PROCESSING,
    event: EVENTS.INITIATE_CLOSURE,
    to: STATUS.CONFIRMING,
    role: ROLES.L1,
    guard: (ticket) => (ticket.subtasks || []).every((subtask) => subtask.status === 'COMPLETED')
  },
  {
    id: 'T08A',
    from: STATUS.PROCESSING,
    event: EVENTS.REQUESTER_CLOSE,
    to: STATUS.CLOSED,
    role: ROLES.REQUESTER,
    transform: (_ticket, payload, _user, now) => ({
      satisfaction: payload.satisfaction ?? null,
      closedAt: now,
      closeReason: payload.closeReason || '提单人主动关单',
      updatedAt: now
    })
  },
  {
    id: 'T09',
    from: STATUS.CONFIRMING,
    event: EVENTS.VERIFY_YES,
    to: STATUS.CLOSED,
    role: ROLES.REQUESTER
  },
  {
    id: 'T10',
    from: STATUS.CONFIRMING,
    event: EVENTS.VERIFY_NO,
    to: STATUS.PROCESSING,
    toSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    role: ROLES.REQUESTER,
    guard: (ticket, payload) => {
      const reason = payload?.rejectionReason;
      return Boolean(reason && String(reason).trim());
    }
  },
  ...createSubtaskTicketTransitions()
];

export const ROLE_EVENT_PERMISSIONS = {
  [ROLES.REQUESTER]: [
    EVENTS.CREATE_DRAFT,
    EVENTS.SUBMIT,
    EVENTS.UPDATE_DRAFT,
    EVENTS.AI_RESOLVE,
    EVENTS.WITHDRAW,
      EVENTS.UPDATE_INFO_SUPPLEMENT,
      EVENTS.COMPLETE_INFO_SUPPLEMENT,
      EVENTS.REQUESTER_CLOSE,
      EVENTS.VERIFY_YES,
      EVENTS.VERIFY_NO
  ],
  [ROLES.L1]: [
    EVENTS.ACCEPT,
    EVENTS.TAG_DEFECT,
    EVENTS.UPDATE_LINKED_DEFECT,
    EVENTS.UPDATE_SUMMARY,
    EVENTS.SUSPEND,
    EVENTS.RESUME_FROM_SUSPEND,
    EVENTS.REQUEST_L2_SUPPORT,
    EVENTS.CREATE_SUBTASK_TICKET,
    EVENTS.CLAIM_SUBTASK,
    EVENTS.TRANSFER_SUBTASK,
    EVENTS.NO_ACTION_SUBTASK,
    EVENTS.TRANSFER_TECH,
    EVENTS.CREATE_SUBTASK,
    EVENTS.START_SUBTASK,
    EVENTS.COMPLETE_SUBTASK,
    EVENTS.RETURN_FOR_INFO,
    EVENTS.INITIATE_CLOSURE
  ],
  [ROLES.L2]: [
    EVENTS.L1_REVIEW,
    EVENTS.CLAIM_SUBTASK,
    EVENTS.TRANSFER_SUBTASK,
    EVENTS.NO_ACTION_SUBTASK,
    EVENTS.TRANSFER_TECH,
    EVENTS.START_SUBTASK,
    EVENTS.COMPLETE_SUBTASK
  ]
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
  if (transition.guard && !transition.guard(ticket, payload, user)) {
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
  const currentTicket = ticket || {};
  const nextPayload = transition.transform
    ? transition.transform(currentTicket, payload, user, now)
    : payload;
  const nextDualStatuses = getNextDualStatuses(transition.to, event);
  const nextProcessingSubStatus =
    transition.to === STATUS.PROCESSING
      ? transition.toSubStatus || nextPayload?.processingSubStatus || getProcessingSubStatus(ticket) || PROCESSING_SUB_STATUS.L1_INVESTIGATION
      : null;

  const nextTicket = {
    ...currentTicket,
    ...nextPayload,
    status: transition.to,
    requesterStatus: nextDualStatuses.requesterStatus,
    supportStatus: nextDualStatuses.supportStatus,
    processingSubStatus: nextProcessingSubStatus,
    updatedAt: nextPayload?.updatedAt || now,
    timeline:
      transition.recordTimeline === false
        ? currentTicket.timeline || []
        : [
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
  nextTicket.assigneeHistory = buildAssigneeHistory(currentTicket, nextTicket, now);
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

function updateSubtask(ticket, subtaskId, updater, now) {
  return {
    subtasks: (ticket.subtasks || []).map((subtask) =>
      subtask.id === subtaskId ? updater(subtask) : subtask
    ),
    updatedAt: now
  };
}

function buildAssigneeHistory(previousTicket, nextTicket, now) {
  const history = [...(previousTicket?.assigneeHistory || [])];
  addAssigneeHistoryEntry(history, ROLES.L1, previousTicket?.assigneeL1Id, previousTicket?.assigneeL1Name, now);
  addAssigneeHistoryEntry(history, ROLES.L2, previousTicket?.assigneeL2Id, previousTicket?.assigneeL2Name, now);

  if (previousTicket?.assigneeL1Id !== nextTicket?.assigneeL1Id) {
    addAssigneeHistoryEntry(history, ROLES.L1, nextTicket?.assigneeL1Id, nextTicket?.assigneeL1Name, now);
  }
  if (previousTicket?.assigneeL2Id !== nextTicket?.assigneeL2Id) {
    addAssigneeHistoryEntry(history, ROLES.L2, nextTicket?.assigneeL2Id, nextTicket?.assigneeL2Name, now);
  }

  return history;
}

function addAssigneeHistoryEntry(history, role, assigneeId, assigneeName, assignedAt) {
  if (!assigneeId) return;
  if (history.some((entry) => entry?.role === role && entry?.assigneeId === assigneeId)) {
    return;
  }

  history.push({
    role,
    assigneeId,
    assigneeName: assigneeName || '',
    assignedAt
  });
}

function createSubtaskTicketTransitions() {
  const techRoles = [ROLES.L1, ROLES.L2];
  const activeStatuses = [STATUS.PENDING, STATUS.PROCESSING];

  return [
    {
      id: `T-SUBTASK-CREATE-${ROLES.L1}`,
      from: null,
      event: EVENTS.CREATE_SUBTASK_TICKET,
      to: STATUS.PENDING,
      role: ROLES.L1,
      transform: (_ticket, payload, user, now) => buildSubtaskTicket(payload, user, now)
    },
    ...techRoles.map((role) => ({
      id: `T-SUBTASK-CLAIM-${role}`,
      from: STATUS.PENDING,
      event: EVENTS.CLAIM_SUBTASK,
      to: STATUS.PROCESSING,
      role,
      guard: (ticket, _payload, user) =>
        Boolean(ticket?.isSubtask) && canUserHandleSubtaskSystem(user, ticket.systemCode),
      transform: (_ticket, _payload, user, now) => ({
        ...buildSubtaskAssigneeUpdate(user.role, user.id, user.name),
        subtaskStatus: SUBTASK_STATUS.PROCESSING,
        startedAt: now,
        startedBy: user?.name || '',
        updatedAt: now
      })
    })),
    ...activeStatuses.flatMap((status) =>
      techRoles.map((role) => ({
        id: `T-SUBTASK-TRANSFER-${status}-${role}`,
        from: status,
        event: EVENTS.TRANSFER_SUBTASK,
        to: status,
        role,
        guard: (ticket) => Boolean(ticket?.isSubtask),
        transform: (ticket, payload, user, now) => ({
          systemCategory: payload.systemCategory || ticket.systemCategory,
          systemCode: payload.systemCode || ticket.systemCode,
          systemName: payload.systemName || ticket.systemName,
          ...buildExplicitSubtaskAssigneeUpdate(payload),
          transferredAt: now,
          transferredBy: user?.name || '',
          updatedAt: now
        })
      }))
    ),
    ...activeStatuses.flatMap((status) =>
      techRoles.flatMap((role) => [
        {
          id: `T-SUBTASK-COMPLETE-${status}-${role}`,
          from: status,
          event: EVENTS.COMPLETE_SUBTASK,
          to: STATUS.CLOSED,
          role,
          guard: (ticket) => Boolean(ticket?.isSubtask),
          transform: (_ticket, _payload, user, now) => ({
            subtaskStatus: SUBTASK_STATUS.COMPLETED,
            noMainTicketActionRequired: false,
            completedAt: now,
            completedBy: user?.name || '',
            closedAt: now,
            updatedAt: now
          })
        },
        {
          id: `T-SUBTASK-NO-ACTION-${status}-${role}`,
          from: status,
          event: EVENTS.NO_ACTION_SUBTASK,
          to: STATUS.CLOSED,
          role,
          guard: (ticket) => Boolean(ticket?.isSubtask),
          transform: (_ticket, _payload, user, now) => ({
            subtaskStatus: SUBTASK_STATUS.COMPLETED,
            noMainTicketActionRequired: true,
            completedAt: now,
            completedBy: user?.name || '',
            closedAt: now,
            updatedAt: now
          })
        }
      ])
    )
  ];
}

function isSameRoleTransfer(payload, user) {
  return Boolean(
    user?.role &&
      [ROLES.L1, ROLES.L2].includes(user.role) &&
      (!payload?.targetRole || payload.targetRole === user.role)
  );
}

function buildTechTransferUpdate(_ticket, payload, user, now) {
  const assigneeId = payload.assigneeId || null;
  const assigneeName = payload.assigneeName || null;
  const techTransfer = {
    role: user.role,
    assigneeId,
    assigneeName,
    communicated: payload.communicated === true,
    transferredBy: user?.name || '',
    transferredAt: now
  };

  if (user.role === ROLES.L1) {
    return {
      assigneeL1Id: assigneeId,
      assigneeL1Name: assigneeName,
      techTransfer,
      updatedAt: now
    };
  }

  return {
    assigneeL2Id: assigneeId,
    assigneeL2Name: assigneeName,
    techTransfer,
    updatedAt: now
  };
}

function buildSubtaskTicket(payload = {}, user, now) {
  const description = String(payload.description || payload.title || '子任务').trim();

  return {
    ...payload,
    isSubtask: true,
    parentTicketId: payload.parentTicketId || null,
    title: payload.title || description,
    toolType: TOOL_TYPES.SUBTASK,
    priority: payload.priority || PRIORITIES.P4,
    priorityLabel: payload.priorityLabel || PRIORITY_LABELS[payload.priority || PRIORITIES.P4],
    systemCategory: payload.systemCategory || SYSTEM_CATEGORY.OLD,
    systemCode: payload.systemCode || payload.systemName || '',
    systemName: payload.systemName || SYSTEM_LABELS[payload.systemCode] || payload.systemCode || '',
    description,
    descriptionDoc: payload.descriptionDoc || createEmptyRichTextDoc(),
    descriptionHtml: payload.descriptionHtml || '',
    attachments: payload.attachments || [],
    createdAt: payload.createdAt || now,
    submittedAt: payload.submittedAt || now,
    expiresAt: payload.expiresAt || calculateTicketExpiresAt(now, payload.priority || PRIORITIES.P4),
    requesterId: payload.requesterId || null,
    requesterName: payload.requesterName || '',
    ...buildExplicitSubtaskAssigneeUpdate(payload),
    messages: payload.messages || [],
    subtasks: [],
    subtaskStatus: SUBTASK_STATUS.PENDING,
    noMainTicketActionRequired: false,
    createdBy: user?.name || '',
    updatedAt: now
  };
}

function buildExplicitSubtaskAssigneeUpdate(payload = {}) {
  const assigneeId = payload.assigneeId || null;
  const assigneeName = payload.assigneeName || null;
  const assigneeRole = payload.assigneeRole || inferTechRoleFromUserId(assigneeId);
  return buildSubtaskAssigneeUpdate(assigneeRole, assigneeId, assigneeName);
}

function buildSubtaskAssigneeUpdate(role, assigneeId, assigneeName) {
  if (role === ROLES.L2) {
    return {
      assigneeL1Id: null,
      assigneeL1Name: null,
      assigneeL2Id: assigneeId || null,
      assigneeL2Name: assigneeName || null
    };
  }

  return {
    assigneeL1Id: assigneeId || null,
    assigneeL1Name: assigneeName || null,
    assigneeL2Id: null,
    assigneeL2Name: null
  };
}

function inferTechRoleFromUserId(userId) {
  if (String(userId || '').includes('_l2_')) return ROLES.L2;
  return ROLES.L1;
}

function buildSubmittedTicket(_ticket, payload = {}, user, now) {
  const createdAt = payload.createdAt || now;
  const submittedAt = payload.submittedAt || now;
  const descriptionDoc =
    payload.descriptionDoc ||
    richTextHtmlToDoc(payload.descriptionHtml || '') ||
    createEmptyRichTextDoc();
  const description = payload.description || richTextToPlainText(descriptionDoc);
  const descriptionHtml = payload.descriptionHtml || '';
  const expiresAt = payload.expiresAt || calculateTicketExpiresAt(submittedAt, payload.priority || PRIORITIES.P4);

  return {
    ...payload,
    isDraft: false,
    descriptionDoc,
    description,
    createdAt,
    submittedAt,
    expiresAt,
    updatedAt: payload.updatedAt || now,
    requesterId: payload.requesterId || user?.id || null,
    requesterName: payload.requesterName || user?.name || '未知用户',
    assigneeL1Id: payload.assigneeL1Id ?? null,
    assigneeL1Name: payload.assigneeL1Name ?? null,
    assigneeL2Id: payload.assigneeL2Id ?? null,
    assigneeL2Name: payload.assigneeL2Name ?? null,
    messages: payload.messages || [],
    defectTag: payload.defectTag ?? null,
    linkedDefect: payload.linkedDefect ?? null,
    l2Conclusion: payload.l2Conclusion || '',
    summary: payload.summary || '',
    summarySyncedToCorpus: payload.summarySyncedToCorpus ?? false,
    rejectionReason: payload.rejectionReason || '',
    satisfaction: payload.satisfaction ?? null,
    descriptionHistory:
      payload.descriptionHistory && payload.descriptionHistory.length > 0
        ? payload.descriptionHistory
        : [
            buildDescriptionHistoryEntry({
              ticket: {
                id: payload.id,
                requesterId: payload.requesterId || user?.id || null,
                requesterName: payload.requesterName || user?.name || '未知用户'
              },
              descriptionDoc,
              descriptionHtml,
              description,
              user,
              reason: '提交工单初始版本',
              editedAt: createdAt
            })
          ]
  };
}

function buildDraftTicket(_ticket, payload = {}, user, now) {
  const createdAt = payload.createdAt || now;
  const priority = payload.priority || PRIORITIES.P4;
  const systemCode = payload.systemCode || payload.systemName || '';
  const reportForOthers = payload.reportForOthers === true;
  const descriptionDoc =
    payload.descriptionDoc ||
    richTextHtmlToDoc(payload.descriptionHtml || '') ||
    createEmptyRichTextDoc();
  const description = payload.description || richTextToPlainText(descriptionDoc);
  const descriptionHtml = payload.descriptionHtml || '';
  const title = String(payload.title || '').trim() || '未填写标题';

  return {
    ...payload,
    isDraft: true,
    title,
    toolType: payload.toolType || '',
    priority,
    priorityLabel: payload.priorityLabel || PRIORITY_LABELS[priority] || priority,
    systemCategory: payload.systemCategory || SYSTEM_CATEGORY.OLD,
    systemCode,
    systemName: SYSTEM_LABELS[systemCode] || payload.systemName || payload.systemCode || '',
    reporterPhone: String(payload.reporterPhone || '').trim(),
    reporterEmail: String(payload.reporterEmail || '').trim(),
    reportForOthers,
    reportedUserName: reportForOthers ? String(payload.reportedUserName || '').trim() : '',
    reportedUserPhone: reportForOthers ? String(payload.reportedUserPhone || '').trim() : '',
    description,
    descriptionDoc,
    descriptionHtml,
    attachments: payload.attachments || [],
    createdAt,
    updatedAt: now,
    requesterId: payload.requesterId || user?.id || null,
    requesterName: payload.requesterName || user?.name || '未知用户',
    assigneeL1Id: null,
    assigneeL1Name: null,
    assigneeL2Id: null,
    assigneeL2Name: null,
    messages: payload.messages || [],
    defectTag: null,
    linkedDefect: null,
    l2Conclusion: '',
    summary: '',
    summarySyncedToCorpus: false,
    rejectionReason: '',
    satisfaction: null,
    descriptionHistory:
      payload.descriptionHistory && payload.descriptionHistory.length > 0
        ? payload.descriptionHistory
        : [
            buildDescriptionHistoryEntry({
              ticket: {
                id: payload.id,
                requesterId: payload.requesterId || user?.id || null,
                requesterName: payload.requesterName || user?.name || '未知用户'
              },
              descriptionDoc,
              descriptionHtml,
              description,
              user,
              reason: '暂存草稿初始版本',
              editedAt: createdAt
            })
          ]
  };
}

function buildAiResolvedTicket(ticket = {}, payload = {}, user, now) {
  const aiResolution = {
    ...(payload.aiResolution || {}),
    answer: payload.aiResolution?.answer || '',
    messages: Array.isArray(payload.aiResolution?.messages) ? payload.aiResolution.messages : [],
    resolvedAt: payload.aiResolution?.resolvedAt || now,
    resolvedBy: 'AI'
  };

  return {
    ...ticket,
    ...payload,
    isDraft: false,
    id: payload.id || ticket.id,
    draftId: payload.draftId || ticket.draftId || null,
    submittedAt: ticket.submittedAt || now,
    closedAt: now,
    aiResolved: true,
    aiResolution,
    summary: payload.summary || ticket.summary || aiResolution.answer,
    updatedAt: now,
    requesterId: ticket.requesterId || user?.id || null,
    requesterName: ticket.requesterName || user?.name || '未知用户'
  };
}
