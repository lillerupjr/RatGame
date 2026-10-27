# Docs Structure

This folder is intentionally strict. If a document does not describe the current repo truth, it does not belong in `docs/`.

## Top-level folders

- `systems/` Canonical architecture references that must stay maintained and are safe to reference from agent instructions.
- `contracts/implemented/` Implemented contracts that match the current repo behavior.
- `contracts/draft/` Proposed, exploratory, or not-yet-authoritative contracts.
- `integrations/` Live external setup and integration notes.
- `design/` Product and content design material.

## Rules

- Prefer one current canonical document over many phase or handoff notes.
- Move stale or superseded proposals out of `active/` immediately.
- Delete temporary handoff files instead of keeping them as hidden source-of-truth competitors.
- Reference files in `systems/` from agent guidance, not drafts.

## Current Canonical Progression Docs

- `canonical/ring_progression_system.md` — source of truth for ring/hand progression backend, effects pipeline, and hands screen UI
- `contracts/implemented/ring_v1_backend_contract.md` — historical V1 backend contract (decisions and locked rules)
- `contracts/implemented/ring_v1_content_catalog.md` — historical V1 ring content catalog (shipped ring list and provenance)

## Current Content

- `design/active_content.md` — which game modes, act map nodes, objectives, maps, bosses and characters are active in a player-facing run
