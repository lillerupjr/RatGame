# Renderer Decomposition Contract — RatGame

## Final Pass: Renderer Consolidation (render.ts as Conductor)

### Goal
Reduce `src/game/systems/render.ts` to a top-level frame orchestrator after Phase 1–3 extraction.

This pass removes transitional wrappers, deletes dead code, and centralizes pass-order authority
without changing visual behavior.

---

## Non-Goals
- No visual redesign
- No pass-order changes
- No ordering/comparator changes
- No shadow/relight algorithm changes
- No new helper dump files

---

## Required End-State for render.ts

render.ts should own only:

1. Frame bootstrap
- settings snapshot
- debug flags snapshot
- perf frame begin/end
- camera/viewport bootstrap
- early-outs

2. High-level subsystem calls
- prepare structure triangles
- prepare static relight
- build structure shadow frame result
- collect visible world
- build/sort drawables

3. Top-level pass order (single authority)

4. Final canvas pass coordination (no subsystem internals)

---

## Must Remove from render.ts

- structure triangle internals (types/build/cull/group/debug)
- static relight internals (planner/deps/bake/composer)
- structure shadow routing/version switches/scratch ownership
- trivial forwarding wrappers
- duplicated types now owned by extracted modules
- subsystem-local scratch canvases
- subsystem-local preload/rebuild internals (when extracted equivalents exist)

---

## Transitional Wrappers Rule

Delete wrappers that only forward calls:

BAD:
```
function prepareTriangles(w) {
  return prepareRuntimeStructureTrianglesForLoading(w);
}
```

Prefer direct imports from extracted modules.

Keep wrappers only if they preserve an intentional renderer API (rare).

---

## Locked Module Ownership

- render.ts → orchestration + pass order
- structureTriangles/* → triangle system
- staticRelight/* → relight system
- structureShadows/* → shadow routing/orchestration
- ordering/* → sort keys + comparator + tie-breaks

No ambiguity allowed.

---

## Target Shape (Conceptual)

```
export function render(world, ctx) {
  beginRenderPerfFrame(...);

  const frame = buildRenderFrameContext(world);

  prepareExtractedSubsystems(frame, world);

  const selected = collectFrameSelection(frame, world);
  const geometry = buildFrameGeometry(frame, selected);
  const ordered = sortFrameDrawables(frame, geometry);

  executeGroundPass(ctx, frame, ordered);
  executeWorldPass(ctx, frame, ordered);
  executeLightingPass(ctx, frame, ordered);
  executeShadowPass(ctx, frame, ordered);
  executeOverlayPass(ctx, frame, ordered);
  executeDebugPass(ctx, frame, ordered);

  endRenderPerfFrame(...);
}
```

---

## Migration Steps

1. Ensure Phase 2 and Phase 3 APIs are available
2. Freeze behavior (pass order, ordering, debug, loading)
3. Replace local calls with direct subsystem imports
4. Delete trivial wrappers
5. Delete dead imports/types/globals
6. Re-read render.ts and remove remaining subsystem internals

---

## Review Questions

For each remaining function in render.ts:

- Is this top-level orchestration?
- Is this pass-order authority?

If not → remove or move.

---

## Anti-Drift Rules

- No opportunistic redesign
- No helper dump files
- Do not re-embed subsystem logic into render.ts
- Keep pass order in a single place
- Treat leftover scratch canvases as bugs

---

## Acceptance Criteria

Structural:
- render.ts is primarily orchestration
- triangle, relight, shadow internals removed
- wrappers removed

Behavioral:
- no visual change
- no ordering change
- no cache/loading regressions
- debug behavior unchanged

Code quality:
- no generic helpers file
- clear module ownership
- readable pass order

---

## Deliverable

Return:
1. changed files
2. list of wrappers removed
3. list of any remaining wrappers (and why)
4. confirmation that behavior is unchanged

---

## Principle

From:
"render.ts does everything"

To:
"render.ts orchestrates systems with clear ownership"
