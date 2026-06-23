# Research: 工单字典字段配置

## Decision: Extend existing admin configuration rather than adding a new configuration store

**Rationale**: System configuration already lives in `app_configs` under `SYSTEM_CONFIG_KEY`, is edited through `/api/admin/systems`, and is normalized by shared validation helpers. Adding the field label and dictionary reference to each system keeps the new behavior auditable with the existing `updatedAt` and `updatedBy` metadata.

**Alternatives considered**:
- Create a separate system-field configuration table: rejected because the prototype already stores admin configuration as JSON app configs and the feature is one field per system.
- Hard-code labels from new/old system category: rejected because the specification requires per-system custom Chinese names.

## Decision: Generalize dictionary access while preserving the existing insurance dictionary

**Rationale**: The current `dictionary_items` table stores typed dictionary rows with `id`, `type`, `code`, `name`, `enabled`, and JSON data. This supports both the existing insurance type use case and future module-style dictionaries by type. The plan should introduce generic dictionary listing/lookup helpers and reusable validation while keeping the current insurance page behavior intact.

**Alternatives considered**:
- Reuse only `INSURANCE_TYPE` for every system: rejected because old systems need “模块” or other dictionary names that should not be semantically tied to insurance.
- Add a separate dictionary table: rejected because `dictionary_items` already models typed enumerations and seed data.

## Decision: Snapshot selected classification data into the ticket payload at creation time

**Rationale**: The spec requires historical tickets to remain understandable after system labels or dictionary option names change. Ticket creation should store a nested classification snapshot containing the configured field label, dictionary type/id, option id/code, and option Chinese name only when the requester selected a value.

**Alternatives considered**:
- Store only dictionary and option identifiers and resolve names during display: rejected because historical display would drift after configuration changes.
- Store only Chinese names: rejected because later reporting and validation need stable identifiers.

## Decision: Keep the field optional and omit invalid blank classifications

**Rationale**: Clarification selected that the classification field is always optional. When no option is selected, the submitted ticket should not include empty identifiers or placeholder values, avoiding misleading analytics and preserving simple validation.

**Alternatives considered**:
- Require the field whenever configured: rejected by clarification.
- Store empty strings for unselected classifications: rejected because it creates invalid classification records.

## Decision: Do not introduce new ticket lifecycle events

**Rationale**: The feature enriches create/draft payload data and admin configuration, but it does not alter status transitions, assignment, dispatch, requester/support status, or processing sub-status. Existing create events such as `SUBMIT`, `CREATE_DRAFT`, and OA submission events remain the lifecycle boundary.

**Alternatives considered**:
- Add a state machine event for setting classification: rejected because classification is part of submit/draft data, not a lifecycle transition.

## Decision: Validate classification at the API/store boundary before state machine creation

**Rationale**: The submit page can snapshot the visible option for UX, but server-side creation must re-validate any provided classification against current system config and dictionary items to prevent stale or tampered identifiers. For optional unselected values, validation should allow absence.

**Alternatives considered**:
- Trust the client snapshot: rejected because API route input is an external boundary.
- Only validate in React form: rejected because drafts, tests, or direct API calls can bypass UI validation.
