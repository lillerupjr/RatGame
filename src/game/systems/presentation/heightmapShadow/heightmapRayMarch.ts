/**
 * Screen-Space Ray March Shadow Computation
 *
 * Per-pixel ray march over the scene height buffer to determine shadow occlusion.
 * For each pixel, steps along the light direction and checks if any taller geometry
 * blocks the light path (H_sample > ray_height at that distance).
 *
 * Produces a shadow mask (Float32Array) where 0 = lit, 1 = fully shadowed.
 */

import type { ShadowSunV1Model } from "../../../../shadowSunV1";
import type { SceneHeightBuffer } from "./sceneHeightBuffer";

export type HeightmapShadowMask = {
  width: number;
  height: number;
  /** Per-pixel shadow intensity (0.0 = lit, 1.0 = fully shadowed), row-major. */
  data: Float32Array;
  /** Matches the height buffer's screen-space origin. */
  originScreenX: number;
  originScreenY: number;
  /** Matches the height buffer's resolution scale. */
  scale: number;
};

export type HeightmapShadowParams = {
  /** Pixels to advance per ray march step (at shadow resolution). Default 2. */
  stepSize: number;
  /** Maximum number of ray march steps before giving up. Default 128. */
  maxSteps: number;
  /** Output shadow darkness multiplier (0–1). Default 0.45. */
  shadowIntensity: number;
};

export const DEFAULT_HEIGHTMAP_SHADOW_PARAMS: HeightmapShadowParams = {
  stepSize: 2,
  maxSteps: 128,
  shadowIntensity: 0.45,
};

/**
 * Conversion factor: how many screen pixels (at full resolution) correspond
 * to 1.0 height-buffer units.  A heightmap value of 1.0 represents maximum
 * structure height, which in screen space is roughly this many pixels tall.
 *
 * This bridges the gap between the pixel-based march distance and the
 * normalised [0,1] height values so that tan(elevation) produces correct
 * ray rise rates.
 *
 * Tune this if shadows appear too long / too short.  Larger value = shadows
 * are shorter (the ray rises faster relative to pixel distance).
 */
const HEIGHT_UNITS_PER_PIXEL = 1 / 400;

let _maskData: Float32Array | null = null;
let _cacheKey = "";

/**
 * Computes the heightmap shadow mask via CPU ray march.
 *
 * @param heightBuffer  The composited scene height buffer.
 * @param sunModel      Current sun model (provides projectionDirection and elevationDeg).
 * @param params        Tuning parameters for the ray march.
 * @param cacheKey      Cache key string; if unchanged, returns the cached result.
 * @returns Shadow mask, or null if sun isn't casting shadows.
 */
export function computeHeightmapShadowMask(
  heightBuffer: SceneHeightBuffer,
  sunModel: ShadowSunV1Model,
  params: HeightmapShadowParams,
  cacheKey: string,
): HeightmapShadowMask | null {
  if (!sunModel.castsShadows) return null;

  // The projectionDirection points from the object in the direction the shadow falls.
  // We march in the OPPOSITE direction (toward the light) to find occluders.
  const projDirX = sunModel.projectionDirection.x;
  const projDirY = sunModel.projectionDirection.y;
  const projLen = Math.hypot(projDirX, projDirY);
  if (projLen < 1e-6) return null;

  // Cache check
  if (cacheKey === _cacheKey && _maskData && _maskData.length >= heightBuffer.width * heightBuffer.height) {
    return {
      width: heightBuffer.width,
      height: heightBuffer.height,
      data: _maskData,
      originScreenX: heightBuffer.originScreenX,
      originScreenY: heightBuffer.originScreenY,
      scale: heightBuffer.scale,
    };
  }

  const { width, height, data: heightData } = heightBuffer;
  const totalPixels = width * height;

  if (!_maskData || _maskData.length < totalPixels) {
    _maskData = new Float32Array(totalPixels);
  }
  const maskData = _maskData;
  maskData.fill(0);

  const stepSize = Math.max(0.5, params.stepSize);
  const maxSteps = Math.max(1, Math.min(512, params.maxSteps));
  const intensity = Math.max(0, Math.min(1, params.shadowIntensity));

  // March direction: toward the light source (opposite of shadow projection)
  // Normalize and scale by step size
  const marchDirX = (-projDirX / projLen) * stepSize;
  const marchDirY = (-projDirY / projLen) * stepSize;

  // tan(elevation) controls how quickly the ray rises with distance.
  // We scale by HEIGHT_UNITS_PER_PIXEL to convert pixel march distances
  // into height-buffer-compatible units (heights are normalised 0–1).
  const elevRad = sunModel.elevationDeg * (Math.PI / 180);
  const tanElev = Math.tan(elevRad);

  // Height rise per march step, in height-buffer units.
  // stepSize is in shadow-resolution pixels; we also account for the
  // resolution divisor that is baked into the buffer's `scale` field.
  const pixelsPerStep = stepSize;
  const fullResPixelsPerStep = pixelsPerStep / heightBuffer.scale;
  const heightRisePerStep = fullResPixelsPerStep * HEIGHT_UNITS_PER_PIXEL * tanElev;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const pixelIdx = rowOffset + x;
      const hSelf = heightData[pixelIdx];

      // March toward the light
      let shadowed = false;
      for (let step = 1; step <= maxSteps; step++) {
        const sampleX = x + marchDirX * step;
        const sampleY = y + marchDirY * step;

        // Bounds check
        const sx = Math.round(sampleX);
        const sy = Math.round(sampleY);
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) break;

        const hSample = heightData[sy * width + sx];
        const rayHeight = hSelf + heightRisePerStep * step;

        if (hSample > rayHeight) {
          shadowed = true;
          break;
        }
      }

      if (shadowed) {
        maskData[pixelIdx] = intensity;
      }
    }
  }

  _cacheKey = cacheKey;

  return {
    width,
    height,
    data: maskData,
    originScreenX: heightBuffer.originScreenX,
    originScreenY: heightBuffer.originScreenY,
    scale: heightBuffer.scale,
  };
}

/**
 * Clears the cached shadow mask. Call on map transitions.
 */
export function clearHeightmapShadowMaskCache(): void {
  _cacheKey = "";
}
