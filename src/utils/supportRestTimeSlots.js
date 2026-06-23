import dayjs from 'dayjs';

export const SUPPORT_REST_SLOT_OPTIONS = [
  { label: '上午', value: 'MORNING' },
  { label: '下午', value: 'AFTERNOON' },
  { label: '全天', value: 'FULL_DAY' }
];

const SUPPORT_REST_SLOT_RANGES = {
  MORNING: { start: [9, 0], end: [12, 0] },
  AFTERNOON: { start: [13, 30], end: [18, 30] },
  FULL_DAY: { start: [9, 0], end: [18, 30] }
};

export function buildSupportRestPeriodFromQuickAdd({
  date,
  slot,
  userIds = [],
  reason = '',
  idPrefix = 'rest'
}) {
  const dateValue = dayjs(date);
  if (!dateValue.isValid()) {
    throw new Error('请选择具体日期');
  }

  const range = SUPPORT_REST_SLOT_RANGES[slot];
  if (!range) {
    throw new Error('请选择休息时段');
  }

  return {
    id: `${idPrefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    userIds: uniqueStrings(userIds),
    startsAt: dateValue.hour(range.start[0]).minute(range.start[1]).second(0).millisecond(0).toISOString(),
    endsAt: dateValue.hour(range.end[0]).minute(range.end[1]).second(0).millisecond(0).toISOString(),
    reason: String(reason || '').trim()
  };
}

export function isSupportRestPeriodVisible(period, referenceDate = new Date()) {
  const endsAtTime = Date.parse(period?.endsAt);
  if (!Number.isFinite(endsAtTime)) return false;
  return endsAtTime >= startOfLocalDay(referenceDate).getTime();
}

export function startOfLocalDay(date = new Date()) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return new Date();
  }
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}
