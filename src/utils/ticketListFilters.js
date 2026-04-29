import { ROLES } from '../constants/roles.js';
import {
  getProcessingSubStatus,
  getRequesterStatus,
  getSupportStatus
} from '../constants/ticketStatus.js';
import { isTicketOverdue } from './sla.js';

export function filterTicketsBySearch(tickets, filters = {}, options = {}) {
  const ticketId = normalizeSearch(filters.ticketId);
  const title = normalizeSearch(filters.title);
  const systemKeyword = normalizeSearch(filters.systemKeyword);
  const requesterName = normalizeSearch(filters.requesterName);
  const assigneeName = normalizeSearch(filters.assigneeName);
  const reporterPhone = normalizeSearch(filters.reporterPhone);
  const customTag = normalizeSearch(filters.customTag);
  const hasUnread = filters.hasUnread || undefined;
  const isOverdue = filters.isOverdue || undefined;
  const hasDefectTag = filters.hasDefectTag || undefined;
  const hasLinkedDefect = filters.hasLinkedDefect || undefined;
  const createdRange = normalizeDateRange(filters.createdRange);
  const updatedRange = normalizeDateRange(filters.updatedRange);
  const now = options.now || Date.now();

  return (Array.isArray(tickets) ? tickets : []).filter((ticket) => {
    const visibleStatus = getVisibleStatus(ticket, options.user);
    const matchesId =
      !ticketId || String(ticket.id || '').toLowerCase().includes(ticketId);
    const matchesTitle =
      !title || String(ticket.title || '').toLowerCase().includes(title);
    const matchesPriority = !filters.priority || ticket.priority === filters.priority;
    const matchesToolType = !filters.toolType || ticket.toolType === filters.toolType;
    const matchesStatus = !filters.status || visibleStatus === filters.status;
    const matchesSubStatus =
      !filters.processingSubStatus || getProcessingSubStatus(ticket) === filters.processingSubStatus;
    const matchesSystem =
      !systemKeyword ||
      [ticket.systemCode, ticket.systemName, ticket.systemCategory]
        .some((value) => String(value || '').toLowerCase().includes(systemKeyword));
    const matchesRequester =
      !requesterName ||
      [ticket.requesterName, ticket.requesterId]
        .some((value) => String(value || '').toLowerCase().includes(requesterName));
    const matchesAssignee =
      !assigneeName ||
      [ticket.assigneeL1Name, ticket.assigneeL1Id, ticket.assigneeL2Name, ticket.assigneeL2Id]
        .some((value) => String(value || '').toLowerCase().includes(assigneeName));
    const matchesReporterPhone =
      !reporterPhone ||
      [ticket.reporterPhone, ticket.reportedUserPhone]
        .some((value) => String(value || '').toLowerCase().includes(reporterPhone));
    const matchesCustomTag =
      !customTag ||
      Object.values(ticket.customTagsByUser || {})
        .flat()
        .some((tag) => String(tag || '').toLowerCase().includes(customTag));
    const matchesCreatedRange = matchesDateRange(ticket.createdAt, createdRange);
    const matchesUpdatedRange = matchesDateRange(ticket.updatedAt, updatedRange);
    const matchesUnread = matchesBooleanFilter(hasUnread, hasUnreadMessages(ticket, options.user, options.messageReads));
    const matchesOverdue = matchesBooleanFilter(isOverdue, isTicketOverdue(ticket, now));
    const matchesDefectTag = matchesBooleanFilter(hasDefectTag, Boolean(ticket.defectTag));
    const matchesLinkedDefect = matchesBooleanFilter(hasLinkedDefect, Boolean(ticket.linkedDefect?.defectId));

    return (
      matchesId &&
      matchesTitle &&
      matchesPriority &&
      matchesToolType &&
      matchesStatus &&
      matchesSubStatus &&
      matchesSystem &&
      matchesRequester &&
      matchesAssignee &&
      matchesReporterPhone &&
      matchesCustomTag &&
      matchesCreatedRange &&
      matchesUpdatedRange &&
      matchesUnread &&
      matchesOverdue &&
      matchesDefectTag &&
      matchesLinkedDefect
    );
  });
}

function normalizeSearch(value) {
  return String(value || '').trim().toLowerCase();
}

function getVisibleStatus(ticket, user) {
  if (user?.role === ROLES.REQUESTER) {
    return getRequesterStatus(ticket);
  }
  return getSupportStatus(ticket);
}

function normalizeDateRange(range) {
  if (!Array.isArray(range) || range.length !== 2 || !range[0] || !range[1]) {
    return null;
  }

  return [
    range[0].startOf ? range[0].startOf('day').valueOf() : new Date(range[0]).setHours(0, 0, 0, 0),
    range[1].endOf ? range[1].endOf('day').valueOf() : new Date(range[1]).setHours(23, 59, 59, 999)
  ];
}

function matchesDateRange(value, range) {
  if (!range) return true;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp >= range[0] && timestamp <= range[1];
}

function matchesBooleanFilter(filterValue, actualValue) {
  if (!filterValue) return true;
  return filterValue === 'yes' ? actualValue : !actualValue;
}

function hasUnreadMessages(ticket, user, messageReads) {
  if (!user) return false;
  const readKey = `${user.id}:${ticket.id}`;
  const lastReadTime = messageReads?.[readKey]
    ? new Date(messageReads[readKey]).getTime()
    : 0;

  return (ticket.messages || []).some((message) => {
    if (message.authorId === user.id) return false;
    return new Date(message.createdAt).getTime() > lastReadTime;
  });
}
