import { ROLES } from '../constants/roles.js';
import { PROCESSING_SUB_STATUS, STATUS, getProcessingSubStatus } from '../constants/ticketStatus.js';

export const TICKET_ACTIONS = {
  CREATE_SUBTASK: 'CREATE_SUBTASK',
  UPDATE_CUSTOM_TAGS: 'UPDATE_CUSTOM_TAGS'
};

const ALL_TICKET_STATUSES = [
  STATUS.DRAFT,
  STATUS.PENDING,
  STATUS.PROCESSING,
  STATUS.INFO_SUPPLEMENT,
  STATUS.CONFIRMING,
  STATUS.CLOSED
];

export const TICKET_PERMISSION_MATRIX = {
  [ROLES.REQUESTER]: {},
  [ROLES.L1]: {
    [TICKET_ACTIONS.CREATE_SUBTASK]: [
      {
        status: STATUS.PROCESSING,
        processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION
      }
    ],
    [TICKET_ACTIONS.UPDATE_CUSTOM_TAGS]: ALL_TICKET_STATUSES
  },
  [ROLES.L2]: {
    [TICKET_ACTIONS.UPDATE_CUSTOM_TAGS]: ALL_TICKET_STATUSES
  }
};

export function canPerformTicketAction(ticket, user, action) {
  if (!ticket || !user?.role || !action) return false;

  const rules = TICKET_PERMISSION_MATRIX[user.role]?.[action] || [];
  return rules.some((rule) => {
    if (typeof rule === 'string') {
      return rule === ticket.status;
    }

    if (rule.status !== ticket.status) {
      return false;
    }

    if (!rule.processingSubStatus) {
      return true;
    }

    return getProcessingSubStatus(ticket) === rule.processingSubStatus;
  });
}
