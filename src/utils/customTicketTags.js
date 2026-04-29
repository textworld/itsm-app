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
