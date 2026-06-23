# Quickstart: 工单字典字段配置

## Prerequisites

- Use an administrator demo account to maintain systems and dictionaries.
- Use a requester demo account to submit tickets.
- Start the app locally with the existing project workflow.

## Manual Validation Flow

1. Open the system configuration page.
2. Edit an old system and configure:
   - Classification field label: `模块`
   - Dictionary: module-style dictionary
3. Edit a new system and configure:
   - Classification field label: `险种`
   - Dictionary: insurance type dictionary
4. Open the ticket submit page as a requester.
5. Select the old system.
6. Confirm the optional field label is `模块` and options come from the configured dictionary.
7. Leave the field empty and submit a ticket.
8. Confirm the ticket submits successfully and the detail page does not show an empty classification value.
9. Submit another ticket with the old system and choose a module option.
10. Confirm the ticket detail page shows `模块` and the selected option name.
11. Select the new system on a new ticket.
12. Confirm the field label changes to `险种`, previous selections clear, and options come from the insurance dictionary.
13. Submit a ticket with a selected insurance option.
14. Rename the system classification label or dictionary item in admin configuration.
15. Reopen the existing ticket and confirm it still shows the originally saved field label and option Chinese name.

## Automated Validation

Run the focused regression suite after implementation:

```bash
node --test "src/utils/__tests__/adminConfigValidation.test.js" "src/server/__tests__/adminConfigStore.test.js" "src/server/__tests__/adminConfigRoutes.test.js" "src/server/__tests__/ticketDraftLifecycle.test.js" "src/utils/__tests__/draftTicketEditing.test.js" "src/views/AdminSystems/__tests__/adminSystemsView.test.js" "src/views/TicketSubmit/__tests__/ticketSubmitClassification.test.js" "src/components/TicketDetail/__tests__/ticketInfoCardRoleVisibility.test.js"
```

## Focused Test Areas

- System config validation accepts complete classification config and rejects partial config.
- Public systems route includes classification metadata for visible systems.
- Dictionary options route returns only enabled options.
- Ticket creation stores classification snapshot only when a value is selected.
- Ticket creation rejects tampered classification identifiers.
- Ticket submit UI clears classification when system changes.
- Ticket detail UI displays saved classification snapshot.

## Constitution-Specific Checks

- Confirm no direct writes to ticket lifecycle status fields were introduced.
- Confirm ticket creation still goes through state machine create events.
- Confirm admin configuration saves preserve `updatedAt` and `updatedBy` audit metadata.
- Confirm relevant route/helper/view tests are added or updated.
