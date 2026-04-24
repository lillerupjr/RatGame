# Canonical System: Documentation Framework

## Purpose

Define the structure, purpose, and maintenance rules for all canonical system documents.

Ensure documentation is:

- Authoritative for system understanding
- Accurate and maintained
- Reliable for agent use without deep code exploration

## Scope

This document governs:

- Canonical system documents (`/docs/canonical/*`)
- Their structure and required content
- How they are created and maintained
- Their relationship to code, contracts, and agents

## Non-scope

- System-specific architecture, covered in each canonical doc
- Design proposals, handled by contracts
- Low-level implementation details

## Core Principles

- Canonical docs are the primary source of truth for system architecture and intended behavior.
- Code must conform to canonical docs.
- Any mismatch between code and a canonical doc is drift and must be resolved.
- Docs define intended and validated system behavior.
- Agents should not need to explore the full codebase to understand a system.
- Docs must be cheap to trust and cheap to maintain.
- Keep docs scoped, explicit, and system-bound.
- Prefer verified facts and label uncertainty explicitly.

## Design Constraints

Each canonical system document must include a `Design Constraints` section.

This section defines:

- Hard architectural rules
- Non-negotiable invariants
- System-level constraints that must always hold

Rules:

- These constraints override implementation details.
- Violations are considered bugs or drift.
- Constraints must be explicit and minimal.

## Document Types

### 1. Canonical System Documents

Describe how a system works.

Define:

- Boundaries
- Pipelines
- Invariants

Stored in:

`/docs/canonical/`

### 2. Contracts

Describe intended changes.

Capture:

- Decisions
- Scope
- Implementation intent

Contracts become historical records after implementation. They are not a source of current truth.

### 3. `AGENTS.md`

- Defines how agents operate in the repo
- Points to canonical docs
- Does not contain deep system knowledge

## Required Structure (Canonical Docs)

Each canonical doc must include:

- Purpose
- Scope
- Non-scope
- Key entrypoints
- Data flow / pipeline
- Core invariants
- Design constraints
- Dependencies (in/out)
- Extension points
- Failure modes / common mistakes
- Verification status (`Verified` / `Inferred`)
- Last reviewed

## Maintenance Rules

Canonical docs must be updated when changes affect:

- System boundaries
- Entry points
- Data flow / pipelines
- Invariants
- Design constraints
- Dependencies
- Extension points

## Update Responsibility

When modifying a system:

1. Identify its canonical doc.
2. Update the doc to reflect the change.

A change is not complete if:

- System behavior changed
- And the canonical doc was not updated

## Drift Handling

Canonical docs are the primary source of truth for system architecture and intended behavior.

Agents should:

- Use canonical docs to understand systems
- Avoid full-system code exploration during normal work
- Inspect only local code relevant to the change

If local code conflicts with the canonical doc:

- Treat this as drift
- Stop and report the inconsistency
- Do not default to trusting code over the doc

The developer must decide whether to:

- Fix the code (`bug` / drift), or
- Update the canonical doc (`intent changed`)

Drift must never be ignored or silently worked around.

## Verification Status

Each canonical doc must declare:

- `Verified` — confirmed against code
- `Inferred` — partially derived, needs validation

Uncertainty must be explicit.

## System Selection Criteria

A system qualifies for canonical documentation if it is:

- Frequently needed for changes
- High risk if misunderstood
- Expensive to rediscover
- Holding important invariants
- Possessing a clear boundary

## Authoring Rules

When creating canonical docs:

- Use code as input during initial authoring
- Do not rely on existing docs/contracts
- Avoid speculation
- Keep structure tight and explicit
- Prefer clarity over completeness
- The final canonical doc becomes authoritative for system architecture and intended behavior
- Future system changes must update the canonical doc

## Relationship to Contracts

After implementation:

- If system behavior changed, the canonical doc must be updated.
- Contracts remain:
  - Historical intent
  - Not authoritative truth

## Enforcement Model

- Canonical docs are part of the definition of done.
- Any system-level change requires updating the canonical doc.

No exceptions.

## Goal

Enable agents to:

- Understand systems without deep repo exploration
- Make changes safely and consistently
- Avoid rediscovering architecture
- Detect and surface drift immediately
