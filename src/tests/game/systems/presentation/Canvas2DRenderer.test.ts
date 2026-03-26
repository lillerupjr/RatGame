import { describe, expect, it, vi } from "vitest";
import { Canvas2DRenderer } from "../../../../game/systems/presentation/backend/Canvas2DRenderer";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
import type { RenderExecutionPlan } from "../../../../game/systems/presentation/backend/renderExecutionPlan";
import { buildDiamondSourceQuad, buildTrianglePairFromQuad } from "../../../../game/systems/presentation/renderCommandGeometry";
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

  it("renders projected ground surfaces through the canonical triangle path", () => {
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
      finalForm: "projectedSurface",
      payload: {
        image: { width: 128, height: 64 } as any,
        sourceWidth: 128,
        sourceHeight: 64,
        triangles: buildTrianglePairFromQuad(buildDiamondSourceQuad(128, 64), {
          nw: { x: 0, y: 0 },
          ne: { x: 32, y: 0 },
          se: { x: 16, y: 16 },
          sw: { x: -16, y: 16 },
        }),
      },
    } as RenderCommand]);

    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    expect(ctx.transform).toHaveBeenCalledTimes(2);
    expect(overlayCtx.drawImage).not.toHaveBeenCalled();
  });
});
