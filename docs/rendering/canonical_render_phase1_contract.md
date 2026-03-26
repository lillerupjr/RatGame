# Canonical Render Phase 1 Contract

## Status

Phase 1 is implemented as a semantic contract rewrite of the render command layer.

Active handoff:

- Phase 2 progress now lives in `docs/rendering/canonical_render_phase2_contract.md`
- This Phase 1 file remains the historical semantic-enforcement checkpoint

Current guarantees:

- Every emitted render command declares `semanticFamily`
- Every emitted render command declares `finalForm`
- Emitted commands use `payload` instead of legacy `data.variant`
- Backend routing keys off canonical axes, not legacy family strings
- Mixed structure families are split before command emission

Phase 1 intentionally did not finish full Phase 2 payload normalization.

## Canonical Axes

- `semanticFamily`: `groundSurface | groundDecal | worldSprite | worldGeometry | worldPrimitive | screenOverlay | debug`
- `finalForm`: `quad | projectedSurface | triangles | primitive`
- `pass`: `GROUND | WORLD | SCREEN`

`pass` remains an execution-order concern. It is not a semantic-family substitute.

## Locked Phase 1 Mapping

| Canonical family | Final form | Current emitters in Phase 1 |
| --- | --- | --- |
| `groundSurface` | `projectedSurface` | ground image tops, runtime sidewalk tops, apron render pieces |
| `groundDecal` | `projectedSurface` | runtime decal tops |
| `worldSprite` | `quad` | image sprites, pickup/enemy/npc/neutral/projectile/player fallbacks, VFX clips, prop overlays |
| `worldGeometry` | `triangles` | structure triangle groups, walls, roof/structure overlays |
| `worldPrimitive` | `primitive` | entity shadows, zone effects, player beams, projected lights, zone objectives |
| `screenOverlay` | `quad` or `primitive` | screen tint, ambient darkness, floating text |
| `debug` | `primitive` | debug passes, sweep shadow map, player wedge |

## Mandatory Splits Completed

### `renderPieceSprite`

Split before command emission:

- `FLOOR_APRON` -> `groundSurface / projectedSurface`
- `STAIR_APRON` -> `groundSurface / projectedSurface`
- `WALL` -> `worldGeometry / triangles`

Legacy command naming no longer survives in the emitted command layer.

### `structureOverlay`

Split before command emission:

- roof and structure overlays -> `worldGeometry / triangles`
- props -> `worldSprite / quad`

Props no longer opt into runtime structure slicing. `overlay.kind === "PROP"` now stays on the sprite path.

### `zoneObjective`

Reclassified to:

- `worldPrimitive / primitive`

It is no longer emitted as a separate overlay-style family.

## Implemented Contract Changes

### Render command contract

Implemented in `src/game/systems/presentation/contracts/renderCommands.ts`:

- removed legacy `CommandKind`
- removed command `data.variant`
- added discriminated canonical `RenderCommand` union
- added axis helpers based on `semanticFamily + finalForm`

### Emitters

Updated collectors and assembly to emit canonical commands:

- ground collectors
- entity/effect collectors
- structure collectors
- screen overlay assembly
- world-band debug assembly

### Backend routing

Updated backend classification and routing to use canonical axes:

- capability matrix
- deferred family matrix
- final backend matrix
- backend stats
- backend routing
- execution-plan stage lookup

### Backend consumers

Canvas2D and WebGL now dispatch from canonical axes plus explicit payload shape instead of legacy `kind:variant` names.

## Remaining Phase 2 Debt

These were intentionally not complete in Phase 1 and are now tracked in the Phase 2 contract:

- `groundSurface` is not yet enforced as explicit projected-surface geometry in every payload
- `groundDecal` still includes descriptor-style projected payloads in some paths
- `worldGeometry` still accepts `draw` payloads for some structure paths instead of fully normalized triangle arrays
- sprite fallback families are semantically canonical but not fully normalized to one final quad payload shape
- primitive families remain payload-explicit but not fully standardized across all primitive subtypes

## Removed Legacy Command Groupings

The emitted command layer no longer uses these legacy render-command families:

- `decal:*`
- `sprite:*`
- `overlay:*`
- `triangle:*`
- `light:*`
- `debug:*` as variant buckets

Legacy naming may still exist in upstream asset/runtime helper code, but not as the render command contract.

## Acceptance Checklist

- [x] Every emitted render command declares `semanticFamily`
- [x] Every emitted render command declares `finalForm`
- [x] Legacy `kind + data.variant` command contract removed
- [x] Mixed structure emission split before command creation
- [x] Props no longer enter runtime structure slicing
- [x] Backend routing/capability stats use canonical axes
- [x] Canvas2D and WebGL consume the canonical command structure
- [x] Presentation execution ordering remains pass-based
- [ ] `groundSurface` always carries fully normalized projected-surface payloads
- [ ] `worldGeometry` always carries fully normalized triangle payloads
- [ ] Backend performs zero shape construction for all families

## Verification Notes

Verified in this implementation pass with:

- `npm run typecheck`
- targeted presentation tests:
  - `src/tests/game/systems/presentation/renderExecutionPlan.test.ts`
  - `src/tests/game/systems/presentation/renderBackendRouting.test.ts`
  - `src/tests/game/systems/presentation/WebGLRenderer.test.ts`

## Phase 2 Entry Order

Recommended next normalization order:

1. `groundSurface / projectedSurface`
2. `groundDecal / projectedSurface`
3. `worldGeometry / triangles`
4. `worldSprite / quad`
5. `worldPrimitive / primitive`
6. `screenOverlay / primitive`
7. `debug`
