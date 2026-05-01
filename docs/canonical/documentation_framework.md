# Canonical System: Documentation Framework

## Purpose

Rules for `/docs/canonical/*`: authoritative, maintained system docs that let agents understand architecture without full-code rediscovery.

## Scope

- Canonical doc structure, creation, maintenance, and relation to code/contracts/agents
- Non-scope: system-specific architecture, design proposals, low-level implementation details

## Principles

- Canonical docs are source of truth for intended system architecture/behavior; code must conform.
- Code/doc mismatch is drift: stop, report, then fix code or update docs by explicit developer decision.
- Docs must be scoped, explicit, verified where possible, uncertainty-labeled, cheap to trust, and cheap to maintain.

## Document Types

| Type | Path | Role |
|---|---|---|
| Canonical system docs | `/docs/canonical/` | Current boundaries, pipelines, invariants |
| Contracts | `/docs/contracts/` | Intended changes; historical after implementation |
| `AGENTS.md` | `docs/AGENTS.md` | Agent operating rules and pointers, not deep system knowledge |

## Required Shape

Each canonical doc must include `Purpose`, `Scope`, `Non-scope`, `Entrypoints`, `Pipeline`, `Invariants`, `Constraints`, `Dependencies`, `Extension`, `Failure Modes`, `Verification`, and review date.

`Constraints` holds hard architectural rules and non-negotiable invariants. Violations are bugs or drift. Keep constraints explicit and minimal.

## Maintenance

Update the relevant canonical doc whenever a change affects boundaries, entrypoints, pipelines, invariants, constraints, dependencies, or extension points. A system behavior change is incomplete until its canonical doc matches.

When modifying a system:

1. Identify its canonical doc.
2. Update it with the behavior change.
3. If code conflicts with the doc, treat as drift; inspect only local relevant code and do not silently work around it.

## Status Labels

- `Verified`: confirmed against code
- `Inferred`: partially derived; needs validation

Uncertainty must be explicit.

## Selection

Create canonical docs for systems that are frequently changed, high-risk to misunderstand, expensive to rediscover, invariant-heavy, or clearly bounded.

## Authoring

Use code as input; do not rely on existing docs/contracts. Avoid speculation. Prefer clarity over completeness. Once created, the canonical doc becomes authoritative.

## Enforcement

Canonical docs are part of definition of done. Any system-level change requires a matching canonical-doc update. No exceptions.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
