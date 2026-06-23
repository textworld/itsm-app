export const PERSONAL_QUICK_PHRASES_CONFIG_PREFIX = 'PERSONAL_QUICK_PHRASES';

export function buildPersonalQuickPhrasesConfigKey(userId) {
  return `${PERSONAL_QUICK_PHRASES_CONFIG_PREFIX}:${String(userId || '').trim()}`;
}

export function normalizeQuickPhraseConfig(input = {}) {
  return {
    phrases: Array.isArray(input.phrases)
      ? input.phrases.map((phrase, index) => ({
          id: String(phrase.id || `phrase_${index + 1}`).trim(),
          title: String(phrase.title || '').trim(),
          content: String(phrase.content || '').trim(),
          keywords: uniqueStrings(Array.isArray(phrase.keywords) ? phrase.keywords : [phrase.keywords]),
          enabled: phrase.enabled !== false
        }))
      : []
  };
}

export function validateQuickPhraseConfig(input = {}) {
  const value = normalizeQuickPhraseConfig(input);
  const errors = [];
  const titleOwner = new Set();

  value.phrases.forEach((phrase, index) => {
    const normalizedTitle = phrase.title.toLocaleLowerCase();
    if (!phrase.title) {
      errors.push({ path: ['phrases', index, 'title'], message: '请输入话术标题' });
    } else if (titleOwner.has(normalizedTitle)) {
      errors.push({ path: ['phrases', index, 'title'], message: '话术标题已存在' });
    } else {
      titleOwner.add(normalizedTitle);
    }

    if (!phrase.content) {
      errors.push({ path: ['phrases', index, 'content'], message: '请输入话术内容' });
    }
  });

  return { ok: errors.length === 0, errors, value };
}

export function filterQuickPhrases(phrases = [], query = '') {
  const normalizedQuery = normalizeSearchText(query);
  return (Array.isArray(phrases) ? phrases : [])
    .filter((phrase) => phrase?.enabled !== false)
    .filter((phrase) => {
      if (!normalizedQuery) return true;
      return [
        phrase.title,
        phrase.content,
        ...(Array.isArray(phrase.keywords) ? phrase.keywords : [])
      ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
    });
}

export function insertPhraseForSlashQuery(text = '', phraseContent = '', cursorIndex = String(text).length) {
  const source = String(text || '');
  const safeCursorIndex = Math.max(0, Math.min(source.length, Number(cursorIndex) || 0));
  const beforeCursor = source.slice(0, safeCursorIndex);
  const slashIndex = beforeCursor.lastIndexOf('/');
  const replaceStart = slashIndex >= 0 ? slashIndex : safeCursorIndex;
  return `${source.slice(0, replaceStart)}${String(phraseContent || '')}${source.slice(safeCursorIndex)}`;
}

export function getSlashQuery(text = '', cursorIndex = String(text).length) {
  const source = String(text || '');
  const safeCursorIndex = Math.max(0, Math.min(source.length, Number(cursorIndex) || 0));
  const beforeCursor = source.slice(0, safeCursorIndex);
  const slashIndex = beforeCursor.lastIndexOf('/');
  if (slashIndex < 0) return null;

  const query = beforeCursor.slice(slashIndex + 1);
  if (/\s/.test(query)) return null;
  return query;
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLocaleLowerCase();
}
