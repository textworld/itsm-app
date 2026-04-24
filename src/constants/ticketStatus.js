/**
 * 工单状态枚举 + 中文映射 + 展示颜色
 *
 * 工单状态拆为：
 * - requesterStatus：提单人视角状态
 * - supportStatus：技术支持视角状态
 * - processingSubStatus：仅在 PROCESSING 下生效的子状态
 */
export const STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUSPENDED: 'SUSPENDED',
  INFO_SUPPLEMENT: 'INFO_SUPPLEMENT',
  CONFIRMING: 'CONFIRMING',
  CLOSED: 'CLOSED',
  RETURNED: 'RETURNED',

  // 兼容旧数据
  INVESTIGATING: 'INVESTIGATING',
  REVIEWING: 'REVIEWING',
  VERIFYING: 'VERIFYING'
};

export const PROCESSING_SUB_STATUS = {
  L1_INVESTIGATION: 'L1_INVESTIGATION',
  L2_INVESTIGATION: 'L2_INVESTIGATION'
};

export const PROCESSING_SUB_STATUS_LABELS = {
  [PROCESSING_SUB_STATUS.L1_INVESTIGATION]: '一线排查',
  [PROCESSING_SUB_STATUS.L2_INVESTIGATION]: '二线排查'
};

export const STATUS_LABELS = {
  [STATUS.PENDING]: '待受理',
  [STATUS.PROCESSING]: '处理中',
  [STATUS.SUSPENDED]: '已挂起',
  [STATUS.INFO_SUPPLEMENT]: '信息补充',
  [STATUS.CONFIRMING]: '待确认',
  [STATUS.CLOSED]: '已办结',
  [STATUS.RETURNED]: '已回退',

  [STATUS.INVESTIGATING]: '处理中',
  [STATUS.REVIEWING]: '处理中',
  [STATUS.VERIFYING]: '待确认'
};

export const STATUS_COLORS = {
  [STATUS.PENDING]: 'orange',
  [STATUS.PROCESSING]: 'processing',
  [STATUS.SUSPENDED]: 'default',
  [STATUS.INFO_SUPPLEMENT]: 'cyan',
  [STATUS.CONFIRMING]: 'gold',
  [STATUS.CLOSED]: 'success',
  [STATUS.RETURNED]: 'red',

  [STATUS.INVESTIGATING]: 'processing',
  [STATUS.REVIEWING]: 'processing',
  [STATUS.VERIFYING]: 'gold'
};

export const REQUESTER_STATUSES = [
  STATUS.PENDING,
  STATUS.PROCESSING,
  STATUS.INFO_SUPPLEMENT,
  STATUS.CONFIRMING,
  STATUS.CLOSED
];

export const SUPPORT_STATUSES = [
  STATUS.PENDING,
  STATUS.PROCESSING,
  STATUS.SUSPENDED,
  STATUS.INFO_SUPPLEMENT,
  STATUS.CONFIRMING,
  STATUS.CLOSED,
  STATUS.RETURNED
];

export const ALL_STATUSES = SUPPORT_STATUSES;

const LEGACY_STATUS_TO_SUPPORT_STATUS = {
  [STATUS.PENDING]: STATUS.PENDING,
  [STATUS.PROCESSING]: STATUS.PROCESSING,
  [STATUS.SUSPENDED]: STATUS.SUSPENDED,
  [STATUS.INFO_SUPPLEMENT]: STATUS.INFO_SUPPLEMENT,
  [STATUS.CONFIRMING]: STATUS.CONFIRMING,
  [STATUS.CLOSED]: STATUS.CLOSED,
  [STATUS.RETURNED]: STATUS.RETURNED,
  [STATUS.INVESTIGATING]: STATUS.PROCESSING,
  [STATUS.REVIEWING]: STATUS.PROCESSING,
  [STATUS.VERIFYING]: STATUS.CONFIRMING
};

const SUPPORT_STATUS_TO_REQUESTER_STATUS = {
  [STATUS.PENDING]: STATUS.PENDING,
  [STATUS.PROCESSING]: STATUS.PROCESSING,
  [STATUS.SUSPENDED]: STATUS.PROCESSING,
  [STATUS.INFO_SUPPLEMENT]: STATUS.INFO_SUPPLEMENT,
  [STATUS.CONFIRMING]: STATUS.CONFIRMING,
  [STATUS.CLOSED]: STATUS.CLOSED,
  [STATUS.RETURNED]: STATUS.PROCESSING
};

export function getSupportStatus(ticket) {
  if (!ticket) return null;
  return LEGACY_STATUS_TO_SUPPORT_STATUS[ticket.supportStatus || ticket.status] || ticket.supportStatus || ticket.status;
}

export function getRequesterStatus(ticket) {
  if (!ticket) return null;
  if (ticket.requesterStatus) return ticket.requesterStatus;
  const supportStatus = getSupportStatus(ticket);
  return SUPPORT_STATUS_TO_REQUESTER_STATUS[supportStatus] || supportStatus;
}

export function getRequesterStatusForSupportStatus(supportStatus) {
  return SUPPORT_STATUS_TO_REQUESTER_STATUS[supportStatus] || supportStatus;
}

export function getDualStatusesForWorkflowStatus(workflowStatus) {
  const supportStatus = LEGACY_STATUS_TO_SUPPORT_STATUS[workflowStatus] || workflowStatus;
  return {
    requesterStatus: getRequesterStatusForSupportStatus(supportStatus),
    supportStatus
  };
}

export function getProcessingSubStatus(ticket) {
  if (!ticket) return null;
  if (ticket.status !== STATUS.PROCESSING && ticket.status !== STATUS.INVESTIGATING && ticket.status !== STATUS.REVIEWING) {
    return null;
  }
  if (ticket.processingSubStatus) return ticket.processingSubStatus;
  if (ticket.status === STATUS.INVESTIGATING || ticket.l2SupportRequested) {
    return PROCESSING_SUB_STATUS.L2_INVESTIGATION;
  }
  return PROCESSING_SUB_STATUS.L1_INVESTIGATION;
}

export function withDualStatuses(ticket) {
  if (!ticket) return ticket;
  const supportStatus = getSupportStatus(ticket);
  const workflowStatus = normalizeWorkflowStatus(ticket.status);
  return {
    ...ticket,
    status: workflowStatus,
    l2SupportRequested: ticket.l2SupportRequested ?? ticket.status === STATUS.INVESTIGATING,
    processingSubStatus:
      workflowStatus === STATUS.PROCESSING
        ? getProcessingSubStatus(ticket) || PROCESSING_SUB_STATUS.L1_INVESTIGATION
        : null,
    requesterStatus: ticket.requesterStatus || getRequesterStatusForSupportStatus(supportStatus),
    supportStatus
  };
}

function normalizeWorkflowStatus(status) {
  if (status === STATUS.INVESTIGATING || status === STATUS.REVIEWING) return STATUS.PROCESSING;
  if (status === STATUS.VERIFYING) return STATUS.CONFIRMING;
  return status;
}
