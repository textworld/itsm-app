import {
  createEmptyRichTextDoc,
  richTextHtmlToDoc,
  richTextToPlainText,
  richTextValueToDoc
} from './richText.js';

export function buildDescriptionHistoryEntry({
  ticket,
  descriptionDoc = null,
  descriptionHtml = '',
  description = '',
  user,
  reason = '工单描述修改',
  editedAt = new Date().toISOString()
}) {
  const nextVersion = (ticket?.descriptionHistory?.length || 0) + 1;
  const normalizedDoc = descriptionDoc || richTextValueToDoc(descriptionHtml) || createEmptyRichTextDoc();
  const normalizedText = description || richTextToPlainText(normalizedDoc);

  return {
    id: `desc_${ticket?.id || 'ticket'}_${nextVersion}`,
    version: nextVersion,
    description: normalizedText,
    descriptionDoc: normalizedDoc,
    descriptionHtml,
    editedAt,
    editorId: user?.id || ticket?.requesterId || null,
    editorName: user?.name || ticket?.requesterName || '未知用户',
    reason
  };
}

export function buildDescriptionUpdate(ticket, { descriptionDoc, descriptionHtml, user, reason }) {
  const nextDescriptionDoc =
    descriptionDoc ||
    richTextHtmlToDoc(descriptionHtml) ||
    createEmptyRichTextDoc();
  const nextDescription = richTextToPlainText(nextDescriptionDoc);
  const currentDescription = ticket?.description || '';
  const currentDoc = JSON.stringify(ticket?.descriptionDoc || richTextValueToDoc(ticket?.descriptionHtml) || null);
  const nextDoc = JSON.stringify(nextDescriptionDoc || null);

  if (currentDescription === nextDescription && currentDoc === nextDoc) {
    return null;
  }

  const historyEntry = buildDescriptionHistoryEntry({
    ticket,
    descriptionDoc: nextDescriptionDoc,
    descriptionHtml,
    description: nextDescription,
    user,
    reason
  });

  return {
    description: nextDescription,
    descriptionDoc: nextDescriptionDoc,
    descriptionHtml: descriptionHtml || '',
    updatedAt: historyEntry.editedAt,
    descriptionHistory: [...(ticket?.descriptionHistory || []), historyEntry]
  };
}

export function getHistoryEntryByVersion(history = [], version) {
  return history.find((entry) => entry.version === version) || null;
}

export function buildDescriptionDiff(previousText = '', currentText = '') {
  const previousTokens = tokenize(previousText);
  const currentTokens = tokenize(currentText);
  const operations = diffTokens(previousTokens, currentTokens);

  return operations
    .filter((item) => item.value)
    .map((item, index) => ({
      id: `${item.type}_${index}`,
      ...item
    }));
}

function tokenize(text) {
  const normalized = String(text || '');
  if (!normalized) return [];

  if (normalized.includes('\n')) {
    return normalized.split(/(\n)/).filter(Boolean);
  }

  return Array.from(normalized);
}

function diffTokens(previousTokens, currentTokens) {
  const rows = previousTokens.length;
  const cols = currentTokens.length;
  const matrix = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0));

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let col = cols - 1; col >= 0; col -= 1) {
      if (previousTokens[row] === currentTokens[col]) {
        matrix[row][col] = matrix[row + 1][col + 1] + 1;
      } else {
        matrix[row][col] = Math.max(matrix[row + 1][col], matrix[row][col + 1]);
      }
    }
  }

  const operations = [];
  let row = 0;
  let col = 0;

  while (row < rows && col < cols) {
    if (previousTokens[row] === currentTokens[col]) {
      pushOperation(operations, 'equal', previousTokens[row]);
      row += 1;
      col += 1;
      continue;
    }

    if (matrix[row + 1][col] >= matrix[row][col + 1]) {
      pushOperation(operations, 'remove', previousTokens[row]);
      row += 1;
      continue;
    }

    pushOperation(operations, 'add', currentTokens[col]);
    col += 1;
  }

  while (row < rows) {
    pushOperation(operations, 'remove', previousTokens[row]);
    row += 1;
  }

  while (col < cols) {
    pushOperation(operations, 'add', currentTokens[col]);
    col += 1;
  }

  return operations;
}

function pushOperation(operations, type, token) {
  const last = operations[operations.length - 1];
  if (last && last.type === type) {
    last.value += token;
    return;
  }

  operations.push({ type, value: token });
}
