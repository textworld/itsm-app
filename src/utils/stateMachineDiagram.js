import {
  PROCESSING_SUB_STATUS_LABELS,
  STATUS,
  STATUS_LABELS
} from '../constants/ticketStatus.js';

const DEFAULT_STATE_ORDER = [
  STATUS.PENDING,
  STATUS.PROCESSING,
  STATUS.INFO_SUPPLEMENT,
  STATUS.CONFIRMING,
  STATUS.CLOSED
];

export function generatePlantUmlStateDiagram(
  transitions = [],
  statusLabels = STATUS_LABELS,
  eventLabels = {}
) {
  const states = getOrderedWorkflowStates(transitions);
  const lines = ['@startuml', 'hide empty description'];

  states.forEach((state) => {
    lines.push(`state "${buildStateLabel(state, statusLabels)}" as ${state}`);
  });

  transitions.forEach((transition) => {
    const from = transition.from === null ? '[*]' : transition.from;
    const to = transition.to;
    const label = buildTransitionLabel(transition);
    if (to) {
      lines.push(`${from} --> ${to} : ${label}`);
    }
  });

  lines.push('', 'legend right');
  Object.entries(eventLabels).forEach(([event, label]) => {
    lines.push(`  ${event} = ${label}`);
  });
  lines.push('endlegend', '@enduml');

  return lines.join('\n');
}

export function getOrderedWorkflowStates(transitions = []) {
  const states = [...new Set(transitions.flatMap((transition) => [transition.from, transition.to]).filter(Boolean))];
  const ordered = DEFAULT_STATE_ORDER.filter((state) => states.includes(state));
  const remaining = states.filter((state) => !ordered.includes(state));
  return [...ordered, ...remaining];
}

function buildStateLabel(state, statusLabels) {
  return `${statusLabels[state] || state}\\n(${state})`;
}

function buildTransitionLabel(transition) {
  const parts = [transition.id ? `[${transition.id}]` : null, transition.event].filter(Boolean);
  if (transition.toSubStatus) {
    parts.push(`-> ${PROCESSING_SUB_STATUS_LABELS[transition.toSubStatus] || transition.toSubStatus}`);
  }
  return parts.join(' ');
}
