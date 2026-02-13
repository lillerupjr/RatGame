Read fully before implementing.
Do not implement until the contract is fully understood.

0. Purpose

Correct runtime structure slice ownership so that:

Placement anchor remains center-of-footprint (visual only).

Slice ownership is derived from footprint shape.

Slice depth keys are computed from tile space only.

Mapping is consistent with agents.md axis identity.

This contract modifies runtime slice ownership only.
It does not modify direction semantics, Z roles, or render pass order.

1. Locked Spatial Assumptions (Must Already Be True)

From agents.md:

+x is east

+y is south

w extends along +x

h extends along +y

Excel +y == Tile +y == South

No axis swaps

No reinterpretation of w/h

If any of the above are not true, stop and update agents.md first.

2. Placement Rule (Unchanged)

Overlay placement anchor:

anchorTx = tx + w * 0.5
anchorTy = ty + h * 0.5


This remains unchanged.

Placement anchor is visual only and does NOT affect slice ownership.

3. Slice Count Contract

For a structure footprint (tx, ty, w, h):

bandCount = w + h


This is mandatory.

Rationale:

East edge contributes h bands.

South edge contributes w bands.

SE corner is intentionally duplicated.

This guarantees corner tile covers both 64px faces.

This must remain true for all rectangular footprints.

4. Slice Ownership Rule (Authoritative)

Ownership is derived from the south outline of the footprint.

For band index i:

if (i < h) {
// East edge: north → south
bandTx = tx + (w - 1)
bandTy = ty + i
} else {
// South edge: east → west (including SE corner again)
j = i - h
bandTx = tx + (w - 1) - j
bandTy = ty + (h - 1)
}


Properties:

First h slices walk down east edge.

Remaining w slices walk west along south edge.

SE tile appears twice (once in each phase).

No tile outside footprint may be referenced.

No axis swaps permitted.

This logic must exist in exactly one shared helper.

5. Render Key Derivation (Locked)

For each slice:

slice  = bandTx + bandTy
within = bandTx


No alternative heuristics are permitted.

Depth is derived purely from tile ownership.

6. Debug Overlay Must Match Sorting

If debug mode prints tile ownership:

It must use the exact same helper.

Debug tile must equal sorting tile.

No separate debug math allowed.

7. Forbidden

Walking east from origin using bandIndex directly.

Using center anchor for sorting.

Swapping w/h.

Swapping x/y.

Mixing screen-space math into ownership logic.

Computing ownership differently in multiple files.

8. Implementation Steps

Create a shared helper:

getStructureBandOwnerTile(tx, ty, w, h, bandIndex)


Use it in runtime slicing when building render keys.

Remove any previous “walk east from origin” logic.

Update debug overlay to call the same helper.

Confirm bandCount = w + h everywhere.

9. Example (3×2 at 0,0)

Expected owner sequence:

0 = (2,0)
1 = (2,1)
2 = (2,1)
3 = (1,1)
4 = (0,1)


If runtime debug does not match this exactly, implementation is incorrect.

10. Achievements

- [x] bandCount = w + h for all structures

- [x] Ownership derives strictly from footprint shape

- [x] No tile outside footprint referenced

- [x] SE corner duplicated exactly once

- [x] Debug ownership equals render ownership

- [x] Ownership logic centralized in one helper

Execution Rule

After implementing:

Mark achievements complete in this contract.

Verify no rule in agents.md is violated.

Summarize newly enforced invariants.

State next step.

Stop and wait for:

next
