Perfect. Here is your agent-ready contract assignment, written in your usual strict, invariant-driven style.

You can drop this directly into your repo as:

docs/contracts/structure-footprint-anchor-ownership.md

CONTRACT: Structure Footprint → Anchor → Slice Ownership (Flipped-Safe)
Purpose

Unify structure placement logic so that:

Flipped structures render correctly.

Slice ownership is identical in preview and runtime.

No dynamic conversion tables exist.

No anchor-based sorting exists.

Ownership depends ONLY on (baseTx, baseTy, wTiles, hTiles).

This fixes the runtime issue where floor tiles south overlap flipped containers.

1️⃣ Core Rule

Sorting and slice ownership must be derived only from tile footprint.

Never from:

Sprite pixel anchor

Sprite dimensions

anchorLiftUnits

roofLiftPx

sliceOffsetPx

flipX

Any screen-space conversion

If sorting depends on anything other than tile footprint, this contract is violated.

2️⃣ Canonical Placement Model

All structures must follow this canonical flow:

Unflipped footprint (w,h)
↓
Orient footprint (swap w/h if flipped)
↓
Convert anchor → canonical base tile (TOP_LEFT)
↓
Compute band ownership from base + oriented footprint
↓
Build render pieces (one per band)

3️⃣ Required Implementation
3.1 Oriented Footprint
function orientFootprint(w: number, h: number, flipped: boolean) {
return flipped ? { w: h, h: w } : { w, h };
}


Only w/h swap is allowed.

No coordinate transforms.
No tile shifts.

3.2 Canonical Base Tile

We standardize:

baseTx/baseTy = TOP_LEFT (NW) of oriented footprint


All anchor kinds must convert into this base tile.

function anchorToBaseTile(
anchorTx: number,
anchorTy: number,
orientedW: number,
orientedH: number,
anchorKind: AnchorKind
): { baseTx: number; baseTy: number }


Must support:

TOP_LEFT

TOP_RIGHT

BOTTOM_LEFT

BOTTOM_RIGHT

CENTER (optional)

The conversion must use the ORIENTED w/h.

3.3 Stable Corners

Derived only from base + oriented footprint:

NW = (baseTx, baseTy)
NE = (baseTx + w - 1, baseTy)
SW = (baseTx, baseTy + h - 1)
SE = (baseTx + w - 1, baseTy + h - 1)


No special casing for flipped.

3.4 Band Ownership Rule (Critical)

For footprint w × h:

bandCount = w + h


Band owner tiles must be:

Walk SOUTH edge west→east

Then walk EAST edge south→north

Implementation:

function ownerTileForBand(
baseTx: number,
baseTy: number,
w: number,
h: number,
bandIndex: number
): { tx: number; ty: number } {
if (bandIndex < w) {
return {
tx: baseTx + bandIndex,
ty: baseTy + (h - 1),
};
}

const j = bandIndex - w;

return {
tx: baseTx + (w - 1),
ty: baseTy + (h - 1) - j,
};
}


This rule must be used:

In preview

In runtime

In structure renderer

Everywhere

No duplicates allowed.

4️⃣ Slice Keys

Sorting keys must be:

slice = tx + ty
withinSlice = tx


Must never use:

anchorTx

anchorTy

sprite anchor

screen position

center tile

5️⃣ Render Piece Construction

Each band produces exactly one render piece.

Owner tile from ownerTileForBand

Slice = tx + ty

Within = tx

flipX is drawing-only

Pixel offsets are drawing-only

Sorting never depends on sprite pixel offsets

6️⃣ Explicitly Forbidden

The following are forbidden:

❌ Using anchor tile for sorting
❌ Using SE corner as base
❌ Using center tile as owner
❌ Dynamic conversion tables for flipped
❌ Different ownership logic in preview vs runtime
❌ Any conditional logic like if (flipped) shift tile

Flipped must only affect:

w/h orientation

flipX drawing flag

Nothing else.

7️⃣ Required Refactor Steps

Agent must:

Create shared helper:

orientFootprint

anchorToBaseTile

ownerTileForBand

Remove any duplicated band math.

Replace all structure slice ownership logic with these helpers.

Verify preview and runtime both call same helpers.

Remove any flip-specific tile shifting code.

8️⃣ Validation Scenarios

Agent must test:

Case A: 3×2 unflipped container

Expected bands: 5
South edge: 3 tiles
East edge: 2 tiles

Case B: 3×2 flipped → 2×3

Expected bands: 5
South edge: 2 tiles
East edge: 3 tiles

Floor tiles south must never render above container.

9️⃣ Success Criteria

✅ Preview and runtime identical
✅ No floor-overlap south bug
✅ Flipped and unflipped identical logic
✅ No hack offsets
✅ No dynamic conversion tables
✅ All slice ownership derived only from footprint

10️⃣ Final Rule

Tile ownership is geometry.

Sprite anchors are visuals.

These systems must never leak into each other.