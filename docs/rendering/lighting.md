# Lighting Contract (World-Space Lights)

This document defines the active V1 lighting architecture.

## Core Model

- Lights are world render objects (`RenderPiece kind=LIGHT`), not a final screen-space light pass.
- Light visuals use projected `ProjectedLight` payloads and draw additively (`lighter`) in world order.
- Ambient darkness/tint remains a separate final screen-space overlay.

## Render Order

For each zLogical band:

1. `TOPS`
2. `ENTITIES`
3. `LIGHTS`
4. `OCCLUDERS`

Invariant:

- Lights render after entities and before occluders.
- Occluders naturally hide lights via painter ordering.

## Data Pipeline

- Compile-time light authoring remains unchanged (`TableMapDef.lights`, semantic presets, map compile outputs).
- Runtime frame light registry merges:
  - static compiled map lights
  - optional runtime beam glow samples
- Registry output is converted to deterministic LIGHT render pieces (`slice/within/baseZ/stableId`).

## Ambient Overlay

Final screen-space lighting work is limited to ambient controls:

- `darknessAlpha`
- `ambientTint`
- `ambientTintStrength`

No normal-light drawing occurs in the final pass.

## Removed Legacy Systems

- No mask-based normal-light occlusion path remains in `render.ts`.
- No inverse/source/combined lighting mask state remains in `WorldLightingState`.
- No legacy mask-only lighting pipeline is restored by debug controls.
- Dev Tools may disable only the final ambient darkness/tint overlay for inspection.

## V1 Approximation Notes

- Oversized lights may overextend across depth in edge cases.
- Support/source-anchor sorting is deterministic and stable.
