# Lighting System Contract

This document defines the architecture, invariants, and implementation phases of the lighting system.

Lighting is a pure screen-space render pass layered on top of the existing render pipeline. It MUST NOT modify world geometry, slices, surfaces, or entity logic.

Lighting affects only pixel output.

## Goals

Lighting enables:

- Night mode
- Street lights
- Indoor lighting
- Light-emitting entities
- Atmospheric mood control

Lighting MUST integrate cleanly with:

- RenderPiece pipeline
- Slice ordering contract
- Canvas2D renderer
- Structure occlusion rules

Lighting MUST NOT affect gameplay logic.

## Core Principle

Lighting is implemented as a darkness overlay with subtractive light masks.

Conceptually:

```txt
FinalPixel =
    ScenePixel
    darkened by darkness overlay
    restored locally by lights
```

This produces realistic lighting while preserving render order.

## Render Pipeline Integration

Lighting is a dedicated render pass executed AFTER all world rendering.

Final pipeline:

```txt
PASS 1: Background
PASS 2: Floors
PASS 3: Structures
PASS 4: Entities
PASS 5: VFX
PASS 6: Occluders
PASS 7: Overlays

PASS 8: Lighting (NEW)
```

Lighting MUST be last.

Lighting MUST operate in screen space.

## Darkness Overlay Model

Darkness is a full-screen rectangle drawn using alpha blending.

Example:

```txt
ctx.fillStyle = rgba(0,0,0, darknessAlpha)
ctx.fillRect(0,0,width,height)
```

Where:

- `darknessAlpha = 0.0` -> fully lit
- `darknessAlpha = 1.0` -> fully dark

Typical values:

- Day: `0.0`
- Dusk: `0.3`
- Night: `0.6`
- Dark: `0.8`

## Light Model

Lights restore brightness locally.

Each light has:

```txt
Light {
    screenX
    screenY
    radiusPx
    intensity
}
```

Lights operate in screen space.

Lights DO NOT operate in tile space.

Lights DO NOT operate in world space after projection.

Projection MUST occur first.

## Light Rendering Method

Lights use Canvas composite mode:

```txt
ctx.globalCompositeOperation = "destination-out"
```

Rendering sequence:

1. draw darkness overlay
2. set composite destination-out
3. draw radial gradients for each light
4. restore composite mode

Result:

Darkness is cut away where lights exist.

## Light Gradient Definition

Each light uses radial gradient:

- gradient center = light position
- radius = `light.radiusPx`
- inner alpha = `intensity`
- outer alpha = `0`

Smooth falloff is REQUIRED.

Hard edges are FORBIDDEN.

## Light Sources

Lights may originate from:

Static lights:

- street lamps
- indoor lamps
- neon signs

Dynamic lights:

- player
- enemies
- projectiles
- explosions

Environmental lights:

- map-defined lights
- scripted lights

## Light Coordinate Space

Lights MUST be defined in world space:

- `worldX`
- `worldY`
- `heightUnits`

Then projected into screen space using existing projection functions.

Projection MUST use the same functions as entities.

Lighting MUST NOT use custom projection math.

## Occlusion Behavior (Phase 1)

Phase 1 lighting ignores occlusion.

Lights affect all pixels regardless of geometry.

This simplifies implementation and preserves render performance.

Occlusion lighting MAY be added in later phases.

## Performance Requirements

Lighting MUST support:

Target:

- 100 lights at 60 FPS

Required optimizations:

- single overlay draw
- reuse gradient objects when possible
- no per-pixel CPU loops

Lighting MUST NOT:

- iterate over tiles
- iterate over slices
- modify RenderPiece pipeline

Lighting is screen-space only.

## Lighting System Ownership

Lighting state is owned by:

- `WorldLightingState`

Example:

```txt
WorldLightingState {
    darknessAlpha
    lights[]
}
```

Lights are added and removed dynamically.

## Render System Integration

Render system MUST call:

```txt
renderLighting(ctx, worldLightingState, camera)
```

AFTER all render pieces.

Lighting MUST NOT modify camera.

Lighting MUST NOT modify render pieces.

## Phase Plan

### Phase 1 - Global Darkness + Lights

Achievements:

- darkness overlay implemented
- lights restore brightness locally
- lights defined in world space
- lights projected to screen space
- lighting rendered as final pass

No occlusion.

### Phase 2 - Light Components

Achievements:

- player has light
- street lights defined in map
- projectiles emit light

### Phase 3 - Colored Lights

Achievements:

- lights support color
- neon lights supported
- environment tint supported

### Phase 4 - Occlusion Lighting (Advanced)

Achievements:

- walls block light
- structures cast shadows

This phase is optional.

## Non-Goals

Lighting MUST NOT:

- modify render slices
- modify world geometry
- modify surfaces
- modify collision
- modify entity logic

Lighting is visual only.

## Invariants

Lighting MUST:

- be final render pass
- operate in screen space
- use world projection
- not modify render pipeline ordering

Lighting MUST NOT:

- break slice ownership contract
- break occlusion contract
- break surface contract

## Summary

Lighting is implemented as:

- darkness overlay
- minus radial light masks
- as final screen-space render pass
