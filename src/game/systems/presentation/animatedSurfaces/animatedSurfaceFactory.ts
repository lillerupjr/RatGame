import { configurePixelPerfect } from "../../../../engine/render/pixelPerfect";
import { getSpriteById } from "../../../../engine/render/sprites/renderSprites";
import { ANIMATED_SURFACE_RECIPES } from "../../../content/animatedSurfaceRegistry";
import { VFX_CLIPS, VFX_CLIP_INDEX } from "../../../content/vfxRegistry";
import {
  getDiamondFitCanvas,
  getRuntimeIsoDecalCanvas,
} from "../presentationImageTransforms";
import type {
  AnimatedSurfaceAsset,
  AnimatedSurfaceId,
  AnimatedSurfaceRecipe,
} from "./animatedSurfaceTypes";

type SourceClipDef = {
  spriteIds: string[];
  fps: number;
  loop: boolean;
};

type SurfaceSourceImage = CanvasImageSource & {
  width: number;
  height: number;
  id?: string;
};

type AnimatedSurfaceFactoryDeps = {
  getRecipe: (id: AnimatedSurfaceId) => AnimatedSurfaceRecipe | null;
  getClipDef: (clipId: string) => SourceClipDef | null;
  getSpriteById: (spriteId: string) => { ready?: boolean; img?: SurfaceSourceImage | null } | null;
  getRuntimeIsoDecalCanvas: (
    srcImg: SurfaceSourceImage,
    rotationQuarterTurns: 0 | 1 | 2 | 3,
    scale: number,
  ) => HTMLCanvasElement | null;
  getDiamondFitCanvas: (src: HTMLCanvasElement) => HTMLCanvasElement;
  createCanvas: (width: number, height: number) => HTMLCanvasElement | null;
};

type Placement = {
  x: number;
  y: number;
  phaseOffset: number;
  drawWidth: number;
  drawHeight: number;
};

function getDefaultClipDef(clipId: string): SourceClipDef | null {
  const clipIndex = VFX_CLIP_INDEX[clipId];
  if (!Number.isFinite(clipIndex)) return null;
  const clip = VFX_CLIPS[clipIndex];
  if (!clip || clip.spriteIds.length <= 0) return null;
  return {
    spriteIds: [...clip.spriteIds],
    fps: clip.fps,
    loop: clip.loop,
  };
}

function createRuntimeCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function buildPlacements(
  recipe: AnimatedSurfaceRecipe,
  sourceFrameCount: number,
  sourceWidth: number,
  sourceHeight: number,
): Placement[] {
  const drawWidth = sourceWidth * recipe.instanceScale;
  const drawHeight = sourceHeight * recipe.instanceScale;
  const placements: Placement[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let row = 0; row < recipe.rows; row++) {
    const rowOffset = (row & 1) === 1 ? recipe.alternatingRowOffsetPx : 0;
    for (let col = 0; col < recipe.columns; col++) {
      const x = col * recipe.horizontalStepPx + rowOffset;
      const y = row * recipe.verticalStepPx;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + drawWidth);
      maxY = Math.max(maxY, y + drawHeight);
      placements.push({
        x,
        y,
        phaseOffset: sourceFrameCount > 0 ? (row * recipe.columns + col) % sourceFrameCount : 0,
        drawWidth,
        drawHeight,
      });
    }
  }

  const shiftX = (recipe.outputWidth - (maxX - minX)) * 0.5 - minX;
  const shiftY = (recipe.outputHeight - (maxY - minY)) * 0.5 - minY;
  return placements.map((placement) => ({
    ...placement,
    x: placement.x + shiftX,
    y: placement.y + shiftY,
  }));
}

function loadSourceFrames(
  deps: AnimatedSurfaceFactoryDeps,
  clip: SourceClipDef,
): SurfaceSourceImage[] | null {
  const frames: SurfaceSourceImage[] = [];
  for (let i = 0; i < clip.spriteIds.length; i++) {
    const sprite = deps.getSpriteById(clip.spriteIds[i]);
    if (!sprite?.ready || !sprite.img || !(sprite.img.width > 0) || !(sprite.img.height > 0)) {
      return null;
    }
    frames.push(sprite.img);
  }
  return frames;
}

function bakeAnimatedSurfaceAsset(
  deps: AnimatedSurfaceFactoryDeps,
  recipe: AnimatedSurfaceRecipe,
): AnimatedSurfaceAsset | null {
  const clip = deps.getClipDef(recipe.sourceClipId);
  if (!clip || clip.spriteIds.length <= 0) return null;
  const sourceFrames = loadSourceFrames(deps, clip);
  if (!sourceFrames || sourceFrames.length <= 0) return null;

  const placements = buildPlacements(
    recipe,
    sourceFrames.length,
    sourceFrames[0].width,
    sourceFrames[0].height,
  );
  const instanceRotationRad = ((recipe.instanceRotationDeg ?? 0) * Math.PI) / 180;

  const projectedFrames: HTMLCanvasElement[] = [];
  for (let frameIndex = 0; frameIndex < sourceFrames.length; frameIndex++) {
    const topDown = deps.createCanvas(recipe.outputWidth, recipe.outputHeight);
    const ctx = topDown?.getContext("2d");
    if (!topDown || !ctx) return null;
    configurePixelPerfect(ctx);
    ctx.clearRect(0, 0, topDown.width, topDown.height);
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < placements.length; i++) {
      const placement = placements[i];
      const sourceFrame = sourceFrames[(frameIndex + placement.phaseOffset) % sourceFrames.length];
      const drawWidth = Math.round(placement.drawWidth);
      const drawHeight = Math.round(placement.drawHeight);
      if (Math.abs(instanceRotationRad) <= 1e-6) {
        ctx.drawImage(
          sourceFrame,
          Math.round(placement.x),
          Math.round(placement.y),
          drawWidth,
          drawHeight,
        );
        continue;
      }
      const centerX = Math.round(placement.x + placement.drawWidth * 0.5);
      const centerY = Math.round(placement.y + placement.drawHeight * 0.5);
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(instanceRotationRad);
      ctx.drawImage(
        sourceFrame,
        -drawWidth * 0.5,
        -drawHeight * 0.5,
        drawWidth,
        drawHeight,
      );
      ctx.restore();
    }
    const projected = deps.getRuntimeIsoDecalCanvas(topDown, 0, 1);
    if (!projected) return null;
    projectedFrames.push(deps.getDiamondFitCanvas(projected));
  }

  return {
    id: recipe.id,
    fps: clip.fps,
    loop: clip.loop,
    frameCount: sourceFrames.length,
    projectedFrames,
    warningAlpha: recipe.warningAlpha ?? 0.4,
    activeAlpha: recipe.activeAlpha ?? 0.8,
  };
}

export function createAnimatedSurfaceFactory(
  deps: AnimatedSurfaceFactoryDeps = {
    getRecipe: (id) => ANIMATED_SURFACE_RECIPES[id] ?? null,
    getClipDef: getDefaultClipDef,
    getSpriteById,
    getRuntimeIsoDecalCanvas,
    getDiamondFitCanvas,
    createCanvas: createRuntimeCanvas,
  },
): {
  getAnimatedSurface: (id: AnimatedSurfaceId) => AnimatedSurfaceAsset | null;
  getAnimatedSurfaceFrame: (id: AnimatedSurfaceId, timeSec: number) => HTMLCanvasElement | null;
  clearAnimatedSurfaceCache: () => void;
} {
  const cache = new Map<AnimatedSurfaceId, AnimatedSurfaceAsset>();

  function getAnimatedSurface(id: AnimatedSurfaceId): AnimatedSurfaceAsset | null {
    const cached = cache.get(id);
    if (cached) return cached;
    const recipe = deps.getRecipe(id);
    if (!recipe) return null;
    const baked = bakeAnimatedSurfaceAsset(deps, recipe);
    if (!baked) return null;
    cache.set(id, baked);
    return baked;
  }

  function getAnimatedSurfaceFrame(id: AnimatedSurfaceId, timeSec: number): HTMLCanvasElement | null {
    const asset = getAnimatedSurface(id);
    if (!asset || asset.projectedFrames.length <= 0) return null;
    const t = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
    const rawFrame = Math.floor(t * asset.fps);
    const frameIndex = asset.loop
      ? rawFrame % asset.projectedFrames.length
      : Math.min(asset.projectedFrames.length - 1, rawFrame);
    return asset.projectedFrames[frameIndex] ?? null;
  }

  function clearAnimatedSurfaceCache(): void {
    cache.clear();
  }

  return {
    getAnimatedSurface,
    getAnimatedSurfaceFrame,
    clearAnimatedSurfaceCache,
  };
}

const animatedSurfaceFactory = createAnimatedSurfaceFactory();

export function getAnimatedSurface(id: AnimatedSurfaceId): AnimatedSurfaceAsset | null {
  return animatedSurfaceFactory.getAnimatedSurface(id);
}

export function getAnimatedSurfaceFrame(
  id: AnimatedSurfaceId,
  timeSec: number,
): HTMLCanvasElement | null {
  return animatedSurfaceFactory.getAnimatedSurfaceFrame(id, timeSec);
}

export function clearAnimatedSurfaceCache(): void {
  animatedSurfaceFactory.clearAnimatedSurfaceCache();
}
