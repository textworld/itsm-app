# Contracts: 工单字典字段配置

## GET /api/systems

Returns requester-visible systems and each system's optional ticket classification configuration.

### Response 200

```json
{
  "ok": true,
  "systems": [
    {
      "id": "sys_mes_portal",
      "code": "MES_PORTAL",
      "value": "MES_PORTAL",
      "name": "MES 制造执行平台",
      "label": "MES 制造执行平台",
      "category": "NEW",
      "visibleInSubmit": true,
      "ticketClassification": {
        "fieldLabel": "险种",
        "dictionaryType": "INSURANCE_TYPE",
        "dictionaryName": "险种词典"
      }
    }
  ]
}
```

### Rules

- Hidden systems are excluded.
- `ticketClassification` is omitted or null when the system has no configured field label or dictionary.
- The route requires a logged-in user.

## GET /api/dictionaries/options?type={dictionaryType}

Returns enabled options for a dictionary type so the submit page can render system-specific classification options.

### Response 200

```json
{
  "ok": true,
  "dictionary": {
    "type": "INSURANCE_TYPE",
    "name": "险种词典"
  },
  "options": [
    {
      "id": "ins_medical",
      "code": "MEDICAL",
      "name": "医疗险",
      "label": "医疗险",
      "value": "ins_medical"
    }
  ]
}
```

### Response 400

```json
{
  "ok": false,
  "reason": "字典类型不能为空"
}
```

### Rules

- Only enabled dictionary items are returned.
- The route requires a logged-in user.
- Unknown dictionary types return an empty `options` list with `ok: true` when the type is syntactically valid but has no enabled options.

## GET /api/admin/systems

Returns full system configuration for administrators, including ticket classification settings.

### Response 200

```json
{
  "ok": true,
  "config": {
    "systems": [
      {
        "id": "sys_erp_core",
        "code": "ERP_CORE",
        "name": "ERP 核心系统",
        "category": "OLD",
        "visibleInSubmit": true,
        "ticketClassification": {
          "fieldLabel": "模块",
          "dictionaryType": "SYSTEM_MODULE"
        }
      }
    ],
    "updatedAt": "2026-05-21T00:00:00.000Z",
    "updatedBy": { "id": "u_admin_1", "name": "管理员" }
  },
  "dictionaryTypes": [
    { "type": "INSURANCE_TYPE", "name": "险种词典" },
    { "type": "SYSTEM_MODULE", "name": "模块词典" }
  ]
}
```

### Rules

- Requires administrator role.
- `dictionaryTypes` lists dictionary groups available for system classification configuration.

## PUT /api/admin/systems

Saves system configuration including the optional ticket classification field.

### Request

```json
{
  "systems": [
    {
      "id": "sys_erp_core",
      "code": "ERP_CORE",
      "name": "ERP 核心系统",
      "category": "OLD",
      "visibleInSubmit": true,
      "ticketClassification": {
        "fieldLabel": "模块",
        "dictionaryType": "SYSTEM_MODULE"
      }
    }
  ]
}
```

### Response 200

```json
{
  "ok": true,
  "config": {
    "systems": []
  }
}
```

### Response 400

```json
{
  "ok": false,
  "reason": "系统配置校验失败",
  "errors": [
    { "path": ["systems", 0, "ticketClassification", "fieldLabel"], "message": "请输入分类字段名称" }
  ]
}
```

### Rules

- Requires administrator role.
- If one of `fieldLabel` or `dictionaryType` is provided, both must be valid.
- The saved config records `updatedAt` and `updatedBy`.

## POST /api/tickets

Accepts an optional ticket classification snapshot when creating or submitting a ticket.

### Request Fragment

```json
{
  "ticket": {
    "systemCode": "ERP_CORE",
    "systemName": "ERP 核心系统",
    "ticketClassification": {
      "fieldLabel": "模块",
      "dictionaryType": "SYSTEM_MODULE",
      "dictionaryName": "模块词典",
      "optionId": "module_policy",
      "optionCode": "POLICY",
      "optionName": "保单模块"
    }
  },
  "event": "SUBMIT"
}
```

### Rules

- `ticketClassification` is optional.
- When omitted, no blank classification is stored.
- When present, the server validates that the selected system is configured for the submitted dictionary type and that the selected option is enabled at submission time.
- The response returns the persisted ticket including the snapshot.

## Ticket Detail Display Contract

Ticket detail pages display `ticket.ticketClassification` only when present.

### Display Rules

- Label uses `ticket.ticketClassification.fieldLabel`.
- Value uses `ticket.ticketClassification.optionName`.
- Display does not re-resolve historical labels from current system or dictionary configuration.
