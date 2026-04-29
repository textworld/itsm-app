export function getUserTicketTags(ticket, userId) {
  if (!ticket || !userId) return [];
  const tags = ticket.customTagsByUser?.[userId];
  return Array.isArray(tags) ? tags : [];
}

export function getReusableCustomTags(tickets, userId) {
  const reusableTags = [];
  const seen = new Set();

  for (const ticket of Array.isArray(tickets) ? tickets : []) {
    for (const tag of getUserTicketTags(ticket, userId)) {
      const normalizedTag = String(tag || '').trim();
      if (!normalizedTag || seen.has(normalizedTag)) continue;
      seen.add(normalizedTag);
      reusableTags.push(normalizedTag);
    }
  }

  return reusableTags;
}

export function buildCustomTagUpdate(ticket, tags, user, updatedAt = new Date().toISOString()) {
  const userId = user?.id;
  if (!userId) {
    return {
      ...ticket,
      updatedAt
    };
  }

  return {
    ...ticket,
    customTagsByUser: {
      ...(ticket.customTagsByUser || {}),
      [userId]: normalizeCustomTags(tags)
    },
    updatedAt
  };
}

function normalizeCustomTags(tags) {
  const normalized = [];
  const seen = new Set();

  for (const tag of Array.isArray(tags) ? tags : []) {
    const value = String(tag || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}
