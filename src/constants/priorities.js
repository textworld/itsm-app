export const PRIORITIES = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4'
};

export const PRIORITY_LABELS = {
  [PRIORITIES.P1]: 'P1-紧急',
  [PRIORITIES.P2]: 'P2-高',
  [PRIORITIES.P3]: 'P3-中',
  [PRIORITIES.P4]: 'P4-不紧急'
};

export const PRIORITY_OPTIONS = Object.values(PRIORITIES).map((value) => ({
  value,
  label: PRIORITY_LABELS[value]
}));

export const PRIORITY_SLA_MINUTES = {
  [PRIORITIES.P1]: 30,
  [PRIORITIES.P2]: 120,
  [PRIORITIES.P3]: 360,
  [PRIORITIES.P4]: 480
};

export const PRIORITY_ORDER = {
  [PRIORITIES.P1]: 1,
  [PRIORITIES.P2]: 2,
  [PRIORITIES.P3]: 3,
  [PRIORITIES.P4]: 4
};
