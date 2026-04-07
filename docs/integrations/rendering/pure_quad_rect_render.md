# Quad/Rect Renderer Contract

## Status

Implemented.

This is the current render-shape contract for the live renderer.

The important invariant is:

> renderer-facing presentation is quad/rect-only

CPU-side systems may still use richer structure semantics internally,
but live Canvas2D and WebGL submission goes through prepared quad/rect
pieces only.

## Core Rules

### 1. CPU decides the visible render world

The CPU-side creator/collector path is responsible for:

- visibility
- ownership
- admission
- sort metadata
- atlas/image choice
- source rect / UV metadata
- final quad geometry

Consumers do not derive these at draw time.

### 2. Live rendering uses prepared pieces only

The live renderer submits:

- static/world-aligned quads
- dynamic/upright rect quads

The renderer does not submit triangle meshes or projected-surface
payloads as a live backend contract anymore.

### 3. Consumers are dumb

Canvas2D and WebGL consumers only:

- accept prepared pieces
- batch compatible pieces
- submit them

They do not:

- reinterpret structure semantics
- decide atlas policy
- rebuild projected geometry
- perform fallback architecture

## Ground Contract

Ground is now split into two live behaviors:

### Chunk-rasterized ground

Eligible static ground content is:

- grouped into logical `8x8` chunks
- partitioned by `zBand`
- rasterized into one surface per `(chunkX, chunkY, zBand)`
- emitted as one cached static world quad per raster surface

Included in chunk rasterization:

- eligible static ground surfaces
- eligible static ground decals

Excluded:

- non-authoritative ground content
- pending/animated ground content

Chunk-raster ground stays separate from atlas work.

### Direct ground fallback

Ground that is not chunk-authoritative still emits direct prepared quads
through the normal ground path.

## Structure And Static World Contract

Structures, props, face pieces, and occluder walls render as prepared
quads using:

- direct source images, or
- atlas-backed source rects

Current atlas choices are documented in:

- `docs/contracts/active/rendering/dynamic_and_static_atlas.md`

The renderer does not submit structure triangles as a live draw payload.

## Dynamic World Contract

Dynamic families render as prepared rect quads:

- player
- enemies
- NPCs
- drops
- projectiles
- VFX

These pieces may be direct-image backed or atlas-backed, but the
consumer contract is the same either way.

## Texture Selection Contract

Texture/atlas choice is resolved before submission.

That includes:

- static atlas routing
- dynamic atlas routing
- shared world atlas routing when enabled
- direct-image fallback

Backends receive only the chosen `image` plus source rect / destination
geometry.

## Success Criteria

- no live backend depends on triangle submission
- ground chunk rasterization collapses static ground presentation
- atlas choice is resolved on the CPU side
- Canvas2D and WebGL consume the same prepared piece types
- batching is driven by prepared piece state, not semantic reinterpretation

## Current Source Of Truth

- `src/engine/render/creator/renderPieceTypes.ts`
- `src/engine/render/creator/renderWorldCreator.ts`
- `src/engine/render/consumers/renderWorldConsumers.ts`
- `src/game/systems/presentation/canvasGroundChunkCache.ts`
- `src/game/systems/presentation/render.ts`
