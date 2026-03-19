# Renderer Decomposition Contract — RatGame

## Phase 3: Structure Shadow Orchestrator

### Goal
Extract structure shadow pipeline orchestration from `render.ts` into a dedicated subsystem without changing shadow behavior, version routing, pass order, or debug behavior.

This phase is about **centralizing structure-shadow authority**, not redesigning the shadow algorithms.

---

## Problem Statement

`render.ts` currently imports and coordinates multiple structure shadow generations and supporting helpers, including:

- V1 cache/build path
- V2 alpha silhouette path
- Hybrid triangle path
- V4 correspondence path
- V6 face-slice helpers
- mask scratch canvases
- frame-level version switching / routing
- structure shadow debug handling

That means `render.ts` currently owns both:
1. **top-level renderer orchestration**
2. **structure shadow subsystem orchestration**

Those must be separated.

---

## Scope

Phase 3 extracts only **structure shadow orchestration**.

It does **not** require rewriting the underlying V1/V2/Hybrid/V4/V6 algorithms.

It does **not** require merging all shadow versions into one implementation.

It does **not** require changing visual semantics.

---

## Required File Structure

src/game/systems/presentation/structureShadows/
- structureShadowTypes.ts
- structureShadowScratch.ts
- structureShadowVersionRouting.ts
- structureShadowFrameContext.ts
- structureShadowOrchestrator.ts

If the repo already has nearby shadow files under presentation, keep existing version-specific files where they are, but Phase 3 must add a single orchestration family that owns routing and frame-level coordination.

---

## Existing Version Modules That Must Remain Algorithm Owners

Do not rewrite these unless absolutely required for extraction:

- `structureShadowV1`
- `structureShadowV2AlphaSilhouette`
- `structureShadowHybridTriangles`
- `structureShadowV4`
- `structureShadowV6FaceSlices`

These modules remain the owners of their own algorithm details.

Phase 3 only changes **who coordinates them**.

---

## Goal State

After this phase:

- `render.ts` does **not** switch between structure shadow versions directly
- `render.ts` does **not** own structure shadow scratch canvas lifecycle
- `render.ts` does **not** directly coordinate per-version frame routing
- `render.ts` delegates to a single structure-shadow orchestration API

---

## Required Ownership Split

### 1. `structureShadowTypes.ts`
Own only shared types/contracts used by the structure shadow orchestration family.

Examples of contracts this file should own:
- `StructureShadowFrameInputs`
- `StructureShadowFrameResult`
- `StructureShadowVersionId`
- `StructureShadowDebugInputs`
- `StructureShadowScratchBundle`
- `StructureShadowRenderMode` if needed
- shared projected triangle/slice wrapper types used only for orchestration

Rules:
- no canvas allocation
- no version switching logic
- no drawing logic

---

### 2. `structureShadowScratch.ts`
Own only scratch canvas lifecycle for the structure shadow subsystem.

Move structure-shadow-specific scratch ownership out of `render.ts`.

Examples currently visible in renderer that belong here:
- `structureShadowV5TopMaskScratch`
- `structureShadowV5EastWestMaskScratch`
- `structureShadowV5SouthNorthMaskScratch`
- `structureShadowV5CoverageMaskScratch`
- `structureShadowV5FinalMaskScratch`
- `structureShadowV6FaceScratch`

If more structure-shadow-only scratch canvases exist deeper in `render.ts`, move them here too.

Rules:
- scratch ownership only
- no version routing
- no world selection
- no pass ordering
- no shadow algorithm logic

---

### 3. `structureShadowVersionRouting.ts`
Own only version selection and routing policy.

This file answers:
- which structure shadow version is active for this frame
- which algorithm family to call
- what routing mode/settings/debug flags apply
- whether a version needs special scratch/context access

Rules:
- no drawing
- no scratch allocation directly
- no algorithm implementation details
- no duplicated version logic

---

### 4. `structureShadowFrameContext.ts`
Own only frame-derived structure shadow inputs.

This file derives and packages the frame-local inputs required by the orchestrator and underlying version modules.

Examples:
- active sun model / projection direction
- user render settings relevant to structure shadows
- debug flags relevant to structure shadows
- frame-local context keys
- normalized frame routing inputs

Rules:
- pure derivation only
- no canvas work
- no version rendering
- no world traversal beyond input packaging already available at frame level

---

### 5. `structureShadowOrchestrator.ts`
This becomes the single authority for structure shadow coordination.

It must:
- accept frame inputs + relevant visible structure data
- resolve active version routing
- obtain scratch resources from `structureShadowScratch.ts`
- call the appropriate version-specific algorithm
- return a normalized result to `render.ts`

It may also own thin compatibility wrappers if needed during migration.

It must not:
- become a new giant catch-all renderer
- reimplement V1/V2/Hybrid/V4/V6 internals
- take over unrelated lighting/entity shadow logic

---

## Locked Rules

### Rule A — `render.ts` is no longer a structure-shadow router
After Phase 3, `render.ts` may only do something conceptually like:

```ts
const structureShadowResult = buildStructureShadowFrameResult(frame, ...inputs);

It must not contain per-version branching.

Rule B — Underlying version modules remain algorithm owners

Do not migrate all algorithm internals into the orchestrator.

The orchestrator routes and normalizes.
The version modules compute.

Rule C — Scratch canvases belong to shadow subsystem, not renderer root

Any structure-shadow-only scratch canvas still owned by render.ts after this phase is a contract failure.

Rule D — No visual redesign

Do not:

change alpha targets

change shadow projection semantics

change slice count behavior

change top-vs-side eligibility

change debug overlay semantics

change pass order

Only move orchestration authority.

Rule E — Version routing must become explicit

There must be a single obvious place in code where a reader can answer:

“Which structure shadow version is active, and why?”

That place must be structureShadowVersionRouting.ts and/or the orchestrator, not scattered through render.ts.

Required Migration Targets from render.ts

Move structure-shadow orchestration concerns out of render.ts, including as applicable:

structure shadow version selection branches

frame-level version dispatch

shadow context-key packaging specific to structure shadows

structure-shadow scratch canvas ownership

thin version-specific routing glue

orchestration-only compatibility transforms between renderer data and version module inputs

Do not move unrelated entity shadow logic unless it is incorrectly mixed into structure-shadow-only routing glue.

Entity shadows and structure shadows are separate concerns.

Recommended Internal APIs

These are recommended shapes; exact names may vary if existing repo patterns prefer a nearby naming style.

Frame context
export type StructureShadowFrameInputs = {
  // frame-local settings, sun model, debug flags, context keys, etc.
};
Routing
export function resolveStructureShadowVersion(
  frame: StructureShadowFrameInputs
): StructureShadowVersionId;
Scratch
export function getStructureShadowScratchBundle(
  width: number,
  height: number
): StructureShadowScratchBundle | null;
Orchestration
export function buildStructureShadowFrameResult(
  frame: StructureShadowFrameInputs,
  inputs: {
    // visible overlays / structures / required geometry inputs
  }
): StructureShadowFrameResult;
Acceptance Criteria
Structural acceptance

render.ts no longer owns structure-shadow version switching

render.ts no longer owns structure-shadow scratch canvases

structure-shadow routing exists in a dedicated subsystem

underlying version modules remain intact and callable

Behavioral acceptance

V1 path still behaves the same

V2 alpha silhouette path still behaves the same

hybrid path still behaves the same

V4 path still behaves the same

V6 face-slice path still behaves the same

current debug behavior remains intact

pass order remains unchanged

Code quality acceptance

no new generic helper dump file

no duplication of version logic

no canvas scratch ownership left in render.ts for structure shadows

no algorithm rewrite disguised as extraction

Anti-Drift Rules
Do not

merge all versions into one mega-file

move shadow math into random helpers

duplicate routing checks in multiple files

silently change version eligibility conditions

opportunistically redesign shadow semantics during extraction

Do

preserve version-specific modules

move only routing/coordination/scratch ownership

keep the orchestrator narrow and explicit

preserve existing behavior first

Verification Checklist

After implementation, verify:

each existing structure shadow mode still renders

switching versions/settings still selects the same implementation as before

scratch canvases are no longer declared in render.ts

debug shadow views still work

frame-to-frame cache behavior still works

no visible regressions in top-face and side-face shadow behavior

Deliverable

Return:

changed files

a short note describing:

which routing branches were removed from render.ts

which scratch canvases moved out

whether any temporary compatibility wrappers remain

Principle

Structure shadows are a renderer subsystem.

render.ts should use that subsystem, not be that subsystem.