# Dynamic + Static Atlas Contract

## Status

Implemented.

This document is the current atlas contract for the live renderer after:

- chunk-raster ground
- Static Atlas + Dynamic Atlas migration
- experimental Shared World Atlas mode
- backend-aware atlas mode defaults

It replaces the old staged migration prompt. This file now documents the
current texture model instead of future phases.

## Current Renderer Texture Model

The renderer now has three atlas-related texture domains plus one
separate ground cache domain:

- `StaticAtlasStore`
- `DynamicAtlasStore`
- `SharedWorldAtlasStore` (experimental combined mode)
- chunk-raster ground surfaces in `CanvasGroundChunkCacheStore`

Important separation:

- chunk-raster ground is not part of any atlas page family
- UI, debug canvases, screen render targets, and other transient canvases
  are not part of any world atlas family

## Atlas Mode

`settings.system.worldAtlasMode` is now:

- `auto`
- `shared`
- `dual`

The renderer resolves the effective mode in exactly one place via
`resolveEffectiveWorldAtlasMode(...)`.

Resolution rules:

- requested `shared` -> effective `shared`
- requested `dual` -> effective `dual`
- requested `auto`:
  - WebGL -> `shared`
  - Canvas2D -> `dual`

Debug tools expose:

- requested mode as the editable override
- effective mode as read-only resolved state

Both `shared` and `dual` can still be forced on both backends for A/B
testing.

## Store Ownership And Lifecycle

### `StaticAtlasStore`

Purpose:

- atlas static non-ground reusable content

Context key:

- `map:${compiledMap.id}||palv:${paletteVariantKey}||sprites:${0|1}||decals:${0|1}`

Included in normal dual mode:

- structure sprites
- prop sprites
- face-piece sprites
- occluder wall sprites
- projected decal variants derived from `compiledMap.decals`

Included in shared mode:

- projected decals only

Excluded:

- chunk-raster ground surfaces
- dynamic families
- UI/debug/transient canvases

Rebuild triggers:

- map change
- palette variant change
- pending sprite/decal source becomes ready/failed/unsupported

Fallback rule:

- if atlas frame exists, use it
- otherwise use the direct source image/canvas

### `DynamicAtlasStore`

Purpose:

- atlas dynamic world sprite families when dual mode is active

Context key:

- `palv:${paletteVariantKey}`

Included families:

- drops / pickups / currency
- projectiles
- VFX
- vendor NPCs
- neutral mobs
- player
- enemies

Source kinds:

- `directFrame`
- `spritePackFrame`

Rebuild triggers:

- palette variant change
- dynamic source readiness/fallback set changes

Fallback rule:

- if atlas frame exists, use it
- otherwise use the direct source image

### `SharedWorldAtlasStore`

Purpose:

- experimental mode that packs formerly-static world sprite families and
  formerly-dynamic world sprite families into one shared page family to
  reduce cross-atlas texture breaks

Context key:

- `map:${compiledMap.id}||palv:${paletteVariantKey}`

Included families:

- structure sprites
- prop sprites
- face-piece sprites
- occluder wall sprites
- drops / pickups / currency
- projectiles
- VFX
- vendor NPCs
- neutral mobs
- player
- enemies

Excluded:

- projected decals
- chunk-raster ground
- UI/debug/transient canvases

Rebuild triggers:

- map change
- palette variant change
- static or dynamic source readiness/fallback set changes

Fallback rule:

- if shared atlas frame exists, use it
- otherwise use the direct source image

## Source Collection Rules

### Static structure inventory

Static structure sprite inventory is collected from the same world data
used by live structure rendering:

- overlays
- face pieces
- occluder walls

This explicitly includes map-authored props and light-post style prop
sprites because they are part of the overlay/structure world data.

### Dynamic inventory

Dynamic atlas sources are collected from the live dynamic family
registries and sprite-pack frame inventories:

- currency visuals
- projectile sprites
- VFX sprite ids
- vendor NPC sprites
- neutral mob sprites
- player sprite-pack ids
- enemy sprite-pack ids

## Runtime Resolution Rules

The renderer resolves the effective atlas mode once per frame, before
collection, and all collection code consumes only that resolved mode.

Live lookup rules:

- static structure sprite lookups:
  - `shared` mode -> `SharedWorldAtlasStore`
  - `dual` mode -> `StaticAtlasStore`
- projected decal lookups:
  - always `StaticAtlasStore`
- dynamic image lookups:
  - `shared` mode -> `SharedWorldAtlasStore`
  - `dual` mode -> `DynamicAtlasStore`

This means:

- in dual mode, static and dynamic world sprites use separate atlas page
  families
- in shared mode, structure/prop/face/occluder sprites and dynamic
  sprite families resolve to the same renderer-visible atlas page family
- projected decals remain on the static atlas in both modes

## Ground Separation

Ground is still a separate optimization domain.

Eligible static ground surfaces and decals are:

- grouped per logical chunk
- rasterized into one surface per `(chunkX, chunkY, zBand)`
- emitted as one final cached world quad per chunk surface

Ground chunk raster surfaces:

- are stable texture sources
- are not packed into static, dynamic, or shared world atlas pages
- remain outside the world atlas experiment on purpose

## Perf And Debug Instrumentation

The live perf/debug overlay now reports:

- `atlas(static): req/hit/miss/bypass/fb/tex`
- `atlas(dynamic): req/hit/miss/bypass/fb/tex`
- unique textures
- texture binds
- texture uploads
- `texture_changed` break count
- top 3 grouped texture-break causes

The clipboard perf snapshot uses the same underlying overlay text.

Instrumentation is logical, not store-name-only:

- static callers still increment static atlas request/hit/miss counters
- dynamic callers still increment dynamic atlas request/hit/miss counters
- shared mode changes the physical page family, not the logical caller
  family labels

## Current Limitations

- chunk-raster ground is intentionally separate from atlas work
- projected decals are intentionally not part of the shared world atlas
- non-world and transient textures remain outside atlas scope
- shared world atlas mode is still experimental and should be validated
  with live texture-break metrics before becoming a permanent default

## Current Source Of Truth

For atlas ownership and routing:

- `src/game/systems/presentation/render.ts`
- `src/game/systems/presentation/staticAtlasStore.ts`
- `src/game/systems/presentation/dynamicAtlasStore.ts`
- `src/game/systems/presentation/sharedWorldAtlasStore.ts`
- `src/settings/systemOverrides.ts`

For quad/rect renderer shape:

- `docs/contracts/active/rendering/pure_quad_rect_render.md`
