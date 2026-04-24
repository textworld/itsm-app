import { shortId } from '../../utils/idGenerator.js';
import { buildAttachments } from '../../utils/fileUtils.js';
import { richTextHasContent, richTextToPlainText } from '../../utils/richText.js';

const QUOTE_PREVIEW_LIMIT = 120;

export function hasMessageInput({ content = '', contentHtml = '', fileList } = {}) {
  return hasTextContent(content) || richTextHasContent(contentHtml) || Boolean(fileList?.length);
}

export async function buildMessagePayload({
  content = '',
  contentHtml = '',
  fileList,
  user,
  quotedMessage
}) {
  validateMessageAuthor(user);

  const attachments = await buildAttachments(fileList, user);
  const normalizedContent = hasTextContent(content)
    ? content.trim()
    : richTextToPlainText(contentHtml);

  return {
    id: shortId('m'),
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    content: normalizedContent,
    contentHtml,
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
  contentHtml = '',
  fileList,
  user,
  quotedMessage
}) {
  if (!ticketId) {
    throw new Error('工单信息缺失');
  }

  if (!hasMessageInput({ content, contentHtml, fileList })) {
    throw new Error('请输入留言内容或上传附件');
  }

  if (typeof addMessage !== 'function') {
    throw new Error('留言写入方法缺失');
  }

  const messageItem = await buildMessagePayload({
    content,
    contentHtml,
    fileList,
    user,
    quotedMessage
  });

  addMessage(ticketId, messageItem);
  return messageItem;
}

export function buildQuotePreview(messageItem) {
  const text = richTextToPlainText(messageItem.contentHtml || messageItem.content || '');
  const hasAttachments = Boolean(messageItem.attachments?.length);
  const normalized = text || (
    richTextHasContent(messageItem.contentHtml)
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
