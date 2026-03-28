import { describe, expect, it, vi } from "vitest";
import { Canvas2DRenderer } from "../../../../engine/render/auxiliary/auxiliaryCanvasRenderer";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
import type { RenderExecutionPlan } from "../../../../game/systems/presentation/backend/renderExecutionPlan";
import {
  buildProjectedSurfacePayload,
  buildQuadRenderPieceFromPoints,
} from "../../../../game/systems/presentation/renderCommandGeometry";
import { KindOrder } from "../../../../game/systems/presentation/worldRenderOrdering";

type FakeCtx = CanvasRenderingContext2D & {
  fillRect: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  clip: ReturnType<typeof vi.fn>;
  transform: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  ellipse: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  strokeText: ReturnType<typeof vi.fn>;
  setLineDash: ReturnType<typeof vi.fn>;
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
  globalCompositeOperation: string;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  lineDashOffset: number;
  canvas: { width: number; height: number };
};

function makeCtx(width: number, height: number): FakeCtx {
  return {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    transform: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    setLineDash: vi.fn(),
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    globalCompositeOperation: "source-over",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    lineDashOffset: 0,
    canvas: { width, height },
  } as unknown as FakeCtx;
}

function command(
  stableId: number,
  input: Omit<RenderCommand, "pass" | "key"> & { pass?: RenderCommand["pass"] },
): RenderCommand {
  return {
    pass: input.pass ?? "WORLD",
    key: {
      slice: 0,
      within: 0,
      baseZ: 0,
      kindOrder: KindOrder.ENTITY,
      stableId,
    },
    ...input,
  } as RenderCommand;
}

function makeProjectedGroundPayload(image: any, offsetX = 0) {
  return buildProjectedSurfacePayload({
    image,
    destinationQuad: {
      nw: { x: offsetX + 0, y: 0 },
      ne: { x: offsetX + 32, y: 0 },
      se: { x: offsetX + 16, y: 16 },
      sw: { x: offsetX - 16, y: 16 },
    },
  });
}

function makeStructureIsoQuadPayload(image: any, alpha = 1) {
  return buildQuadRenderPieceFromPoints({
    auditFamily: "structures",
    image,
    sx: 0,
    sy: 0,
    sw: 128,
    sh: 64,
    destinationQuad: {
      nw: { x: 10, y: 10 },
      ne: { x: 30, y: 10 },
      se: { x: 20, y: 24 },
      sw: { x: 0, y: 24 },
    },
    kind: "iso",
    alpha,
  });
}

describe("Canvas2DRenderer", () => {
  it("keeps world rendering on the main canvas while screen overlays render on the overlay canvas", () => {
    const ctx = makeCtx(320, 180);
    const overlayCtx = makeCtx(320, 180);
    const renderer = new Canvas2DRenderer({
      world: {} as any,
      ctx,
      canvas: { width: 320, height: 180 } as any,
      overlayCtx,
      overlayCanvas: { width: 320, height: 180 } as any,
      hasUiOverlay: true,
      cssW: 320,
      cssH: 180,
      screenW: 320,
      screenH: 180,
      devW: 320,
      devH: 180,
      dpr: 1,
      overlayDevW: 320,
      overlayDevH: 180,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        applyWorld: vi.fn(),
      } as any,
      zoom: 1,
      worldWidth: 320,
      worldHeight: 180,
      scaledW: 320,
      scaledH: 180,
      safeOffsetX: 0,
      safeOffsetY: 0,
      playerWorldX: 0,
      playerWorldY: 0,
      playerTileX: 0,
      playerTileY: 0,
      cameraProjectedX: 0,
      cameraProjectedY: 0,
      camTx: 0,
      camTy: 0,
      worldScaleDevice: 1,
      renderSettings: {},
    } as any, {
      renderAmbientDarknessOverlay: vi.fn(),
      setRenderPerfDrawTag: vi.fn(),
    } as any);

    const image = { width: 16, height: 16 } as any;
    const plan: RenderExecutionPlan = {
      world: [
        command(1, {
          semanticFamily: "worldSprite",
          finalForm: "quad",
          payload: {
            image,
            dx: 10,
            dy: 12,
            dw: 16,
            dh: 16,
            alpha: 1,
          },
        }),
      ],
      screen: [
        command(2, {
          pass: "SCREEN",
          semanticFamily: "screenOverlay",
          finalForm: "quad",
          payload: {
            color: "#000",
            alpha: 0.5,
            width: 320,
            height: 180,
          },
        }),
      ],
    };

    renderer.render(plan);

    expect(ctx.drawImage).toHaveBeenCalled();
    expect(overlayCtx.drawImage).not.toHaveBeenCalled();
    expect(overlayCtx.fillRect).toHaveBeenCalledWith(0, 0, 320, 180);
  });

  it("renders projected ground surfaces through the quad-native iso path", () => {
    const ctx = makeCtx(320, 180);
    const overlayCtx = makeCtx(320, 180);
    const renderer = new Canvas2DRenderer({
      world: {} as any,
      ctx,
      canvas: { width: 320, height: 180 } as any,
      overlayCtx,
      overlayCanvas: { width: 320, height: 180 } as any,
      hasUiOverlay: true,
      cssW: 320,
      cssH: 180,
      screenW: 320,
      screenH: 180,
      devW: 320,
      devH: 180,
      dpr: 1,
      overlayDevW: 320,
      overlayDevH: 180,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        applyWorld: vi.fn(),
      } as any,
      zoom: 1,
      worldWidth: 320,
      worldHeight: 180,
      scaledW: 320,
      scaledH: 180,
      safeOffsetX: 0,
      safeOffsetY: 0,
      playerWorldX: 0,
      playerWorldY: 0,
      playerTileX: 0,
      playerTileY: 0,
      cameraProjectedX: 0,
      cameraProjectedY: 0,
      camTx: 0,
      camTy: 0,
      worldScaleDevice: 1,
      renderSettings: {},
    } as any, {
      renderAmbientDarknessOverlay: vi.fn(),
      setRenderPerfDrawTag: vi.fn(),
    } as any);

    renderer.renderWorldCommands([{
      pass: "GROUND",
      key: {
        slice: 0,
        within: 0,
        baseZ: 0,
        kindOrder: KindOrder.FLOOR,
        stableId: 3,
      },
      semanticFamily: "groundSurface",
      finalForm: "quad",
      payload: makeProjectedGroundPayload({ width: 128, height: 64 } as any),
    } as RenderCommand]);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.transform).toHaveBeenCalledTimes(1);
    expect(overlayCtx.drawImage).not.toHaveBeenCalled();
  });

  it("renders simple quad sprites without an extra per-draw save/restore", () => {
    const ctx = makeCtx(320, 180);
    const overlayCtx = makeCtx(320, 180);
    const renderer = new Canvas2DRenderer({
      world: {} as any,
      ctx,
      canvas: { width: 320, height: 180 } as any,
      overlayCtx,
      overlayCanvas: { width: 320, height: 180 } as any,
      hasUiOverlay: true,
      cssW: 320,
      cssH: 180,
      screenW: 320,
      screenH: 180,
      devW: 320,
      devH: 180,
      dpr: 1,
      overlayDevW: 320,
      overlayDevH: 180,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        applyWorld: vi.fn(),
      } as any,
      zoom: 1,
      worldWidth: 320,
      worldHeight: 180,
      scaledW: 320,
      scaledH: 180,
      safeOffsetX: 0,
      safeOffsetY: 0,
      playerWorldX: 0,
      playerWorldY: 0,
      playerTileX: 0,
      playerTileY: 0,
      cameraProjectedX: 0,
      cameraProjectedY: 0,
      camTx: 0,
      camTy: 0,
      worldScaleDevice: 1,
      renderSettings: {},
    } as any, {
      renderAmbientDarknessOverlay: vi.fn(),
      setRenderPerfDrawTag: vi.fn(),
    } as any);

    renderer.renderWorldCommands([{
      pass: "WORLD",
      key: {
        slice: 0,
        within: 0,
        baseZ: 0,
        kindOrder: KindOrder.ENTITY,
        stableId: 11,
      },
      semanticFamily: "worldSprite",
      finalForm: "quad",
      payload: {
        image: { width: 16, height: 16 } as any,
        sx: 0,
        sy: 0,
        sw: 16,
        sh: 16,
        dx: 12,
        dy: 18,
        dw: 16,
        dh: 16,
        alpha: 0.75,
      },
    } as RenderCommand]);

    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("tags world sprite draws as entities and structure quads as live structures", () => {
    const ctx = makeCtx(320, 180);
    const overlayCtx = makeCtx(320, 180);
    const setRenderPerfDrawTag = vi.fn();
    const renderer = new Canvas2DRenderer({
      world: {} as any,
      ctx,
      canvas: { width: 320, height: 180 } as any,
      overlayCtx,
      overlayCanvas: { width: 320, height: 180 } as any,
      hasUiOverlay: true,
      cssW: 320,
      cssH: 180,
      screenW: 320,
      screenH: 180,
      devW: 320,
      devH: 180,
      dpr: 1,
      overlayDevW: 320,
      overlayDevH: 180,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        applyWorld: vi.fn(),
      } as any,
      zoom: 1,
      worldWidth: 320,
      worldHeight: 180,
      scaledW: 320,
      scaledH: 180,
      safeOffsetX: 0,
      safeOffsetY: 0,
      playerWorldX: 0,
      playerWorldY: 0,
      playerTileX: 0,
      playerTileY: 0,
      cameraProjectedX: 0,
      cameraProjectedY: 0,
      camTx: 0,
      camTy: 0,
      worldScaleDevice: 1,
      renderSettings: {},
    } as any, {
      renderAmbientDarknessOverlay: vi.fn(),
      setRenderPerfDrawTag,
    } as any);

    renderer.renderWorldCommands([
      command(1, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: {
          image: { width: 16, height: 16 } as any,
          dx: 10,
          dy: 10,
          dw: 16,
          dh: 16,
        },
      }),
      command(2, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: makeStructureIsoQuadPayload({ width: 128, height: 64 } as any),
      }),
    ]);

    expect(setRenderPerfDrawTag).toHaveBeenCalledWith("entities");
    expect(setRenderPerfDrawTag).toHaveBeenCalledWith("structures:live");
  });

  it("tags floating text screen overlay draws as entities", () => {
    const ctx = makeCtx(320, 180);
    const overlayCtx = makeCtx(320, 180);
    const setRenderPerfDrawTag = vi.fn();
    const renderer = new Canvas2DRenderer({
      world: {
        floatTextX: [10],
        floatTextY: [20],
        floatTextTtl: [0.4],
        floatTextValue: [7],
        floatTextColor: ["#fff"],
        floatTextSize: [12],
        floatTextIsCrit: [false],
        floatTextIsPlayer: [false],
      } as any,
      ctx,
      canvas: { width: 320, height: 180 } as any,
      overlayCtx,
      overlayCanvas: { width: 320, height: 180 } as any,
      hasUiOverlay: true,
      cssW: 320,
      cssH: 180,
      screenW: 320,
      screenH: 180,
      devW: 320,
      devH: 180,
      dpr: 1,
      overlayDevW: 320,
      overlayDevH: 180,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        applyWorld: vi.fn(),
      } as any,
      zoom: 1,
      worldWidth: 320,
      worldHeight: 180,
      scaledW: 320,
      scaledH: 180,
      safeOffsetX: 0,
      safeOffsetY: 0,
      playerWorldX: 0,
      playerWorldY: 0,
      playerTileX: 0,
      playerTileY: 0,
      cameraProjectedX: 0,
      cameraProjectedY: 0,
      camTx: 0,
      camTy: 0,
      worldScaleDevice: 1,
      renderSettings: {},
    } as any, {
      renderAmbientDarknessOverlay: vi.fn(),
      setRenderPerfDrawTag,
      toScreen: vi.fn((x: number, y: number) => ({ x, y })),
      w: {
        floatTextX: [10],
        floatTextY: [20],
        floatTextTtl: [0.4],
        floatTextValue: [7],
        floatTextColor: ["#fff"],
        floatTextSize: [12],
        floatTextIsCrit: [false],
        floatTextIsPlayer: [false],
      },
    } as any);

    renderer.renderScreenCommands([
      command(3, {
        pass: "WORLD",
        semanticFamily: "screenOverlay",
        finalForm: "primitive",
        payload: {},
      }),
    ]);

    expect(setRenderPerfDrawTag).toHaveBeenCalledWith("entities");
  });

  it("applies triangle alpha without an extra outer save/restore", () => {
    const ctx = makeCtx(320, 180);
    const overlayCtx = makeCtx(320, 180);
    const renderer = new Canvas2DRenderer({
      world: {} as any,
      ctx,
      canvas: { width: 320, height: 180 } as any,
      overlayCtx,
      overlayCanvas: { width: 320, height: 180 } as any,
      hasUiOverlay: true,
      cssW: 320,
      cssH: 180,
      screenW: 320,
      screenH: 180,
      devW: 320,
      devH: 180,
      dpr: 1,
      overlayDevW: 320,
      overlayDevH: 180,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        applyWorld: vi.fn(),
      } as any,
      zoom: 1,
      worldWidth: 320,
      worldHeight: 180,
      scaledW: 320,
      scaledH: 180,
      safeOffsetX: 0,
      safeOffsetY: 0,
      playerWorldX: 0,
      playerWorldY: 0,
      playerTileX: 0,
      playerTileY: 0,
      cameraProjectedX: 0,
      cameraProjectedY: 0,
      camTx: 0,
      camTy: 0,
      worldScaleDevice: 1,
      renderSettings: {},
    } as any, {
      renderAmbientDarknessOverlay: vi.fn(),
      setRenderPerfDrawTag: vi.fn(),
    } as any);

    renderer.renderWorldCommands([{
      pass: "WORLD",
      key: {
        slice: 0,
        within: 0,
        baseZ: 0,
        kindOrder: KindOrder.STRUCTURE,
        stableId: 12,
      },
      semanticFamily: "worldSprite",
      finalForm: "quad",
      payload: makeStructureIsoQuadPayload({ width: 128, height: 64 } as any, 0.5),
    } as RenderCommand]);

    expect(ctx.save).toHaveBeenCalledTimes(2);
    expect(ctx.restore).toHaveBeenCalledTimes(2);
    expect(ctx.clip).toHaveBeenCalledTimes(1);
  });

  it("draws cached ground chunks and skips covered ground commands in the world stream", () => {
    const ctx = makeCtx(320, 180);
    const overlayCtx = makeCtx(320, 180);
    const cachedGroundImage = { width: 128, height: 64, id: "cached-ground" } as any;
    const renderer = new Canvas2DRenderer({
      world: {} as any,
      ctx,
      canvas: { width: 320, height: 180 } as any,
      overlayCtx,
      overlayCanvas: { width: 320, height: 180 } as any,
      hasUiOverlay: true,
      cssW: 320,
      cssH: 180,
      screenW: 320,
      screenH: 180,
      devW: 320,
      devH: 180,
      dpr: 1,
      overlayDevW: 320,
      overlayDevH: 180,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        applyWorld: vi.fn(),
      } as any,
      zoom: 1,
      worldWidth: 320,
      worldHeight: 180,
      scaledW: 320,
      scaledH: 180,
      safeOffsetX: 0,
      safeOffsetY: 0,
      playerWorldX: 0,
      playerWorldY: 0,
      playerTileX: 0,
      playerTileY: 0,
      cameraProjectedX: 0,
      cameraProjectedY: 0,
      camTx: 0,
      camTy: 0,
      worldScaleDevice: 1,
      renderSettings: {},
    } as any, {
      w: {
        floatTextX: [],
        floatTextY: [],
        floatTextText: [],
        floatTextColor: [],
        floatTextTtl: [],
        floatTextVy: [],
      },
      renderAmbientDarknessOverlay: vi.fn(),
      setRenderPerfDrawTag: vi.fn(),
      countRenderCanvasGroundChunkDraw: vi.fn(),
      countRenderCanvasGroundChunksVisible: vi.fn(),
      viewRect: { minTx: -2, maxTx: 2, minTy: -2, maxTy: 2 },
      groundChunkCache: {
        getVisibleEntries: vi.fn(() => [{
          minTx: -1,
          maxTx: 1,
          minTy: -1,
          maxTy: 1,
        }]),
        getVisibleCommands: vi.fn(() => [{
          pass: "GROUND",
          key: {
            slice: 0,
            within: 0,
            baseZ: 0,
            kindOrder: KindOrder.FLOOR,
            stableId: 700,
          },
          semanticFamily: "groundSurface",
          finalForm: "quad",
          payload: makeProjectedGroundPayload(cachedGroundImage),
        }]),
        hasCoveredStableId: vi.fn((stableId: number) => stableId === 7),
      },
      rampRoadTiles: new Set<string>(),
    } as any);

    renderer.renderWorldCommands([{
      pass: "GROUND",
      key: {
        slice: 0,
        within: 0,
        baseZ: 0,
        kindOrder: KindOrder.FLOOR,
        stableId: 7,
      },
      semanticFamily: "groundSurface",
      finalForm: "quad",
      payload: makeProjectedGroundPayload({ width: 128, height: 64 } as any),
    } as RenderCommand]);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage.mock.calls[0][0]).toBe(cachedGroundImage);
    expect(ctx.transform).toHaveBeenCalledTimes(1);
  });

  it("does not redraw cached ground chunks for tail-stage world commands", () => {
    const ctx = makeCtx(320, 180);
    const overlayCtx = makeCtx(320, 180);
    const cachedGroundImage = { width: 128, height: 64, id: "cached-ground" } as any;
    const renderer = new Canvas2DRenderer({
      world: {} as any,
      ctx,
      canvas: { width: 320, height: 180 } as any,
      overlayCtx,
      overlayCanvas: { width: 320, height: 180 } as any,
      hasUiOverlay: true,
      cssW: 320,
      cssH: 180,
      screenW: 320,
      screenH: 180,
      devW: 320,
      devH: 180,
      dpr: 1,
      overlayDevW: 320,
      overlayDevH: 180,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        applyWorld: vi.fn(),
      } as any,
      zoom: 1,
      worldWidth: 320,
      worldHeight: 180,
      scaledW: 320,
      scaledH: 180,
      safeOffsetX: 0,
      safeOffsetY: 0,
      playerWorldX: 0,
      playerWorldY: 0,
      playerTileX: 0,
      playerTileY: 0,
      cameraProjectedX: 0,
      cameraProjectedY: 0,
      camTx: 0,
      camTy: 0,
      worldScaleDevice: 1,
      renderSettings: {},
    } as any, {
      w: {
        floatTextX: [],
        floatTextY: [],
        floatTextText: [],
        floatTextColor: [],
        floatTextTtl: [],
        floatTextVy: [],
      },
      renderAmbientDarknessOverlay: vi.fn(),
      setRenderPerfDrawTag: vi.fn(),
      countRenderCanvasGroundChunkDraw: vi.fn(),
      countRenderCanvasGroundChunksVisible: vi.fn(),
      viewRect: { minTx: -2, maxTx: 2, minTy: -2, maxTy: 2 },
      groundChunkCache: {
        getVisibleEntries: vi.fn(() => [{
          minTx: -1,
          maxTx: 1,
          minTy: -1,
          maxTy: 1,
        }]),
        getVisibleCommands: vi.fn(() => [{
          pass: "GROUND",
          key: {
            slice: 0,
            within: 0,
            baseZ: 0,
            kindOrder: KindOrder.FLOOR,
            stableId: 701,
          },
          semanticFamily: "groundSurface",
          finalForm: "quad",
          payload: makeProjectedGroundPayload(cachedGroundImage),
        }]),
        hasCoveredStableId: vi.fn(() => false),
      },
      rampRoadTiles: new Set<string>(),
    } as any);

    renderer.renderWorldCommands([
      {
        pass: "GROUND",
        key: {
          slice: 0,
          within: 0,
          baseZ: 1,
          kindOrder: KindOrder.FLOOR,
          stableId: 1,
        },
        semanticFamily: "groundSurface",
        finalForm: "quad",
        payload: {
          stage: "slice",
          ...makeProjectedGroundPayload({ width: 128, height: 64 } as any),
        },
      } as RenderCommand,
      {
        pass: "WORLD",
        key: {
          slice: 0,
          within: 0,
          baseZ: 0,
          kindOrder: KindOrder.OVERLAY,
          stableId: 2,
        },
        semanticFamily: "screenOverlay",
        finalForm: "primitive",
        payload: {
          stage: "tail",
        },
      } as RenderCommand,
    ]);

    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    expect(ctx.drawImage.mock.calls.filter((call) => call[0] === cachedGroundImage)).toHaveLength(1);
  });
});
