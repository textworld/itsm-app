import { shortId } from '../../utils/idGenerator.js';
import { buildAttachments } from '../../utils/fileUtils.js';
import {
  createEmptyRichTextDoc,
  richTextHasContent,
  richTextToPlainText,
  richTextValueToDoc
} from '../../utils/richText.js';
import { STATUS, getRequesterStatus, getSupportStatus } from '../../constants/ticketStatus.js';

const QUOTE_PREVIEW_LIMIT = 120;

export function hasMessageInput({ content = '', contentDoc = null, contentHtml = '', fileList } = {}) {
  return hasTextContent(content) || richTextHasContent(contentDoc || contentHtml) || Boolean(fileList?.length);
}

export function isTicketMessageAllowed(ticket) {
  if (!ticket) return false;
  return (
    getRequesterStatus(ticket) !== STATUS.DRAFT &&
    getSupportStatus(ticket) !== STATUS.DRAFT
  );
}

export async function buildMessagePayload({
  content = '',
  contentDoc = null,
  contentHtml = '',
  fileList,
  user,
  quotedMessage
}) {
  validateMessageAuthor(user);

  const attachments = await buildAttachments(fileList, user);
  const normalizedContentDoc = contentDoc || richTextValueToDoc(contentHtml) || createEmptyRichTextDoc();
  const normalizedContent = hasTextContent(content)
    ? content.trim()
    : richTextToPlainText(normalizedContentDoc);

  return {
    id: shortId('m'),
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    content: normalizedContent,
    contentDoc: normalizedContentDoc,
    attachments,
    quote: quotedMessage
      ? {
          messageId: quotedMessage.id,
          authorName: quotedMessage.authorName,
          previewText: buildQuotePreview(quotedMessage),
          createdAt: quotedMessage.createdAt
        }
      : null,
    createdAt: new Date().toISOString()
  };
}

export async function submitMessageDraft({
  ticketId,
  addMessage,
  content = '',
  contentDoc = null,
  contentHtml = '',
  fileList,
  user,
  quotedMessage
}) {
  if (!ticketId) {
    throw new Error('工单信息缺失');
  }

  if (!hasMessageInput({ content, contentDoc, contentHtml, fileList })) {
    throw new Error('请输入留言内容或上传附件');
  }

  if (typeof addMessage !== 'function') {
    throw new Error('留言写入方法缺失');
  }

  const messageItem = await buildMessagePayload({
    content,
    contentDoc,
    contentHtml,
    fileList,
    user,
    quotedMessage
  });

  await addMessage(ticketId, messageItem);
  return messageItem;
}

export function buildQuotePreview(messageItem) {
  const richValue = messageItem.contentDoc || messageItem.contentHtml || messageItem.content || '';
  const text = richTextToPlainText(richValue);
  const hasAttachments = Boolean(messageItem.attachments?.length);
  const normalized = text || (
    richTextHasContent(richValue)
      ? '[图片或富文本内容]'
      : hasAttachments
        ? '[附件消息]'
        : '[无文本内容]'
  );
  return normalized.length > QUOTE_PREVIEW_LIMIT
    ? `${normalized.slice(0, QUOTE_PREVIEW_LIMIT)}...`
    : normalized;
}

function hasTextContent(content) {
  return typeof content === 'string' && Boolean(content.trim());
}

function validateMessageAuthor(user) {
  if (!user) {
    throw new Error('当前用户信息缺失');
  }

  if (!user.id || !user.name || !user.role) {
    throw new Error('当前用户信息不完整');
  }
}
