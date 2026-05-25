# Data Model: 工单字典字段配置

## Entity: System Configuration

Represents a business system available for ticket submission.

### Fields

- `id`: stable system identifier.
- `code`: unique uppercase system code used by forms and tickets.
- `name`: Chinese display name shown to users.
- `category`: `OLD` or `NEW`, used for new/old system grouping.
- `visibleInSubmit`: whether the system appears in requester-facing system selectors.
- `ticketClassification`: optional configuration for the submit-time classification field.
  - `fieldLabel`: Chinese field label displayed on the ticket submit page, such as `险种` or `模块`.
  - `dictionaryType`: dictionary type whose enabled options are shown for this system.

### Validation Rules

- `code` is required and unique across systems.
- `name` is required.
- `category` must be one of the supported system categories.
- `fieldLabel` is optional; when present it must be a non-empty Chinese display label after trimming.
- `dictionaryType` is optional; when present it must reference at least one dictionary type known to the system.
- If either `fieldLabel` or `dictionaryType` is missing, this system has no selectable classification field on the submit page.

### Relationships

- A system may reference one dictionary type for ticket classification.
- A ticket references the selected system by `systemCode` and snapshots selected classification data if the requester selected an option.

## Entity: Dictionary

Represents a typed group of enumerated values.

### Fields

- `type`: stable dictionary type identifier, for example existing insurance type or module-style dictionaries.
- `name`: Chinese dictionary name for administrator selection.
- `items`: available dictionary options for that type.

### Validation Rules

- Dictionary type identifiers must be stable and unique.
- Only enabled dictionary items are selectable for new tickets.
- Disabled dictionary items remain valid for historical ticket display if already snapshotted.

### Relationships

- One system classification configuration references one dictionary type.
- One dictionary type has many dictionary items.

## Entity: Dictionary Item

Represents one selectable enumeration option.

### Fields

- `id`: stable option identifier.
- `type`: dictionary type this item belongs to.
- `code`: unique option code within its dictionary type.
- `name`: Chinese option name displayed to users.
- `enabled`: whether the option can be selected on new tickets.
- `updatedAt`: last update timestamp.
- `updatedBy`: administrator who last changed the item.

### Validation Rules

- `code` is required and unique within `type`.
- `name` is required.
- Disabled items must not appear in the submit page options for new selections.

### Relationships

- Belongs to one dictionary type.
- Can be snapshotted into many tickets.

## Entity: Ticket Classification Snapshot

Represents the optional classification selected on a submitted or drafted ticket.

### Fields

- `fieldLabel`: Chinese field label displayed at submission time.
- `dictionaryType`: dictionary type used at submission time.
- `dictionaryName`: Chinese dictionary name when available.
- `optionId`: selected dictionary item identifier.
- `optionCode`: selected dictionary item code.
- `optionName`: selected dictionary item Chinese name at submission time.

### Validation Rules

- The entire snapshot is optional.
- If present, `fieldLabel`, `dictionaryType`, `optionId`, `optionCode`, and `optionName` are required.
- If the requester leaves the optional field unselected, the ticket must not store an empty snapshot.
- The snapshot is immutable unless the draft is edited before final submission.

### Relationships

- Belongs to one ticket.
- References the selected system's configured dictionary at the time of submission.
- References one dictionary item by stable id and code, while preserving the Chinese display name.

## Entity: Ticket

Represents a service request submitted by a requester.

### Added/Relevant Fields

- `systemCode`: selected system code.
- `systemName`: selected system Chinese display name.
- `ticketClassification`: optional `Ticket Classification Snapshot`.

### State Transitions

- No new lifecycle state is introduced.
- Draft creation and draft update may change `ticketClassification` while the ticket remains a draft.
- Once submitted into the normal workflow, the classification snapshot is preserved for historical display.
