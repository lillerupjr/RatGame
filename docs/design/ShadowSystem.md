# Heightmap Shadow System

This document describes the per-pixel heightmap shadow casting system. It produces high-fidelity structure shadows using pre-baked heightmap PNGs and screen-space ray marching.

## Architecture Overview

The system has four stages that execute each frame:

```
1. Heightmap Loading    (startup / on-demand)
2. Height Buffer        (per-frame compositing in world-projected space)
3. Ray March            (per-frame shadow computation, cached by camera+sun key)
4. Mask Rendering       (per-frame Canvas 2D draw through world transform)
```

This is the **sole shadow system** in the game. The legacy tile-level sweep shadow system has been removed.

## Coordinate Spaces

Understanding the coordinate spaces is critical to this system:

| Space | Description | Used By |
|-------|-------------|---------|
| **World** | Tile-based world coordinates (tx, ty) | Game logic, overlay positions |
| **World-projected** | Isometric projection of world coords; no camera or zoom applied. `worldToScreen(wx, wy)` produces these. | `buildRuntimeStructureProjectedDraw()` returns `dx, dy` in this space |
| **CSS** | Pixel coordinates on the browser viewport. `css = offset + (projected + cam) * zoom` | `viewport.projectProjectedToCss()` |
| **Device** | Physical canvas pixels. `device = css * dpr` | Canvas `.width`/`.height`, final rendering |

**The height buffer and shadow mask operate in world-projected space** — the same coordinate space that structures are drawn in. The canvas `applyWorldTransform()` then maps projected coordinates to device pixels via:
```
ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, safeOffsetDeviceX, safeOffsetDeviceY);
ctx.translate(camTx, camTy);
```

This is what ensures the shadow mask aligns pixel-perfectly with structures regardless of camera position, zoom level, or DPR.

### Viewport in Projected Space

The visible viewport expressed in world-projected coordinates:
```
originX = -camTx
originY = -camTy
width   = cssWidth / zoom
height  = cssHeight / zoom
```

Structure positions from `buildRuntimeStructureProjectedDraw()` are offset relative to this viewport origin before compositing into the height buffer. The shadow mask is then drawn at `(-camTx, -camTy)` through the world transform.

## Stage 1: Heightmap Asset Loading

**File:** `src/engine/render/sprites/heightmapLoader.ts`

### Asset Format

Heightmaps are grayscale PNG images stored alongside structure sprite images:

```
structures/buildings/batch1/building1/
  images/       <- color sprites (n.png, ne.png, e.png, se.png, s.png, sw.png, w.png, nw.png)
  heightmaps/   <- height data  (n.png, ne.png, e.png, se.png, s.png, sw.png, w.png, nw.png)
  normals/      <- (not used by this system)
```

Each heightmap pixel encodes:
- **R = G = B = height** (0-255, mapped to 0.0-1.0 normalized height units)
- **A = alpha mask** (though the system uses the color sprite's alpha as the definitive mask)

### Manifest-Based Detection

Not all asset folders contain heightmaps. Detection uses a prefix manifest:

```ts
const HEIGHTMAP_ENABLED_PREFIXES = ["structures/buildings/batch1/"];
```

`hasHeightmapSupport(spriteId)` checks if the sprite ID starts with any manifest prefix and contains an `/images/` segment (which can be mapped to `/heightmaps/`).

### Loading Flow

1. When `renderSprites.ts` loads a color sprite via `loadByIdInternal()`, it checks `hasHeightmapSupport()`.
2. If supported, `requestHeightmapForSprite(spriteId)` is called, which:
   - Derives the heightmap sprite ID by replacing `/images/` with `/heightmaps/` in the path
   - Loads the PNG via `new Image()`
   - On load, draws to a scratch canvas and extracts pixel data via `getImageData()`
   - Stores the result in an in-memory cache keyed by heightmap sprite ID
3. `getHeightmapForSprite(spriteId)` returns the cached `HeightmapData` or null.

### Key Type

```ts
type HeightmapData = {
  width: number;
  height: number;
  heights: Uint8Array;   // Per-pixel height (0-255), row-major
  alpha: Uint8Array;     // Per-pixel alpha from heightmap PNG
  img: HTMLImageElement; // Original image element
};
```

## Stage 2: Scene Height Buffer Compositing

**File:** `src/game/systems/presentation/heightmapShadow/sceneHeightBuffer.ts`

Each frame, visible structures with loaded heightmaps are composited into a single height buffer in world-projected space.

### Inputs

The render loop computes the viewport bounds in projected space and offsets each structure's `dx, dy` relative to the viewport origin:

```ts
// In render.ts:
const hmViewX = -viewport.camTx;                  // viewport left in projected space
const hmViewY = -viewport.camTy;                  // viewport top in projected space
const hmViewW = cssW / viewport.zoom;              // viewport width in projected units
const hmViewH = cssH / viewport.zoom;              // viewport height in projected units

heightmapStructures.push({
  screenX: projected.dx - hmViewX,                 // position relative to viewport origin
  screenY: projected.dy - hmViewY,
  drawWidth: projected.dw * (projected.scale ?? 1), // size in projected units (NO zoom)
  drawHeight: projected.dh * (projected.scale ?? 1),
  ...
});

compositeSceneHeightBuffer(hmViewW, hmViewH, resolutionDivisor, heightmapStructures);
```

### Process

1. **Allocate buffer** — `Float32Array` at `viewportDimensions / resolutionDivisor` (default divisor: 2 = half resolution).
2. **Clear to zero** (ground level).
3. **For each visible structure with a heightmap:**
   - Compute bounding box at shadow resolution: `dstX0 = floor(screenX * scale)`, etc.
   - Draw the color sprite into a scratch canvas at shadow resolution to extract its alpha channel
   - For each pixel in the bounding box:
     - Check color sprite alpha (skip if < 128 = transparent)
     - Sample the heightmap at the corresponding position (with flipX support)
     - Write `heightValue / 255.0` into the buffer
   - **Max-blend**: if a pixel already has a higher value from a previous structure, keep the taller value

### Key Type

```ts
type SceneHeightBuffer = {
  width: number;          // Buffer width in shadow-resolution pixels
  height: number;         // Buffer height in shadow-resolution pixels
  data: Float32Array;     // Per-pixel height (0.0-1.0), row-major
  originScreenX: number;  // Always 0 (buffer starts at viewport origin)
  originScreenY: number;  // Always 0
  scale: number;          // 1 / resolutionDivisor (e.g. 0.5 for half-res)
};
```

### Why Color Sprite Alpha?

The heightmap PNGs may have minor alpha differences from the color sprites due to the baking process. Using the color sprite's alpha as the definitive mask ensures the shadow silhouette matches exactly what is rendered on screen.

## Stage 3: Ray March (Shadow Computation)

**File:** `src/game/systems/presentation/heightmapShadow/heightmapRayMarch.ts`

The ray march determines which pixels are in shadow by stepping toward the light source and checking for occluding geometry.

### Algorithm

For each pixel `(x, y)` in the height buffer:

1. Read `H_self` = height at current pixel
2. **March toward the light** — step in the direction opposite to `sunModel.projectionDirection`, advancing `stepSize` pixels per step
3. At each step `n`:
   - Compute sample position: `(x + marchDir.x * n, y + marchDir.y * n)`
   - Compute `ray_height = H_self + heightRisePerStep * n`
   - Read `H_sample` from the height buffer at the sample position
   - If `H_sample > ray_height` -> pixel is **shadowed** (early termination)
4. If the ray exits the buffer or exceeds `maxSteps` -> pixel is **lit**
5. Shadowed pixels receive the configured `shadowIntensity` value (default 0.45)

### Height-to-Pixel Conversion (HEIGHT_UNITS_PER_PIXEL)

Heights are normalized 0.0-1.0 but step distances are in pixels. A conversion constant bridges the two:

```ts
const HEIGHT_UNITS_PER_PIXEL = 1 / 400;
```

The ray height rise per step is computed as:
```ts
const pixelsPerStep = stepSize;                                    // in shadow-resolution cells
const fullResUnitsPerStep = pixelsPerStep / heightBuffer.scale;    // convert to projected-space units
const heightRisePerStep = fullResUnitsPerStep * HEIGHT_UNITS_PER_PIXEL * tan(elevationDeg);
```

The buffer's `scale` field (= `1 / resolutionDivisor`) converts from shadow-resolution cells to world-projected units.

**Why this matters:** Without the conversion, `rayHeight = H_self + pixelDistance * tan(elev)` would instantly exceed 1.0 (since step distances are 2-4 while heights are 0.0-1.0), causing the ray to overshoot all structures and produce zero shadows.

**Tuning:** A smaller value (e.g. 1/800) produces longer shadows; a larger value (e.g. 1/200) produces shorter shadows. The current 1/400 is calibrated so typical batch1 buildings cast shadows approximately 100-200 pixels in full-res screen space.

### Sun Model Inputs

The ray march uses the `ShadowSunV1Model` from `src/shadowSunV1.ts`:

- **`projectionDirection`** `{x, y}` — screen-space direction shadows are cast (away from the sun). The march goes in the opposite direction (toward the light).
- **`elevationDeg`** — sun elevation angle. Higher elevation = shorter shadows (ray rises faster).
- **`castsShadows`** — boolean; if false, the entire heightmap pass is skipped.
- **`stepKey`** — string that changes when the sun position changes, used as part of the cache key.

### Caching

The shadow mask is cached by a composite key:

```
${mapId}:${sunStepKey}:hm:${cssW}x${cssH}:cam${camTx},${camTy}:d${divisor}:s${stepSize}:m${maxSteps}:i${intensity}
```

It is recomputed when any component changes:
- Sun position changes (different `stepKey`)
- Camera position changes (`camTx`/`camTy` — these are integers due to `Math.round` in `centerOnProjected`)
- Viewport resizes
- Debug parameters change (step size, max steps, intensity, resolution divisor)

Since `camTx/camTy` are always integers, the cache naturally provides frame-level stability — the mask recomputes exactly when the camera snaps to a new integer position.

### Tuning Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `stepSize` | 2 | 0.5-8 | Pixels per ray march step at shadow resolution |
| `maxSteps` | 128 | 1-512 | Maximum steps before declaring a pixel lit |
| `shadowIntensity` | 0.45 | 0-1 | Darkness of shadowed pixels |

### Key Type

```ts
type HeightmapShadowMask = {
  width: number;
  height: number;
  data: Float32Array;     // 0.0 = lit, intensity = shadowed, row-major
  originScreenX: number;
  originScreenY: number;
  scale: number;
};
```

## Stage 4: Shadow Mask Rendering

**File:** `src/engine/render/auxiliary/auxiliaryCanvasRenderer.ts` — method `drawHeightmapShadowMask()`

The shadow mask is rendered as a semi-transparent black overlay onto the main canvas **through the world transform**, ensuring pixel-perfect alignment with structures.

### Process

1. Build an `ImageData` from the shadow mask `Float32Array`:
   - R=0, G=0, B=0 (black)
   - A = `maskData[i] * 255` (shadow intensity as alpha)
2. Put the `ImageData` into a scratch canvas at shadow resolution
3. Compute the viewport rectangle in projected space:
   ```ts
   drawX = -viewport.camTx
   drawY = -viewport.camTy
   drawW = viewport.cssWidth / viewport.zoom
   drawH = viewport.cssHeight / viewport.zoom
   ```
4. Draw the scratch canvas onto the main canvas at the projected viewport position using `ctx.drawImage()` with bilinear interpolation (`imageSmoothingEnabled = true`)
5. Uses `globalCompositeOperation = "source-over"` — the shadow blends on top of everything already drawn

### Why Through the World Transform?

The shadow mask must be drawn through the **same `applyWorldTransform()` context** that structures use. This is the critical alignment guarantee:

- The height buffer is composited from structure positions in world-projected space
- The mask is drawn at the viewport origin in world-projected space `(-camTx, -camTy)`
- The world transform on the Canvas 2D context maps projected coords to device pixels identically for both structures and the shadow mask
- This automatically handles DPR scaling, zoom, and camera offset

**Previous bug:** Drawing the mask at identity transform (`ctx.setTransform(1,0,0,1,0,0)`) at `(0,0)` caused the mask to drift relative to structures because CSS pixel coordinates don't account for the world transform's zoom and offset chain.

### Render Command

The shadow mask is enqueued as a debug primitive render command at z-band `"FIRST"`, drawn during `renderWorldCommands()` which has the world transform active:

```ts
{
  semanticFamily: "debug",
  finalForm: "primitive",
  payload: { zBand: "FIRST", heightmapShadowMask: mask }
}
```

## Integration Point: Main Render Loop

**File:** `src/game/systems/presentation/render.ts`

The heightmap shadow pass runs each frame:

1. Check `renderSettings.heightmapShadowsEnabled` (master toggle) AND `shadowSunModel.castsShadows`
2. Compute viewport bounds in world-projected space:
   ```ts
   const hmViewX = -viewport.camTx;
   const hmViewY = -viewport.camTy;
   const hmViewW = cssW / viewport.zoom;
   const hmViewH = cssH / viewport.zoom;
   ```
3. Collect visible structures via `compiledMap.overlaysInView(viewRect)`
4. For each overlay, check if its sprite has a loaded heightmap via `getHeightmapForSprite()`
5. Build structure instances with positions relative to viewport origin in projected space
6. If any structures have heightmaps:
   - Call `compositeSceneHeightBuffer(hmViewW, hmViewH, ...)` to build the height buffer
   - Call `computeHeightmapShadowMask()` to compute the shadow mask
7. Enqueue the shadow mask render command

If no structures on the current map have heightmaps, the entire pass is skipped (zero cost).

## Settings

### System Overrides (`src/settings/settingsTypes.ts`)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `heightmapShadowsEnabled` | boolean | `true` | Master on/off toggle |

### Debug Settings (`src/settings/debugToolsSettings.ts`)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `heightmapShadowDebugShowHeightBuffer` | boolean | `false` | Visualize the height buffer as a colored overlay |
| `heightmapShadowResolutionDivisor` | number | `2` | Resolution divisor (1=full, 2=half, 4=quarter) |
| `heightmapShadowStepSize` | number | `2` | Ray march step size in shadow-res pixels |
| `heightmapShadowMaxSteps` | number | `128` | Max ray march steps |
| `heightmapShadowIntensity` | number | `0.45` | Shadow darkness (0=invisible, 1=fully black) |

### Dev Tools UI

In `src/ui/devTools/`:
- **SystemOverridesSection.ts** — Toggle: "Heightmap Shadows" (enables/disables the entire system)
- **DebugToolsSection.ts** — "Heightmap Shadow Tuning" subsection with 4 sliders (Resolution Divisor, Step Size, Max Steps, Shadow Intensity) + height buffer debug visualization toggle

### Settings Data Flow

```
DebugToolsSettings (UI sliders) -> toLegacySettings() -> DebugSettings -> resolveRenderDebugFlags() -> RenderDebugFlags -> render loop debugFlags
SystemOverrides (UI toggle)     -> toLegacySettings() -> RenderSettings -> render loop renderSettings
```

Debug parameters use `Number.isFinite()` checks (not `||`) to correctly handle zero values:
```ts
const _step = Number(debugFlags.heightmapShadowStepSize);
const stepSize = Number.isFinite(_step) && _step > 0 ? _step : DEFAULT.stepSize;
```

## Fallback Behavior

- **Structure has no heightmap** -> it does not contribute to the pixel height buffer and casts no shadow.
- **No structures on the map have heightmaps** -> the heightmap shadow pass is skipped entirely (zero cost).
- **Sun below horizon (`castsShadows = false`)** -> the entire pass is skipped.

## Asset Coverage

Currently only `batch1` buildings have heightmap PNGs. To add heightmap support for a new batch:

1. Bake heightmap PNGs into `public/assets-runtime/base_db32/structures/buildings/<batch>/*/heightmaps/`
2. Add the prefix to `HEIGHTMAP_ENABLED_PREFIXES` in `src/engine/render/sprites/heightmapLoader.ts`:
   ```ts
   const HEIGHTMAP_ENABLED_PREFIXES = [
     "structures/buildings/batch1/",
     "structures/buildings/<new_batch>/",
   ];
   ```

## Testing Map

**File:** `src/game/map/authored/maps/jsonMaps/batch1_shadow_test.json`

An 80x80 sidewalk map with all 24 batch1 assets spaced out for shadow/performance inspection:
- Rows 1-4: all 24 assets facing S
- Rows 5-6: direction variants (N, E, W) for buildings 1, 3, 5, 8
- Spawn at (38, 38)
- Available from Map Selector as "Batch1 shadow test"

## Bugs Fixed During Implementation

### 1. Height/Pixel Scale Mismatch
Heights are 0.0-1.0 but ray march steps are in pixels (2-4). Without `HEIGHT_UNITS_PER_PIXEL`, `rayHeight = hSelf + pixelDist * tan(elev)` instantly exceeds 1.0, producing zero shadows.

### 2. Coordinate Space: World-Projected vs CSS vs Device
`buildRuntimeStructureProjectedDraw()` returns positions in world-projected space. The height buffer must use the same space. Converting to CSS coordinates caused drift because the shadow mask was drawn at identity transform while structures were drawn through the world transform. **Fix:** Keep everything in projected space and draw the mask through `applyWorldTransform()`.

### 3. `||` Operator Ignoring Zero Values
`Number(0) || default` evaluates to `default` when the user sets a debug slider to 0. **Fix:** Use `Number.isFinite()` checks.

## File Summary

| File | Role |
|------|------|
| `src/engine/render/sprites/heightmapLoader.ts` | Heightmap PNG loading, caching, manifest |
| `src/game/systems/presentation/heightmapShadow/sceneHeightBuffer.ts` | Scene height buffer compositing |
| `src/game/systems/presentation/heightmapShadow/heightmapRayMarch.ts` | Per-pixel ray march shadow computation |
| `src/engine/render/auxiliary/auxiliaryCanvasRenderer.ts` | Shadow mask Canvas 2D rendering (`drawHeightmapShadowMask`) |
| `src/game/systems/presentation/render.ts` | Integration in main render loop |
| `src/game/systems/presentation/viewportTransform.ts` | Viewport transform (`projectProjectedToCss`, `applyWorldTransform`) |
| `src/engine/render/sprites/renderSprites.ts` | Triggers heightmap loading alongside sprites |
| `src/settings/settingsTypes.ts` | Setting type definitions |
| `src/settings/debugToolsSettings.ts` | Debug setting defaults and sanitization |
| `src/settings/systemOverrides.ts` | System override defaults and sanitization |
| `src/ui/devTools/DebugToolsSection.ts` | Debug UI sliders for shadow tuning |
| `src/ui/devTools/SystemOverridesSection.ts` | System override toggle for heightmap shadows |
| `src/game/systems/presentation/debug/debugRenderFlags.ts` | Debug flag resolution |
| `src/game/systems/presentation/debug/debugRenderTypes.ts` | Debug flag type definitions |
| `src/game/systems/presentation/contracts/renderCommands.ts` | Render command types |
| `src/game/map/authored/maps/jsonMaps/batch1_shadow_test.json` | Test map for shadow inspection |
