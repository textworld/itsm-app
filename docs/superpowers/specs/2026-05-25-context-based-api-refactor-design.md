# Context-Based API Refactor Design

## Goal

Refactor the current API surface to match the bounded contexts already present in the domain model:

- Ticket lifecycle
- Ticket submission
- Ticket processing
- OA / approval
- Master data and configuration
- Identity and access

The refactor must preserve the existing state machine rule: all ticket business mutations go through `src/state-machine/ticketStateMachine.js`.

## Background

The current codebase exposes APIs by feature page and utility convenience rather than by domain boundary. Ticket writes are routed through `src/server/store.js`, which also mixes query logic, authorization checks, persistence, and integration behavior. That works, but it makes the domain model hard to reason about and leaves the public API surface inconsistent with the ticket state machine.

## Non-Goals

- No domain rule changes.
- No ticket status model changes.
- No bypass paths for direct writes to `status`, `requesterStatus`, `supportStatus`, or `processingSubStatus`.
- No attempt to split the application into separate services.

## Context Map

### 1. Ticket Lifecycle Context

Owns the main ticket lifecycle model and all state transitions.

Responsibilities:
- Load ticket details and timeline
- Execute ticket state machine commands
- Enforce workflow guards and role constraints
- Keep workflow status as the source of truth

Owned concepts:
- Ticket aggregate
- State machine events
- Timeline entries
- Status projection

Current core:
- `src/state-machine/ticketStateMachine.js`
- `src/constants/ticketStatus.js`

Proposed API:
- `GET /api/workflow/tickets`
- `GET /api/workflow/tickets/:id`
- `POST /api/workflow/tickets/:id/commands`
- `POST /api/workflow/tickets/:id/messages`
- `POST /api/workflow/tickets/:id/custom-tags`

Notes:
- `commands` is the single write entry for workflow actions.
- Requests carry a domain command name and payload, not raw ticket field updates.

### 2. Ticket Submission Context

Owns draft creation, draft editing, submission, and AI-assisted submission flows.

Responsibilities:
- Create and update drafts
- Submit a draft into the lifecycle context
- Handle AI-assisted resolution paths
- Support submission-time rich text and attachment preparation

Owned concepts:
- Draft ticket
- Submission payload
- Submission policy
- AI assistant draft helper

Current core:
- `src/views/TicketSubmit/index.jsx`
- `src/components/TicketSubmit/AiTicketAssistantDrawer.jsx`
- `src/utils/draftTicketEditing.js`

Proposed API:
- `POST /api/submission/drafts`
- `PATCH /api/submission/drafts/:id`
- `POST /api/submission/tickets`
- `POST /api/submission/ai-assistant`
- `POST /api/submission/mock-description`

Notes:
- Submission endpoints decide which workflow event to emit, but do not directly mutate workflow status fields.
- Draft editing remains separate from formal workflow processing.

### 3. Ticket Processing Context

Owns the technical support work done after a ticket enters the active handling flow.

Responsibilities:
- Accept tickets
- Tag defects and link defects
- Reassign work
- Return for more information
- Review, conclude, verify, and close
- Manage subtasks

Owned concepts:
- L1 actions
- L2 actions
- Defect linkage
- Subtask routing

Current core:
- `src/components/TicketDetail/L1Actions.jsx`
- `src/components/TicketDetail/L2Actions.jsx`
- `src/utils/subtaskRouting.js`

Proposed API:
- `POST /api/workflow/tickets/:id/commands`
- `POST /api/workflow/defects`
- `GET /api/workflow/defects`
- `POST /api/workflow/message-reads`
- `POST /api/workflow/export`
- `POST /api/workflow/reset`

Notes:
- Processing actions are commands, not entity patches.
- The API should translate command names to state machine events on the server.

### 4. OA / Approval Context

Owns OA initiation, approval handling, rejection, reopen, and re-approval flows.

Responsibilities:
- Create and manage OA applications
- Receive OA approval actions
- Map OA actions to workflow events
- Keep OA state in sync with ticket lifecycle state

Owned concepts:
- OA application
- OA action
- Approval record

Current core:
- `app/api/oa-simulator`
- `app/(protected)/approvals`
- `SUBMIT_TO_OA` and `OA_*` events in the state machine

Proposed API:
- `GET /api/approval/applications`
- `GET /api/approval/applications/:oaId`
- `POST /api/approval/applications/:oaId/actions`

Notes:
- OA actions are integration commands that dispatch workflow events.
- OA never writes ticket status directly.

### 5. Master Data and Configuration Context

Owns reference data and admin-maintained configuration.

Responsibilities:
- System catalog
- Dictionary options
- Schedule configuration
- Support rest configuration
- Personal quick phrases
- Defect reference data

Owned concepts:
- System config
- Dictionary config
- Schedule group/detail
- Personal support config

Current core:
- `app/api/systems/route.js`
- `app/api/dictionaries/options/route.js`
- `app/api/admin/schedules/route.js`
- `app/api/personal/quick-phrases/route.js`

Proposed API:
- `GET /api/config/systems`
- `GET /api/config/dictionaries/options`
- `GET /api/config/support-assignees`
- `GET /api/config/personal/quick-phrases`
- `GET /api/config/admin/systems`
- `GET /api/config/admin/dictionaries/insurance-types`
- `GET /api/config/admin/schedules`
- `GET /api/config/admin/support-rests`
- `GET /api/config/admin/data-fix-schemes`

Notes:
- Read-only reference APIs should be grouped under `config`.
- Admin writes remain in the same context but are separated from ticket operations.

### 6. Identity and Access Context

Owns login, session, user account management, role checks, and permission templates.

Responsibilities:
- Authenticate users
- Maintain session state
- Enforce role-based access
- Provide permission templates

Owned concepts:
- Session
- User account
- Role
- Permission template

Current core:
- `app/api/auth`
- `src/constants/roles.js`
- `src/server/session.js`

Proposed API:
- `GET /api/access/session`
- `POST /api/access/login`
- `POST /api/access/logout`
- `POST /api/access/register`
- `GET /api/access/admin/users`
- `POST /api/access/admin/users`
- `PATCH /api/access/admin/users/:id`
- `GET /api/access/templates/permission-request`

## Application Layer Design

The server should be reorganized into context-oriented application modules instead of a single mixed store.

Suggested layout:

```text
src/contexts/
  submission/
    commands.js
    policies.js
  workflow/
    commands.js
    queries.js
    repository.js
  approval/
    commands.js
    queries.js
  config/
    queries.js
    adminCommands.js
  access/
    session.js
    users.js
    permissions.js
```

`src/server/store.js` should be reduced to an orchestration layer or decomposed into context-specific repositories. It should not remain the place where all command handling, queries, and helper logic accumulate.

## API Shape

### Command endpoints

Command endpoints should use a uniform payload:

```json
{
  "command": "ACCEPT",
  "payload": {}
}
```

The server maps `command` to a state machine event and applies the transition in the workflow context.

### Query endpoints

Query endpoints return context-specific projections only. They should not expose write helpers or raw persistence concerns.

## Migration Strategy

1. Introduce the new context-based API routes alongside the existing routes.
2. Move frontend callers to the new route names.
3. Refactor server logic into context-oriented modules.
4. Replace direct `PATCH`-style ticket mutation paths with command endpoints.
5. Remove obsolete route aliases after callers are migrated.

## Risks

- The current `TicketContext` and related hooks assume the old route layout.
- Some admin and support views depend on mixed query/write behavior in `src/server/store.js`.
- The refactor may expose hidden direct field writes if tests do not cover all command paths.

## Testing

- Route tests should cover each context boundary separately.
- Command tests should verify all ticket mutations go through the state machine.
- Regression tests should confirm that no route writes workflow status fields directly.
- Frontend tests should be updated only for route and payload changes, not for domain behavior changes.

