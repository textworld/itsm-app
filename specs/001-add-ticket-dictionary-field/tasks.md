# Tasks: 工单字典字段配置

**Input**: Design documents from `/specs/001-add-ticket-dictionary-field/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm feature scaffolding and shared terminology before implementation

- [X] T001 Verify feature artifacts and update task references in `specs/001-add-ticket-dictionary-field/plan.md`
- [X] T002 [P] Add or update shared classification helpers in `src/constants/systems.js` for ticket classification labels and dictionary type metadata

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data and validation support required before any user story work

- [X] T003 [P] Extend system config validation in `src/utils/adminConfigValidation.js` to support optional `ticketClassification.fieldLabel` and `ticketClassification.dictionaryType`
- [X] T004 [P] Extend system config storage and serialization in `src/server/adminConfigStore.js` to persist `ticketClassification` with audit metadata
- [X] T005 [P] Add shared dictionary lookup helpers in `src/server/adminConfigStore.js` for dictionary type, dictionary name, and enabled items
- [X] T006 Add ticket classification snapshot shape and normalization helpers in `src/server/store.js`
- [X] T007 Add classification fixture data or seed updates in `src/server/db.js` for at least one non-insurance dictionary type used by system config

**Checkpoint**: System configuration, dictionary lookup, and ticket snapshot foundations are ready.

---

## Phase 3: User Story 1 - 提交工单时选择系统相关分类 (Priority: P1)

**Goal**: Requesters can see the configured optional classification field for the chosen system and submit a snapshot only when they select a value.

**Independent Test**: As a requester, choose a system with classification configured, verify the field label and options appear, submit with and without a selection, and confirm the ticket detail page reflects the expected saved classification state.

- [X] T008 [US1] Add requester-visible classification metadata to `app/api/systems/route.js` so submit pages receive field label and dictionary type for each visible system
- [X] T009 [P] [US1] Add a dictionary options endpoint in `app/api/dictionaries/options/route.js` that returns enabled options for a requested dictionary type
- [X] T010 [US1] Update ticket creation in `app/api/tickets/route.js` to accept and validate optional classification snapshot data before persisting tickets
- [X] T011 [US1] Update ticket submit payload assembly in `src/views/TicketSubmit/index.jsx` to load the selected system's classification config and include the chosen option snapshot only when selected
- [X] T012 [US1] Update the ticket submit form behavior in `src/views/TicketSubmit/index.jsx` so changing systems clears stale classification selections and shows the current field label
- [X] T013 [US1] Update ticket detail display in `src/components/TicketDetail/TicketInfoCard.jsx` to render the saved classification field label and option name when present
- [X] T014 [US1] Add or update submit flow tests in `src/views/TicketSubmit/__tests__/` and `src/server/__tests__/` to cover optional selection, system switching, and snapshot persistence

**Checkpoint**: User Story 1 is independently usable and testable.

---

## Phase 4: User Story 2 - 管理员按系统配置字段名称和字典 (Priority: P2)

**Goal**: Administrators can configure each system's Chinese classification field label and select the dictionary used for that field.

**Independent Test**: As an admin, open the system configuration page, assign a label and dictionary to a system, save it, and confirm the saved config is returned by the admin systems API.

- [X] T015 [US2] Update admin systems API payloads in `app/api/admin/systems/route.js` to include ticket classification settings in GET and PUT flows
- [X] T016 [US2] Add classification configuration fields to the admin systems UI in `src/views/AdminSystems/index.jsx` so admins can edit field label and dictionary type per system
- [X] T017 [US2] Surface available dictionary groups for admin selection in `src/views/AdminSystems/index.jsx` using existing dictionary data or a shared helper
- [X] T018 [US2] Add validation feedback for partial classification configuration in `src/views/AdminSystems/index.jsx` and `src/utils/adminConfigValidation.js`
- [X] T019 [US2] Add or update admin systems tests in `src/views/AdminSystems/__tests__/` and `src/server/__tests__/adminConfigRoutes.test.js` to cover save, validation, and persistence

**Checkpoint**: User Story 2 is independently usable and testable.

---

## Phase 5: User Story 3 - 查看工单时呈现已保存分类信息 (Priority: P3)

**Goal**: Historical tickets continue to show the saved Chinese field label and option name even after configuration changes.

**Independent Test**: Submit a ticket with a classification value, change the system label or dictionary item later, then reopen the original ticket and confirm the historical snapshot is unchanged.

- [X] T020 [US3] Preserve the saved classification snapshot in ticket read models and serialization paths in `src/server/store.js`
- [X] T021 [US3] Update ticket data loading in `src/context/TicketContext.jsx` or the ticket detail data source so detail views receive the persisted snapshot
- [X] T022 [US3] Update historical display logic in `src/components/TicketDetail/TicketInfoCard.jsx` to prefer saved snapshot values over current system configuration lookup
- [X] T023 [US3] Add regression tests in `src/server/__tests__/` and `src/components/TicketDetail/__tests__/` for historical display after dictionary or system label changes

**Checkpoint**: User Story 3 is independently usable and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, documentation, and final validation across all stories

- [X] T024 [P] Update `specs/001-add-ticket-dictionary-field/quickstart.md` with any final validation notes discovered during implementation
- [X] T025 [P] Run targeted feature checks from `specs/001-add-ticket-dictionary-field/quickstart.md` and record any follow-up fixes in `src/server/__tests__/` or `src/views/`
- [X] T026 Clean up feature-specific code paths and ensure naming consistency across `src/constants/systems.js`, `src/views/TicketSubmit/index.jsx`, and `src/components/TicketDetail/TicketInfoCard.jsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): no dependencies
- Foundational (Phase 2): depends on Setup and blocks all user stories
- User Stories (Phase 3+): depend on Foundational completion
- Polish (Phase 6): depends on all desired user stories being complete

### User Story Dependencies

- US1: can start after Foundational phase
- US2: can start after Foundational phase
- US3: can start after US1 because it depends on persisted classification snapshots and display behavior

### Parallel Opportunities

- T002 can run in parallel with T001
- T003, T004, and T005 can run in parallel after T002
- T009 can run in parallel with T008 once the route contract is settled
- T015–T019 can overlap with US1 implementation if API shape is aligned
- T024 and T025 can run in parallel during polish

## Parallel Example: User Story 1

```bash
Task: T008 Add requester-visible classification metadata to app/api/systems/route.js
Task: T009 Add a dictionary options endpoint in app/api/dictionaries/options/route.js
```

## Parallel Example: User Story 2

```bash
Task: T015 Update admin systems API payloads in app/api/admin/systems/route.js
Task: T016 Add classification configuration fields to the admin systems UI in src/views/AdminSystems/index.jsx
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2 foundations.
2. Deliver US1 so requesters can submit an optional configured classification and see it in ticket detail.
3. Validate the submit flow independently.
4. Add US2 to let admins configure the label and dictionary per system.
5. Add US3 to preserve historical display semantics after later configuration changes.
6. Finish with polish and cross-cutting cleanup.

### Incremental Delivery

- Foundation first to stabilize shared validation and storage.
- US1 provides end-user value and proves the data shape.
- US2 unlocks admin control over labels and dictionaries.
- US3 protects historical readability and prevents config drift.

## Task Format Validation

All tasks follow the required checklist format: checkbox, sequential task ID, optional [P], optional story label for user-story phases, and an exact file path in the description.
