# RatGame Final Backend Matrix

## Backend-Default Decision

- Current policy: `Canvas2D` remains the default world backend.
- WebGL status: available as an opt-in world backend when a usable WebGL surface exists.
- Why WebGL is not the default yet:
  - `decal:runtimeSidewalkTop` is still Canvas-only and materially affects decal-heavy ground scenes.
  - `decal:runtimeDecalTop` is still Canvas-only and materially affects road/decal-heavy scenes.

This means Stage E closes the transition policy, but does **not** sign off WebGL as the default backend yet.

## Parity Audit Status

- Acceptable current behavior:
  - CPU-owned pass order, sorting, and frame assembly remain unchanged.
  - Mixed-backend routing is explicit and avoids duplicate rendering.
  - Unsupported/fallback families are debug-visible.
  - WebGL init/runtime failure falls back to Canvas2D explicitly.
- Still pending for full default-backend signoff:
  - live visual/manual parity audit across representative structure-heavy, decal-heavy, and mixed-light scenes
  - runtime top/decal parity for the remaining Canvas-only ground families

## Family Matrix

| Family | Final classification | Current route | Parity status | Fallback acceptable for release/default use? | Notes |
| --- | --- | --- | --- | --- | --- |
| `sprite:imageSprite` | `WEBGL_PRIMARY` | `webgl` | `parity_pending_manual` | `yes` | Resolved image-frame sprites are fully on the textured-quad path. |
| `sprite:renderPieceSprite` | `WEBGL_PRIMARY` | `webgl` | `parity_pending_manual` | `yes` | Quad-safe structure/world sprite pieces are WebGL-native. |
| `decal:imageTop` | `WEBGL_PRIMARY` | `mixed` | `parity_pending_manual` | `yes` | Flat tops render in WebGL; projected/ocean tops still use explicit Canvas fallback. |
| `primitive:zoneEffect` | `WEBGL_SUPPORTED_CANVAS_FALLBACK_ALLOWED` | `mixed` | `parity_pending_manual` | `yes` | Non-`FIRE` effects render in WebGL; `FIRE` remains Canvas-backed. |
| `overlay:structureOverlay` | `WEBGL_PRIMARY` | `webgl` | `parity_pending_manual` | `yes` | Quad-safe structure overlays are WebGL-backed. |
| `overlay:screenTint` | `WEBGL_PRIMARY` | `webgl` | `parity_pending_manual` | `yes` | Screen-space full-quad path. |
| `overlay:ambientDarkness` | `WEBGL_PRIMARY` | `webgl` | `parity_pending_manual` | `yes` | Screen-space darkness/tint overlay path. |
| `light:projectedLight` | `WEBGL_PRIMARY` | `webgl` | `parity_pending_manual` | `yes` | Projected additive light pieces render in WebGL. |
| `triangle:structureTriangleGroup` | `WEBGL_SUPPORTED_CANVAS_FALLBACK_ALLOWED` | `mixed` | `parity_pending_manual` | `yes` | Main structure triangles are WebGL-backed; compare-distance debug overlay remains explicit Canvas fallback. |
| `decal:runtimeSidewalkTop` | `BLOCKED_SIGNOFF` | `canvas2d` | `blocked` | `no` | Runtime top baking/ramp parity still depends on Canvas. |
| `decal:runtimeDecalTop` | `BLOCKED_SIGNOFF` | `canvas2d` | `blocked` | `no` | Runtime decal baking/ramp-fit projection still depends on Canvas. |
| `sprite:vfxClip` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Legacy unresolved clip path remains safe on Canvas. |
| `sprite:pickup` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Still mixes sprite draws with vector fallback and relight overlays. |
| `sprite:enemy` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Legacy animation/relight behavior remains Canvas-backed. |
| `sprite:npc` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Legacy animated NPC path remains Canvas-backed. |
| `sprite:neutralMob` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Legacy neutral-mob path remains Canvas-backed. |
| `sprite:projectileSpark` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Portable image path exists, but the legacy fallback remains Canvas-backed. |
| `sprite:projectile` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Still mixes projectile bodies with follower/effect behavior. |
| `sprite:player` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Player relight/fallback behavior remains Canvas-backed. |
| `primitive:entityShadow` | `DEFER_FUTURE_PROJECT` | `canvas2d` | `fallback_safe` | `yes` | Shadow-heavy migration is a future dedicated project. |
| `primitive:playerBeam` | `DEFER_FUTURE_PROJECT` | `canvas2d` | `fallback_safe` | `yes` | Path-style beam rendering remains intentionally Canvas-backed. |
| `primitive:floatingText` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Canvas text remains the intended implementation. |
| `primitive:playerWedge` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Debug/path wedge rendering does not block release use. |
| `overlay:zoneObjective` | `INTENTIONALLY_CANVAS_ONLY` | `canvas2d` | `fallback_safe` | `yes` | Zone-objective overlay remains Canvas-backed. |
| `debug:debugPass` | `DEFER_FUTURE_PROJECT` | `canvas2d` | `fallback_safe` | `yes` | General debug rendering remains Canvas-backed. |
