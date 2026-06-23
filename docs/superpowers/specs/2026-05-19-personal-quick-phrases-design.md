# Personal Quick Phrases Design

## Goal

Technical support users maintain their own reusable message phrases and insert them quickly from the ticket message editor with slash completion.

## Design

- L1 and L2 users get a top navigation entry named personal configuration. The first page under it is common phrases.
- Phrases are personal, keyed by the current user. Admins and requesters cannot maintain another user's phrases.
- Phrase data is stored in `app_configs` using a per-user key such as `PERSONAL_QUICK_PHRASES:<userId>`. This follows the existing configuration storage pattern and avoids a schema change.
- Each phrase has `id`, `title`, `content`, `keywords`, `enabled`, `createdAt`, and `updatedAt`.
- `GET /api/personal/quick-phrases` returns the current user's phrases.
- `PUT /api/personal/quick-phrases` validates and saves the current user's phrases.
- The ticket message editor loads enabled phrases for L1/L2 users. Typing `/` opens suggestions, continued input filters by title, keyword, or content, arrow keys move the active item, Enter inserts the phrase content, and Escape closes suggestions.

## Constraints

- No business ticket status changes are introduced.
- Message sending continues through the existing message API.
- The slash suggestion panel is rendered below the editor for predictable layout.

## Testing

- Unit tests cover phrase normalization, validation, filtering, and text insertion helpers.
- Route tests cover role authorization and per-user persistence.
- Source-level view tests cover the personal configuration navigation and page controls.
