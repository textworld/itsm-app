export const PRIORITIES = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3'
};

export const PRIORITY_LABELS = {
  [PRIORITIES.P0]: 'P0-紧急',
  [PRIORITIES.P1]: 'P1-高',
  [PRIORITIES.P2]: 'P2-中',
  [PRIORITIES.P3]: 'P3-低',
  P4: 'P3-低'
};

export const PRIORITY_OPTIONS = Object.values(PRIORITIES).map((value) => ({
  value,
  label: PRIORITY_LABELS[value]
}));

export const PRIORITY_SLA_MINUTES = {
  [PRIORITIES.P0]: 30,
  [PRIORITIES.P1]: 120,
  [PRIORITIES.P2]: 360,
  [PRIORITIES.P3]: 480,
  P4: 480
};

export const PRIORITY_ORDER = {
  [PRIORITIES.P0]: 1,
  [PRIORITIES.P1]: 2,
  [PRIORITIES.P2]: 3,
  [PRIORITIES.P3]: 4,
  P4: 4
};
