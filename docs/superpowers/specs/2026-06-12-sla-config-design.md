# SLA Config Design

## Goal

Add an administrator-only SLA configuration module and make enabled rules apply to newly submitted tickets through the ticket state machine.

## Scope

- Configure SLA rules for four ticket channels: production data extract, production data fix, account/permission application, and consultation.
- Configure P0, P1, P2, and P3 per channel.
- Configure response, first-handle, and resolution durations.
- Configure multi-level warnings and timeout escalation rules.
- Enable or disable each channel-priority rule.
- Apply enabled rules to new ticket submission and persist a snapshot on the ticket. Existing tickets keep their original snapshot and deadlines.

## Compatibility

Ticket priorities and SLA priorities use the same business values: P0, P1, P2, and P3. The matching layer no longer maps between two priority scales. Existing historical tickets with legacy P4 values are treated as P3 for deadline fallback and display.

## Data Model

SLA config is stored in `app_configs` under `SLA_CONFIG`. Each rule is keyed by channel and SLA priority:

```json
{
  "rules": {
    "DATA_EXTRACT": {
      "P0": {
        "enabled": true,
        "responseMinutes": 30,
        "firstHandleMinutes": 60,
        "resolveMinutes": 240,
        "warnings": [
          {
            "id": "warn_response_60",
            "node": "response",
            "beforeMinutes": 60,
            "targets": ["ASSIGNEE", "GROUP_LEADER"],
            "channels": ["DINGTALK"],
            "frequencyMinutes": 30
          }
        ],
        "escalations": [
          {
            "id": "esc_60",
            "afterMinutes": 60,
            "target": "GROUP_LEADER",
            "useOrgHierarchy": true
          }
        ]
      }
    }
  }
}
```

## Ticket Snapshot

When a ticket is submitted, the state machine resolves the configured rule and stores:

- `slaRuleSnapshot`
- `slaDeadlines.responseDueAt`
- `slaDeadlines.firstHandleDueAt`
- `slaDeadlines.resolveDueAt`
- `expiresAt`, kept compatible with existing ticket list behavior, set to `resolveDueAt` when a configured rule exists.

If no enabled configured rule exists, existing priority-based fallback continues.

## UI

Add `SLA 配置` under admin management. The page uses channel tabs and a compact table for P0-P3. Each row has enabled switch, three duration inputs, warning JSON-like editable list, and escalation JSON-like editable list. This is intentionally dense and operational rather than marketing-style.

## Testing

- Utility tests for normalization, validation, default config, priority mapping, and deadline calculation.
- Store/route tests for admin-only load and save.
- State-machine tests for snapshot and fallback behavior.
- Static view tests for route protection, menu entry, and required page controls.
