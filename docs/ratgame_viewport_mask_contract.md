# RatGame Rendering Contract v1.0

## Part 1 --- Viewport / Canvas / DPR System

## Part 2 --- Mask & Lighting Transform Consistency

This contract defines the **single authoritative coordinate and
transform system** used by the renderer. All rendering systems MUST
follow this contract to avoid drift, scale mismatch, or mask
misalignment.

This document is written to be **agent-friendly**: - explicit rules -
forbidden patterns - deterministic formulas - no interpretation required

  ------------------------------------------------
  \# PART 1 --- VIEWPORT / CANVAS / DPR CONTRACT
  ------------------------------------------------

## Goal

Guarantee that:

1.  **Exactly N tiles are always visible vertically**
2.  **No stretching**
3.  **Wider screens reveal more horizontally**
4.  **Rendering is crisp on all DPR devices**
5.  **Camera math never depends on DPR**
6.  **All game math operates in CSS pixel space**

  ------------------------------------------------------------
  \## Terminology
  ------------------------------------------------------------
  \## Canonical Canvas Setup (MANDATORY)

  Renderer MUST implement exactly this resize logic.

  \`\`\` const rect = canvas.getBoundingClientRect() const
  cssW = rect.width const cssH = rect.height

  const dpr = window.devicePixelRatio \|\| 1

  canvas.width = Math.round(cssW \* dpr) canvas.height =
  Math.round(cssH \* dpr)

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0) \`\`\`

  Effects:

  • Canvas renders at full device resolution • All drawing
  commands operate in CSS pixel space • DPR scaling is
  isolated to the canvas transform
  ------------------------------------------------------------

## Strict Rule --- Camera Math Space

Camera calculations MUST use:

CSS pixels only

Never:

canvas.width canvas.height

Those values include DPR scaling and will cause mobile zoom bugs.

Allowed:

    const cssH = canvas.getBoundingClientRect().height

  ------------------------------------------------------------
  \## Vertical Tile Lock Rule
  ------------------------------------------------------------
  \## Horizontal Reveal Rule

  Screen width determines only how much world becomes visible.

  `visibleWorldWidth = viewportCssWidth / zoom`

  Wider screen → larger visible world width.
  ------------------------------------------------------------

## World Rect Definition

UI elements must not affect world scaling.

Define worldRect in CSS pixels:

    worldRect.top    = uiTopPx
    worldRect.bottom = uiBottomPx

    worldRect.height = cssH - uiTopPx - uiBottomPx
    worldRect.width  = cssW

Zoom uses only worldRect.height.

  --------------------------------------------------------------------------------------------------------------------
  \## Viewport Transform (Authoritative)
  --------------------------------------------------------------------------------------------------------------------
  \## Transform Application

  World rendering MUST use:

  `ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, safeOffsetDeviceX, safeOffsetDeviceY) ctx.translate(camTx, camTy)`

  This is the ONLY world transform allowed.
  --------------------------------------------------------------------------------------------------------------------

## Forbidden Patterns

❌ Using canvas.width for camera math

❌ Recomputing zoom inside subsystems

❌ Using DPR in gameplay or camera code

❌ Mixing CSS pixels and device pixels in projection math

❌ Subsystems applying their own transforms

  ------------------------------------------------------------
  \## Slider Specification
  ------------------------------------------------------------
  \# PART 2 --- MASK & LIGHTING TRANSFORM CONTRACT

  ------------------------------------------------------------

## Goal

Ensure masks, lighting, sprites, and world geometry **never drift
relative to each other**.

All systems must share the same transform pipeline.

  ------------------------------------------------------------
  \## Root Cause of Mask Drift
  ------------------------------------------------------------
  \## Single Source of Truth

  All projection math must originate from:

  ViewportTransform

  Subsystems are forbidden from computing projection
  independently.
  ------------------------------------------------------------

## Two Allowed Rendering Modes

### Mode A --- World Space Rendering

Most systems use:

    viewport.applyWorldTransform(ctx)

Then draw in projected world coordinates.

Used for:

• terrain • structures • enemies • projectiles • occlusion masks •
shadow masks

### Mode B --- Screen Space Rendering

Used only for overlays:

• UI • final lighting composite • screen FX

Apply:

    ctx.setTransform(1,0,0,1,0,0)

  ------------------------------------------------------------
  \## Viewport API (Required)
  ------------------------------------------------------------
  \## Mask Rendering Rules

  All mask canvases MUST start with:

  `viewport.applyWorld(maskCtx)`

  Mask drawing must then use the same coordinates as world
  rendering.

  Forbidden:

  Passing camTx, zoom, safeOffset parameters into helpers.
  ------------------------------------------------------------

## Lighting Projection Rule

Lighting systems MUST NOT implement their own world projection math.

Instead:

    const pos = viewport.project(worldX, worldY, z)

Then draw light shapes using those coordinates.

  ------------------------------------------------------------
  \## Canvas Copy Rule
  ------------------------------------------------------------
  \## Alignment Debug Rule

  Renderer must support a debug invariant test.

  Procedure:

  1\. Draw a world-space alignment dot. 2. Draw the same dot
  inside mask passes. 3. Draw the same dot inside lighting
  passes.

  All dots must overlap perfectly.

  If any diverge → viewport contract violation.
  ------------------------------------------------------------

## Strict Enforcement Rule

Any code that manually computes:

camTx camTy zoom scaling safeOffset DPR transforms

outside of ViewportTransform

is considered a **contract violation**.

  ------------------------------------------------------------
  \# ACHIEVEMENT CHECKLIST

  Renderer satisfies contract when:

  \[x\] Canvas uses canonical DPR setup

  \[x\] Camera zoom depends only on vertical tiles

  \[x\] Width only increases horizontal reveal

  \[x\] All camera math uses CSS pixels

  \[x\] ViewportTransform object exists

  \[x\] Masks use viewport.applyWorld()

  \[x\] Lighting uses viewport.project()

  \[x\] No subsystem recomputes projection math

  \[x\] Alignment debug dot stays perfectly aligned
  ------------------------------------------------------------

END OF CONTRACT
