import test from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';

import {
  buildSupportRestPeriodFromQuickAdd,
  isSupportRestPeriodVisible
} from '../supportRestTimeSlots.js';

test('quick add support rest period maps morning afternoon and full day to the configured times', () => {
  const morning = buildSupportRestPeriodFromQuickAdd({
    date: '2026-05-18',
    slot: 'MORNING',
    userIds: ['u_l1_1'],
    reason: '上午休息'
  });
  const afternoon = buildSupportRestPeriodFromQuickAdd({
    date: '2026-05-18',
    slot: 'AFTERNOON',
    userIds: ['u_l1_2'],
    reason: '下午休息'
  });
  const fullDay = buildSupportRestPeriodFromQuickAdd({
    date: '2026-05-18',
    slot: 'FULL_DAY',
    userIds: ['u_l1_1', 'u_l1_2'],
    reason: '全天休息'
  });

  assert.equal(dayjs(morning.startsAt).format('YYYY-MM-DD HH:mm'), '2026-05-18 09:00');
  assert.equal(dayjs(morning.endsAt).format('YYYY-MM-DD HH:mm'), '2026-05-18 12:00');
  assert.equal(dayjs(afternoon.startsAt).format('YYYY-MM-DD HH:mm'), '2026-05-18 13:30');
  assert.equal(dayjs(afternoon.endsAt).format('YYYY-MM-DD HH:mm'), '2026-05-18 18:30');
  assert.equal(dayjs(fullDay.startsAt).format('YYYY-MM-DD HH:mm'), '2026-05-18 09:00');
  assert.equal(dayjs(fullDay.endsAt).format('YYYY-MM-DD HH:mm'), '2026-05-18 18:30');
  assert.deepEqual(fullDay.userIds, ['u_l1_1', 'u_l1_2']);
});

test('support rest periods visible on or after today stay visible and past ones are hidden', () => {
  const today = dayjs().startOf('day');
  const visible = isSupportRestPeriodVisible({
    startsAt: today.add(1, 'hour').toISOString(),
    endsAt: today.add(2, 'hour').toISOString()
  }, today.toDate());
  const hidden = isSupportRestPeriodVisible({
    startsAt: today.subtract(2, 'day').toISOString(),
    endsAt: today.subtract(1, 'day').toISOString()
  }, today.toDate());

  assert.equal(visible, true);
  assert.equal(hidden, false);
});
