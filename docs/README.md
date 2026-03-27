# Docs Structure

This folder is intentionally strict. If a document does not describe the current repo truth, it does not belong in `docs/`.

## Top-level folders

- `systems/` Canonical architecture references that must stay maintained and are safe to reference from agent instructions.
- `contracts/active/` Implemented contracts that match the current repo behavior.
- `contracts/draft/` Proposed, exploratory, or not-yet-authoritative contracts.
- `integrations/` Live external setup and integration notes.
- `design/` Product and content design material.

## Rules

- Prefer one current canonical document over many phase or handoff notes.
- Move stale or superseded proposals out of `active/` immediately.
- Delete temporary handoff files instead of keeping them as hidden source-of-truth competitors.
- Reference files in `systems/` from agent guidance, not drafts.
