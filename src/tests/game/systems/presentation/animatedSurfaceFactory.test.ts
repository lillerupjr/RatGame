import { describe, expect, it } from "vitest";
import { ANIMATED_SURFACE_RECIPES, AnimatedSurfaceId } from "../../../../game/content/animatedSurfaceRegistry";
import { createAnimatedSurfaceFactory } from "../../../../game/systems/presentation/animatedSurfaces/animatedSurfaceFactory";

type FakeCanvas = HTMLCanvasElement & {
  __drawSources: Array<CanvasImageSource>;
};

function createFakeCanvas(width: number, height: number): FakeCanvas {
  const drawSources: CanvasImageSource[] = [];
  const ctx = {
    clearRect: () => {},
    drawImage: (image: CanvasImageSource) => {
      drawSources.push(image);
    },
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    imageSmoothingEnabled: false,
  } as unknown as CanvasRenderingContext2D;
  return {
    width,
    height,
    getContext: () => ctx,
    __drawSources: drawSources,
  } as unknown as FakeCanvas;
}

describe("animatedSurfaceFactory", () => {
  it("defines the shared toxic surface recipe from SLIME_IDLE_LOOP", () => {
    expect(ANIMATED_SURFACE_RECIPES[AnimatedSurfaceId.TOXIC_POISON_SURFACE]).toMatchObject({
      id: AnimatedSurfaceId.TOXIC_POISON_SURFACE,
      sourceClipId: "SLIME_IDLE_LOOP",
      columns: 6,
      rows: 12,
      horizontalStepPx: 24,
      verticalStepPx: 16,
      alternatingRowOffsetPx: 16,
      instanceScale: 2,
      instanceRotationDeg: -45,
    });
  });

  it("bakes and caches projected animated surface frames from the shared clip loop", () => {
    const sourceFrames = [
      { id: "frame_0", width: 64, height: 64 },
      { id: "frame_1", width: 64, height: 64 },
      { id: "frame_2", width: 64, height: 64 },
    ] as Array<CanvasImageSource & { width: number; height: number; id: string }>;
    const projectedInputs: FakeCanvas[] = [];
    const factory = createAnimatedSurfaceFactory({
      getRecipe: (id) => ANIMATED_SURFACE_RECIPES[id] ?? null,
      getClipDef: (clipId) => clipId === "SLIME_IDLE_LOOP"
        ? { spriteIds: ["frame_0", "frame_1", "frame_2"], fps: 12, loop: true }
        : null,
      getSpriteById: (spriteId) => {
        const index = Number(spriteId.split("_").pop());
        const frame = sourceFrames[index];
        return frame ? { ready: true, img: frame } : null;
      },
      getRuntimeIsoDecalCanvas: (srcImg) => {
        projectedInputs.push(srcImg as FakeCanvas);
        return {
          width: 128,
          height: 128,
          source: srcImg,
        } as unknown as HTMLCanvasElement;
      },
      getDiamondFitCanvas: (src) => ({
        width: 128,
        height: 64,
        projectedFrom: src,
      } as unknown as HTMLCanvasElement),
      createCanvas: (width, height) => createFakeCanvas(width, height),
    });

    const assetA = factory.getAnimatedSurface(AnimatedSurfaceId.TOXIC_POISON_SURFACE);
    const assetB = factory.getAnimatedSurface(AnimatedSurfaceId.TOXIC_POISON_SURFACE);

    expect(assetA).not.toBeNull();
    expect(assetA).toBe(assetB);
    expect(assetA).toMatchObject({
      id: AnimatedSurfaceId.TOXIC_POISON_SURFACE,
      fps: 12,
      loop: true,
      frameCount: 3,
      warningAlpha: 0.4,
      activeAlpha: 1,
    });
    expect(assetA?.projectedFrames).toHaveLength(3);
    expect(projectedInputs).toHaveLength(3);
    expect(projectedInputs[0].__drawSources).toHaveLength(72);
    expect(projectedInputs[0].__drawSources[0]).not.toBe(projectedInputs[1].__drawSources[0]);

    const sampledFrame = factory.getAnimatedSurfaceFrame(AnimatedSurfaceId.TOXIC_POISON_SURFACE, 0.2);
    expect(sampledFrame).toBe(assetA?.projectedFrames[2]);
  });
});
