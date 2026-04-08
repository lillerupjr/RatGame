/**
 * Scene Height Buffer Compositing
 *
 * Builds a screen-space height buffer by compositing heightmap data from
 * visible structures into a single Float32Array. Each pixel stores the
 * world-space height (0.0–1.0) of whatever geometry occupies that screen position.
 *
 * This buffer is the input for the ray march shadow pass.
 */

import type { HeightmapData } from "../../../../engine/render/sprites/heightmapLoader";

export type SceneHeightBuffer = {
  /** Width in pixels at shadow resolution. */
  width: number;
  /** Height in pixels at shadow resolution. */
  height: number;
  /** Per-pixel height values (0.0–1.0), row-major. */
  data: Float32Array;
  /** X offset of the buffer origin in world-projected space (always 0). */
  originScreenX: number;
  /** Y offset of the buffer origin in world-projected space (always 0). */
  originScreenY: number;
  /** Inverse of the resolution divisor (e.g. 0.5 for half-res). */
  scale: number;
};

export type HeightmapStructureInstance = {
  /** Heightmap pixel data for this structure. */
  heightmap: HeightmapData;
  /** Draw X in world-projected space, relative to viewport origin. */
  screenX: number;
  /** Draw Y in world-projected space, relative to viewport origin. */
  screenY: number;
  /** Rendered width in world-projected units. */
  drawWidth: number;
  /** Rendered height in world-projected units. */
  drawHeight: number;
  /** Whether the sprite is flipped horizontally. */
  flipX: boolean;
  /** The color sprite's alpha-bearing HTMLImageElement (for masking). */
  colorSpriteImg: HTMLImageElement;
};

let _bufferData: Float32Array | null = null;
let _bufferW = 0;
let _bufferH = 0;

let _scratchCanvas: HTMLCanvasElement | null = null;
let _scratchCtx: CanvasRenderingContext2D | null = null;

function getScratch(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!_scratchCanvas || !_scratchCtx) {
    _scratchCanvas = document.createElement("canvas");
    _scratchCtx = _scratchCanvas.getContext("2d", { willReadFrequently: true });
    if (!_scratchCtx) throw new Error("[sceneHeightBuffer] Failed to create scratch canvas context.");
  }
  return { canvas: _scratchCanvas, ctx: _scratchCtx };
}

/**
 * Composites a scene height buffer from visible structures that have heightmaps.
 *
 * @param viewportWidth  Viewport width in world-projected units (cssWidth / zoom).
 * @param viewportHeight Viewport height in world-projected units (cssHeight / zoom).
 * @param resolutionDivisor  Downscale factor (1 = full, 2 = half, 4 = quarter).
 * @param structures  Visible structures with heightmap data and screen positions.
 * @returns The composited height buffer, or null if no structures contributed.
 */
export function compositeSceneHeightBuffer(
  viewportWidth: number,
  viewportHeight: number,
  resolutionDivisor: number,
  structures: ReadonlyArray<HeightmapStructureInstance>,
): SceneHeightBuffer | null {
  if (structures.length === 0) return null;

  const divisor = Math.max(1, Math.round(resolutionDivisor));
  const scale = 1 / divisor;
  const bufW = Math.ceil(viewportWidth * scale);
  const bufH = Math.ceil(viewportHeight * scale);

  if (bufW <= 0 || bufH <= 0) return null;

  // Reuse buffer allocation if dimensions match
  const totalPixels = bufW * bufH;
  if (!_bufferData || _bufferData.length < totalPixels) {
    _bufferData = new Float32Array(totalPixels);
  }
  const data = _bufferData;
  data.fill(0);

  _bufferW = bufW;
  _bufferH = bufH;

  const { canvas: scratch, ctx: scratchCtx } = getScratch();

  for (let si = 0; si < structures.length; si++) {
    const inst = structures[si];
    const hm = inst.heightmap;

    // Compute the screen-space bounding box of this structure at shadow resolution
    const dstX0 = Math.floor(inst.screenX * scale);
    const dstY0 = Math.floor(inst.screenY * scale);
    const dstW = Math.ceil(inst.drawWidth * scale);
    const dstH = Math.ceil(inst.drawHeight * scale);

    // Skip if entirely outside the buffer
    if (dstX0 + dstW <= 0 || dstY0 + dstH <= 0 || dstX0 >= bufW || dstY0 >= bufH) continue;

    // We need to read the color sprite's alpha to use as the definitive mask.
    // Draw the color sprite into the scratch canvas at shadow resolution to get its alpha.
    const scratchW = Math.max(1, dstW);
    const scratchH = Math.max(1, dstH);
    if (scratch.width < scratchW || scratch.height < scratchH) {
      scratch.width = Math.max(scratch.width, scratchW);
      scratch.height = Math.max(scratch.height, scratchH);
    }
    scratchCtx.clearRect(0, 0, scratchW, scratchH);
    scratchCtx.save();
    if (inst.flipX) {
      scratchCtx.scale(-1, 1);
      scratchCtx.drawImage(inst.colorSpriteImg, -scratchW, 0, scratchW, scratchH);
    } else {
      scratchCtx.drawImage(inst.colorSpriteImg, 0, 0, scratchW, scratchH);
    }
    scratchCtx.restore();
    const colorAlphaData = scratchCtx.getImageData(0, 0, scratchW, scratchH).data;

    // Compute heightmap-to-destination mapping ratios
    const hmScaleX = hm.width / scratchW;
    const hmScaleY = hm.height / scratchH;

    // Blit heightmap pixels into the buffer using color sprite alpha as mask
    for (let ly = 0; ly < scratchH; ly++) {
      const bufY = dstY0 + ly;
      if (bufY < 0 || bufY >= bufH) continue;
      const bufRowOffset = bufY * bufW;

      for (let lx = 0; lx < scratchW; lx++) {
        const bufX = dstX0 + lx;
        if (bufX < 0 || bufX >= bufW) continue;

        // Check color sprite alpha
        const colorPixelIdx = (ly * scratchW + lx) * 4;
        const colorAlpha = colorAlphaData[colorPixelIdx + 3];
        if (colorAlpha < 128) continue; // Skip transparent pixels

        // Sample heightmap at the corresponding position
        const hmX = inst.flipX
          ? Math.min(hm.width - 1, Math.floor((scratchW - 1 - lx) * hmScaleX))
          : Math.min(hm.width - 1, Math.floor(lx * hmScaleX));
        const hmY = Math.min(hm.height - 1, Math.floor(ly * hmScaleY));
        const hmIdx = hmY * hm.width + hmX;
        const heightValue = hm.heights[hmIdx] / 255.0;

        // Max blend: keep tallest value at each pixel
        const bufIdx = bufRowOffset + bufX;
        if (heightValue > data[bufIdx]) {
          data[bufIdx] = heightValue;
        }
      }
    }
  }

  return {
    width: bufW,
    height: bufH,
    data,
    originScreenX: 0,
    originScreenY: 0,
    scale,
  };
}
