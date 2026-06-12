# Solution Library Detail Iteration Design

## Goal

Extend the standard solution library so an administrator can optionally associate one third-party data-fix scheme, inspect solution details and change records, and inspect referenced tickets from the reference count.

## Scope

- Add one nullable third-party data-fix scheme association to solution create/update payloads.
- Query third-party data-fix schemes through a server adapter endpoint with keyword search.
- Save the selected third-party scheme as a snapshot on the solution and in solution versions.
- Add a solution detail drawer opened from solution code or title.
- Add a reference drawer opened from reference count, with paginated searchable ticket references.

## Architecture

The solution library already stores current rows, versions, and references as JSON snapshots in SQLite-backed tables. This iteration keeps that model: `normalizeSolutionInput` accepts a nullable `thirdPartyDataFixScheme`, `buildSolutionSnapshot` preserves it, and rollback restores it from version snapshots.

Server routes expose read APIs for detail and references. The third-party data-fix scheme API is an internal adapter endpoint for now; it returns stable preset data and can later be replaced by a real external integration without changing the admin page.

The admin page keeps the existing table/modal pattern. It adds a searchable single-select field in the modal, a detail drawer for code/title clicks, and a reference drawer for count clicks.

## Data Shape

`thirdPartyDataFixScheme` is either `null` or:

```json
{
  "id": "tp_dfs_policy_refresh",
  "code": "TP-DFS-001",
  "title": "第三方保单缓存刷新",
  "sourceSystem": "第三方数据平台",
  "description": "用于同步保单状态并刷新缓存"
}
```

## Error Handling

- Third-party search failures show a page message and keep the select usable.
- Missing solution detail returns 404-style API payload and shows an error message.
- Reference list search and pagination failures show a message and leave the drawer open.

## Testing

- Utility tests verify normalization, snapshot preservation, import/export display values, and clearable association.
- Store tests verify create/update/detail/rollback preserve the third-party snapshot and reference pagination/search returns versioned references.
- Route tests verify detail, reference list, and third-party search APIs.
- Admin view source tests verify the new select, drawer triggers, detail drawer, reference drawer, search, and pagination hooks are present.
