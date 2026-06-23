# Announcement Management Design

## Context

The ITSM app needs an admin announcement management capability for fault notices. The feature must support creation, approval, publication, top banner display, update, withdrawal, and historical lookup. The accepted UI direction is a single "公告管理" admin list similar to the provided screenshot, with detail/edit/approval/log views opened from the list rather than a separate approval queue.

Existing project patterns to preserve:

- Protected pages live under `app/(protected)` and render client views from `src/views`.
- Admin configuration APIs live under `app/api/config/admin/*`.
- Configuration data is stored through `src/server/adminConfigStore.js` using `app_configs`.
- Admin pages use Ant Design `Card`, `Table`, `Form`, `Modal`/`Drawer`, `Tag`, `Switch`, and toolbar filters.
- Ticket status fields must only change through `src/state-machine/ticketStateMachine.js`; this feature does not modify ticket status fields.

## Goals

- Allow `ADMIN` users and designated fault handlers to create fault announcements.
- Allow approvers selected from `ADMIN` users only.
- Require approval before an announcement is published.
- Show approved and active announcements in a yellow scrolling bar at the top of the protected ITSM layout.
- Allow published announcements to be updated through a new approval cycle.
- Allow manual withdrawal, immediately removing the announcement from the yellow bar.
- Keep history searchable by publish time, affected system, and status.
- Record approval and operation logs with operator, opinion/action, and timestamp.

## Non-Goals

- No new role constants beyond the existing `ADMIN`, `L1`, `L2`, and `REQUESTER`.
- No integration with an external OA system for announcement approval.
- No direct mutation of ticket status or requester/support status fields.
- No separate "approval inbox" page in the first implementation.

## Users And Permissions

Announcement creators:

- Any `ADMIN` user.
- Any designated fault handler selected on the announcement. In practice, handlers are chosen from support users (`L1` and `L2`) when the announcement is created by an admin. A handler can edit and resubmit announcements assigned to them.

Approvers:

- Selected from `ADMIN` users only.
- The selected approver can approve or reject a pending announcement.
- `ADMIN` users can still manage and withdraw announcements for operational control.

Viewers:

- All authenticated users can see published active announcements in the top yellow bar.
- Admin management page remains available under the admin management navigation. Non-admin creators can act only through permitted API operations if a later navigation path exposes it.

## Announcement State Model

Statuses:

- `DRAFT`: created but not submitted for approval.
- `PENDING_APPROVAL`: submitted and waiting for the selected admin approver.
- `REJECTED`: rejected by the approver and returned for changes.
- `PUBLISHED`: approved and visible if the display time window is active and not withdrawn.
- `UPDATE_PENDING_APPROVAL`: an update to a published announcement is waiting for approval; the current published version remains visible until the update is approved or the announcement is withdrawn.
- `WITHDRAWN`: manually withdrawn and no longer visible in the top bar.

Publication rules:

- New announcements become visible only after approval.
- Updating a published announcement creates a pending draft version and an approval record. The previous published version remains the active display version until approval passes.
- Approval of an update replaces the published version and records a new publish timestamp.
- Rejection of an update keeps the current published version unchanged and stores the rejection in approval records.
- Withdrawal immediately sets the announcement to `WITHDRAWN` and removes it from the top banner.

## Data Model

Store all announcement data in one app config key, for example `announcementManagement`.

Config shape:

```js
{
  announcements: [
    {
      id,
      title,
      affectedSystems: [{ code, name }],
      faultDescriptionHtml,
      faultDescriptionText,
      progressHtml,
      progressText,
      estimatedRecoveryAt,
      display: {
        scrollSpeed,
        durationSeconds,
        pinned,
        visibleFrom,
        visibleUntil
      },
      handlers: [{ id, name, role }],
      approver: { id, name, role },
      creator: { id, name, role },
      status,
      activeVersion,
      publishedSnapshot,
      pendingSnapshot,
      publishedAt,
      withdrawnAt,
      createdAt,
      updatedAt,
      approvalRecords: [
        {
          id,
          action,
          operator: { id, name, role },
          opinion,
          handledAt
        }
      ],
      operationLogs: [
        {
          id,
          action,
          operator: { id, name, role },
          message,
          createdAt
        }
      ]
    }
  ],
  updatedAt,
  updatedBy
}
```

The exact persisted shape can be simplified during implementation, but it must preserve:

- published content separate from pending update content;
- approval records;
- operation logs;
- display configuration;
- affected system codes for filtering.

## API Design

Admin/config endpoints:

- `GET /api/config/admin/announcements`
  - Returns announcement list, system options, admin approver options, and support handler options.
  - Supports query filters for keyword, status, affected system, and publish date range.

- `POST /api/config/admin/announcements`
  - Creates a draft or directly submits for approval depending on request action.
  - Validates required title, affected systems, rich text description, progress, approver, and creator permission.

- `PUT /api/config/admin/announcements/[id]`
  - Edits draft/rejected announcements.
  - For published announcements, writes `pendingSnapshot` and moves status to `UPDATE_PENDING_APPROVAL`.

- `POST /api/config/admin/announcements/[id]/submit`
  - Submits draft or rejected content for approval.

- `POST /api/config/admin/announcements/[id]/approve`
  - Admin approver approves pending content and publishes it.

- `POST /api/config/admin/announcements/[id]/reject`
  - Admin approver rejects pending content and records opinion.

- `POST /api/config/admin/announcements/[id]/withdraw`
  - Withdraws a published or update-pending announcement and records the reason.

Public protected endpoint:

- `GET /api/announcements/active`
  - Returns published, unwithdrawn announcements that are currently displayable.
  - Sorts pinned announcements first, then most recently published.
  - Used by the global protected layout banner.

All mutating endpoints must derive actor identity from the session cookie, not request body.

## UI Design

Navigation:

- Add "公告管理" under the existing `ADMIN` "后台管理" menu.
- The route is `/announcements`.
- The page file renders `src/views/AdminAnnouncements`.

Admin list page:

- Header: title "公告管理" and primary button "发布公告".
- Filters: keyword, affected system, status, publish date range.
- Table columns: status, announcement title, affected system, approver, estimated recovery time, publish time, creator, pinned, actions.
- Row actions:
  - `详情`: view content, approval records, and operation logs.
  - `编辑`: allowed for draft/rejected and update flow.
  - `提交审批`: allowed for draft/rejected.
  - `审批`: visible to selected approver when pending.
  - `撤回`: visible for published/update-pending items to admins.
  - `置顶`: toggles pinned display for published announcements; record operation log.

Create/edit drawer:

- Title.
- Affected systems multi-select using system configuration.
- Fault description rich text field.
- Current progress rich text field.
- Estimated recovery time.
- Fault handlers multi-select from `L1` and `L2` users.
- Approver select from `ADMIN` users.
- Display config: scroll speed, display duration, pinned.
- Actions: save draft, submit for approval, cancel.

Detail drawer:

- Announcement metadata and status.
- Rendered rich text for description and progress.
- Display configuration.
- Approval records.
- Operation logs.

Top yellow banner:

- Implement in `src/components/Layout/AppLayout.jsx` or a child component mounted inside it.
- Fetch `/api/announcements/active` after authentication.
- Render only if at least one active announcement exists.
- Use a compact yellow bar above page content and below the main header/navigation.
- Pinned announcements display first and remain available; non-pinned announcements rotate/scroll according to configured speed and duration.
- Include "查看详情" to open a lightweight detail modal/drawer.

## Validation And Errors

Validation must check:

- title is present and within a reasonable length;
- at least one affected system is selected;
- rich text fields contain meaningful text, not only empty HTML;
- estimated recovery time is optional only if the product accepts unknown recovery time; otherwise require it;
- approver is an `ADMIN` user;
- handlers are support users (`L1` or `L2`);
- scroll speed and duration are positive numbers;
- only selected approver can approve or reject;
- withdrawn announcements cannot be approved or edited without creating a new announcement.

The first implementation will require estimated recovery time because the supplied requirement lists it as a configured field.

## Testing Strategy

Unit tests:

- Announcement validation utility:
  - rejects missing required fields;
  - rejects non-admin approver;
  - rejects non-support handler;
  - accepts valid draft/update payloads;
  - separates pending update from published snapshot.

- Announcement store/service:
  - create and submit moves to `PENDING_APPROVAL`;
  - approve publishes and records approval log;
  - reject returns to `REJECTED`;
  - update published creates `UPDATE_PENDING_APPROVAL` while preserving current published content;
  - withdraw hides announcement and records operation log;
  - active announcement selector returns pinned first and filters withdrawn/out-of-window items.

Route tests:

- Mutating routes require an authenticated actor.
- Approval route requires the selected admin approver.
- Active route returns only displayable announcements.

UI/source tests:

- Admin navigation includes "公告管理".
- Announcement page route renders the admin announcements view.
- App layout mounts the top announcement banner.

## Implementation Notes

- Reuse rich text helpers from `src/utils/richText.js` where possible.
- Reuse system options from `getSystemConfig({ visibleOnly: true })`.
- Reuse user listing patterns from `src/server/adminConfigStore.js`; add helper functions for admin users and support handler users if needed.
- Keep announcement business logic in a dedicated utility/service module to make TDD practical and keep API route handlers thin.
- Do not modify ticket status fields in any API, store, or component for this feature.
