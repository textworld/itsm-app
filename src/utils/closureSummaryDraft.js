const CACHE_PREFIX = 'itsm:closure-summary';

export function getClosureSummaryCacheKey(ticketId, userId) {
  return `${CACHE_PREFIX}:${encodeURIComponent(userId || 'anonymous')}:${encodeURIComponent(ticketId || 'unknown')}`;
}

export function readClosureSummaryDraft(storage, ticketId, userId) {
  if (!storage || !ticketId) return null;

  try {
    const rawValue = storage.getItem(getClosureSummaryCacheKey(ticketId, userId));
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue);
    if (!parsed?.completed || !String(parsed.text || '').trim()) {
      return null;
    }

    return {
      text: String(parsed.text),
      updatedAt: parsed.updatedAt || null
    };
  } catch (_error) {
    return null;
  }
}

export function writeCompletedClosureSummaryDraft(storage, ticketId, userId, text) {
  if (!storage || !ticketId || !String(text || '').trim()) return;

  storage.setItem(
    getClosureSummaryCacheKey(ticketId, userId),
    JSON.stringify({
      completed: true,
      text: String(text),
      updatedAt: new Date().toISOString()
    })
  );
}

export function clearClosureSummaryDraft(storage, ticketId, userId) {
  if (!storage || !ticketId) return;
  storage.removeItem(getClosureSummaryCacheKey(ticketId, userId));
}
