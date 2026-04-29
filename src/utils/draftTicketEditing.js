import { PRIORITY_LABELS } from '../constants/priorities.js';
import { SYSTEM_CATEGORY, SYSTEM_LABELS, getSystemCategoryByCode } from '../constants/systems.js';
import { buildDescriptionHistoryEntry } from './descriptionHistory.js';
import {
  richTextHtmlToDoc,
  richTextToPlainText,
  richTextValueToDoc
} from './richText.js';

export function buildDraftTicketFormValues(ticket = {}) {
  return {
    toolType: ticket.toolType,
    title: ticket.title || '',
    priority: ticket.priority,
    systemCategory: ticket.systemCategory || getSystemCategoryByCode(ticket.systemCode || ticket.systemName),
    systemName: ticket.systemCode || ticket.systemName || undefined,
    reporterPhone: ticket.reporterPhone || '',
    reporterEmail: ticket.reporterEmail || '',
    reportForOthers: ticket.reportForOthers === true,
    reportedUserName: ticket.reportedUserName || '',
    reportedUserPhone: ticket.reportedUserPhone || '',
    descriptionDoc: ticket.descriptionDoc || richTextValueToDoc(ticket.descriptionHtml),
    descriptionHtml: ticket.descriptionHtml || ''
  };
}

export function buildDraftTicketUpdate({
  ticket,
  values = {},
  attachments,
  user,
  updatedAt = new Date().toISOString()
}) {
  const reportForOthers = values.reportForOthers === true;
  const descriptionDoc = values.descriptionDoc || richTextHtmlToDoc(values.descriptionHtml || '');
  const descriptionHtml = values.descriptionHtml || '';
  const description = richTextToPlainText(descriptionDoc);
  const descriptionChanged =
    (ticket?.description || '') !== description ||
    JSON.stringify(ticket?.descriptionDoc || richTextValueToDoc(ticket?.descriptionHtml) || null) !==
      JSON.stringify(descriptionDoc || null);

  const nextTicket = {
    ...ticket,
    toolType: values.toolType || '',
    title: String(values.title || '').trim(),
    priority: values.priority || '',
    priorityLabel: PRIORITY_LABELS[values.priority] || values.priority || '',
    systemCategory: values.systemCategory || SYSTEM_CATEGORY.OLD,
    systemCode: values.systemName || '',
    systemName: SYSTEM_LABELS[values.systemName] || values.systemName || '',
    reporterPhone: String(values.reporterPhone || '').trim(),
    reporterEmail: String(values.reporterEmail || '').trim(),
    reportForOthers,
    reportedUserName: reportForOthers ? String(values.reportedUserName || '').trim() : '',
    reportedUserPhone: reportForOthers ? String(values.reportedUserPhone || '').trim() : '',
    description,
    descriptionDoc,
    descriptionHtml,
    attachments,
    updatedAt
  };

  if (!descriptionChanged) {
    return nextTicket;
  }

  const historyEntry = buildDescriptionHistoryEntry({
    ticket,
    descriptionDoc,
    descriptionHtml,
    description,
    user,
    reason: '草稿阶段修改工单要素',
    editedAt: updatedAt
  });

  return {
    ...nextTicket,
    descriptionHistory: [...(ticket?.descriptionHistory || []), historyEntry]
  };
}
