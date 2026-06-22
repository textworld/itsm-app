# Ticket Auto Assignment Abstraction Design

## Goal

Refactor backend ticket auto-assignment so new assignment rules can be added without changing the router control flow, while keeping all ticket status and assignment changes behind the ticket state machine.

## Scope

This change covers L1 auto-assignment for newly pending formal tickets created by `SUBMIT`, `OA_ITSM_GENERATE_TICKET`, and `OA_REAPPROVE_GENERATE`.

It does not change L2 assignment, subtask assignment, or technical transfer assignment rules.

## Architecture

`src/server/store.js` remains the integration point that decides when a pending ticket should be auto-assigned. It calls `routeScheduleAssignee`, then dispatches `EVENTS.ACCEPT` as the selected L1 support user.

`src/utils/scheduleDispatchRouting.js` owns assignment rule selection. The router accepts an ordered list of rule strategies. Each rule receives `{ ticket, group, systemCode }` and returns a route candidate with `ruleType`, `ruleId`, `routeKey`, and `sequence`.

Default rules are registered in priority order:

1. `INSURANCE_TEAM_ASSIGNMENT_RULE`
2. `FLEXIBLE_SYSTEM_ASSIGNMENT_RULE`
3. `BASE_SCHEDULE_ASSIGNMENT_RULE`

The router performs shared concerns after rule matching: online L1 filtering, sequence selection, and round-robin continuation from previous tickets. New rules can be added by registering another strategy object before or after the defaults.

## Data Flow

1. A ticket event creates or restores a formal pending ticket.
2. `autoAssignPendingTicket` checks that the ticket is pending, unassigned, not a subtask, and from an auto-assignment trigger event.
3. The schedule router selects an online L1 assignee from admin schedule configuration.
4. Store dispatches `EVENTS.ACCEPT` with assignment payload and schedule metadata.
5. `ticketStateMachine.js` writes statuses, assignee fields, timeline, and assignee history.

## Testing

Tests cover existing assignment behavior and the new extension point:

- Insurance team priority over flexible and base rules.
- Flexible rule priority over base schedule.
- Weighted round-robin for flexible rules.
- Offline assignees are skipped.
- Custom rule registration can override defaults without router changes.
- Store-level automatic assignment records an `ACCEPT` transition rather than directly mutating status fields.
