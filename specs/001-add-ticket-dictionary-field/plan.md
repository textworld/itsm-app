# Implementation Plan: 工单字典字段配置

**Branch**: `001-add-ticket-dictionary-field` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-add-ticket-dictionary-field/spec.md`

## Summary

Add an optional, system-configured classification field to ticket submission. Administrators configure each system's Chinese field label and dictionary source; requesters see the matching optional field after choosing a system; tickets snapshot the selected dictionary identifiers and Chinese labels for historical display. The implementation will extend existing admin config, dictionary item, ticket submit, ticket creation, and ticket detail paths without adding new ticket lifecycle states.

## Technical Context

**Language/Version**: JavaScript ES modules, React 18.3.1, Next.js 15 App Router  
**Primary Dependencies**: Next.js, React, Ant Design, better-sqlite3, node:test  
**Storage**: SQLite via `better-sqlite3`, with existing JSON fallback; tickets and app config stored as JSON payloads  
**Testing**: Node built-in test runner with existing route/helper/view source tests  
**Target Platform**: Local web application prototype on Next.js  
**Project Type**: Web application with App Router route handlers and React views  
**Performance Goals**: 95% of submit-page system changes show the correct classification label/options within 2 seconds  
**Constraints**: Classification is optional; selected values must be snapshotted; no lifecycle status writes outside the state machine; admin config changes must be audited  
**Scale/Scope**: One optional ticket classification field per configured system; current prototype-scale dictionaries and systems

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Assessment |
|-----------|--------|------------|
| I. 状态机拥有工单生命周期 | PASS | Feature enriches ticket payloads and does not change `status`, requester/support status, processing sub-status, or lifecycle transitions. Ticket creation remains through existing state machine create events. |
| II. 角色感知的工作流完整性 | PASS | Admin-only configuration remains behind admin routes; requester-facing submit and detail flows use existing authenticated routes. No new role operation is exposed without route protection. |
| III. 原型范围必须明确 | PASS | Scope is limited to system config, dictionary-backed submit field, ticket snapshot, and detail display. No dispatch, assignment, lifecycle, navigation permission, or OA workflow change is planned. |
| IV. 数据与配置必须可审计 | PASS | System config continues to persist through `saveSystemConfig` with `updatedAt` and `updatedBy`; ticket snapshots preserve historical labels and identifiers. |
| V. 测试守护行为 | PASS | Plan includes focused tests for validation helpers, routes, submit UI behavior, ticket creation, and detail display. |

## Project Structure

### Documentation (this feature)

```text
specs/001-add-ticket-dictionary-field/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── admin/
│   │   ├── systems/route.js
│   │   └── dictionaries/insurance-types/route.js
│   ├── dictionaries/options/route.js
│   ├── systems/route.js
│   └── tickets/route.js
└── (protected)/
    ├── systems/page.jsx
    └── tickets/
        ├── new/page.jsx
        └── [id]/page.jsx

src/
├── constants/
│   └── systems.js
├── context/
│   └── TicketContext.jsx
├── hooks/
│   └── useSystems.js
├── server/
│   ├── adminConfigStore.js
│   ├── db.js
│   ├── store.js
│   └── __tests__/
├── utils/
│   ├── adminConfigValidation.js
│   └── __tests__/
├── views/
│   ├── AdminSystems/
│   └── TicketSubmit/
└── components/
    └── TicketDetail/TicketInfoCard.jsx
```

**Structure Decision**: Use the existing Next.js App Router and shared `src/` modules. Add one public authenticated dictionary-options route only if needed for requester submit options; keep admin configuration under existing admin systems route and validation helpers.

## Phase 0: Research

Completed in [research.md](./research.md).

Resolved decisions:

- Extend existing system admin config rather than adding a new config store.
- Generalize dictionary access while preserving the existing insurance dictionary.
- Snapshot selected classification data into each ticket at creation time.
- Keep the field optional and omit invalid blank classifications.
- Do not introduce new lifecycle events.
- Validate classification at the API/store boundary before state machine creation.

## Phase 1: Design & Contracts

Generated artifacts:

- [data-model.md](./data-model.md)
- [contracts/api.md](./contracts/api.md)
- [quickstart.md](./quickstart.md)

Design notes:

- `System Configuration` gains optional `ticketClassification` with `fieldLabel` and `dictionaryType`.
- `Ticket` gains optional `ticketClassification` snapshot only when the requester selects a classification option.
- Detail display uses the saved snapshot, not current configuration lookup.
- Draft create/update can carry the snapshot; final submitted tickets preserve it.

## Post-Design Constitution Check

| Principle | Status | Assessment |
|-----------|--------|------------|
| I. 状态机拥有工单生命周期 | PASS | Data design does not add lifecycle fields or transitions; ticket creation remains routed through existing events. |
| II. 角色感知的工作流完整性 | PASS | Admin configuration and requester use remain separated by existing route responsibilities. |
| III. 原型范围必须明确 | PASS | Artifacts explicitly exclude dispatch, assignment, OA flow, and lifecycle changes. |
| IV. 数据与配置必须可审计 | PASS | Configuration audit metadata remains in `app_configs`; ticket snapshots preserve historical classification semantics. |
| V. 测试守护行为 | PASS | Quickstart and future tasks should include route/helper/view tests aligned to touched layers. |

## Complexity Tracking

No constitution violations or exceptional complexity requiring justification.
