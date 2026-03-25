import { describe, expect, it } from "vitest";
import { WebGLRenderer } from "../../../../game/systems/presentation/backend/WebGLRenderer";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
import { KindOrder } from "../../../../game/systems/presentation/worldRenderOrdering";

function makeFakeGl() {
  let textureId = 0;
  const drawOrder: string[] = [];
  const drawModes: number[] = [];
  const matrices: number[][] = [];
  let currentTexture: any = null;
  return {
    drawOrder,
    drawModes,
    matrices,
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    ARRAY_BUFFER: 0x8892,
    FLOAT: 0x1406,
    TEXTURE_2D: 0x0DE1,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    CLAMP_TO_EDGE: 0x812F,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    NEAREST: 0x2600,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_TEST: 0x0B71,
    BLEND: 0x0BE2,
    SRC_ALPHA: 0x0302,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    TRIANGLES: 0x0004,
    TRIANGLE_STRIP: 0x0005,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    TEXTURE0: 0x84C0,
    STREAM_DRAW: 0x88E0,
    canvas: { width: 100, height: 100 },
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => "",
    deleteShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => "",
    deleteProgram: () => {},
    createBuffer: () => ({}),
    createTexture: () => ({ id: ++textureId }),
    getAttribLocation: (_program: unknown, name: string) => (name === "a_position" ? 0 : 1),
    getUniformLocation: () => ({}),
    useProgram: () => {},
    bindBuffer: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    uniform1i: () => {},
    bindTexture: (_target: unknown, texture: any) => {
      currentTexture = texture;
    },
    texParameteri: () => {},
    viewport: () => {},
    disable: () => {},
    enable: () => {},
    clearColor: () => {},
    clear: () => {},
    uniformMatrix3fv: (_location: unknown, _transpose: unknown, value: ArrayLike<number>) => {
      matrices.push(Array.from(value));
    },
    uniform4f: () => {},
    activeTexture: () => {},
    texImage2D: (_target: unknown, _level: unknown, _internal: unknown, _format: unknown, _type: unknown, source: any) => {
      if (currentTexture) currentTexture.label = source.getAttribute?.("data-label") ?? "unknown";
    },
    uniform1f: () => {},
    bufferData: () => {},
    blendFunc: () => {},
    blendFuncSeparate: () => {},
    drawArrays: (mode: number) => {
      drawModes.push(mode);
      drawOrder.push(currentTexture?.label ?? "unknown");
    },
  } as any;
}

function makeImage(label: string): any {
  return {
    width: 16,
    height: 16,
    getAttribute: (name: string) => (name === "data-label" ? label : null),
  };
}

function makeCommand(image: any, stableId: number): RenderCommand {
  return {
    pass: "WORLD",
    key: {
      slice: 0,
      within: 0,
      baseZ: 0,
      kindOrder: KindOrder.ENTITY,
      stableId,
    },
    kind: "sprite",
    data: {
      variant: "imageSprite",
      image,
      dx: stableId,
      dy: stableId,
      dw: 16,
      dh: 16,
    },
  };
}

describe("WebGLRenderer", () => {
  it("renders commands in input order without internal sorting", () => {
    const gl = makeFakeGl();
    const renderer = new WebGLRenderer({
      world: {} as any,
      ctx: {} as any,
      canvas: gl.canvas,
      overlayCtx: {} as any,
      overlayCanvas: { width: 100, height: 100 } as any,
      hasUiOverlay: true,
      cssW: 100,
      cssH: 100,
      screenW: 100,
      screenH: 100,
      devW: 100,
      devH: 100,
      dpr: 1,
      overlayDevW: 100,
      overlayDevH: 100,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        worldScaleDevice: 1,
        camTx: 0,
        camTy: 0,
        safeOffsetDeviceX: 0,
        safeOffsetDeviceY: 0,
      } as any,
      zoom: 1,
      worldWidth: 100,
      worldHeight: 100,
      scaledW: 100,
      scaledH: 100,
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
    }, gl);

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands([
      makeCommand(makeImage("second"), 2),
      makeCommand(makeImage("first"), 1),
    ]);

    expect(gl.drawOrder).toEqual(["second", "first"]);
  });

  it("renders structure triangle groups through the WebGL triangle path", () => {
    const gl = makeFakeGl();
    const renderer = new WebGLRenderer({
      world: {} as any,
      ctx: {} as any,
      canvas: gl.canvas,
      overlayCtx: {} as any,
      overlayCanvas: { width: 100, height: 100 } as any,
      hasUiOverlay: true,
      cssW: 100,
      cssH: 100,
      screenW: 100,
      screenH: 100,
      devW: 100,
      devH: 100,
      dpr: 1,
      overlayDevW: 100,
      overlayDevH: 100,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        worldScaleDevice: 1,
        camTx: 0,
        camTy: 0,
        safeOffsetDeviceX: 0,
        safeOffsetDeviceY: 0,
      } as any,
      zoom: 1,
      worldWidth: 100,
      worldHeight: 100,
      scaledW: 100,
      scaledH: 100,
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
    }, gl);
    const image = makeImage("structure-triangle");

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands([{
      pass: "WORLD",
      key: {
        slice: 0,
        within: 0,
        baseZ: 0,
        kindOrder: KindOrder.STRUCTURE,
        stableId: 7,
      },
      kind: "triangle",
      data: {
        variant: "structureTriangleGroup",
        image,
        drawWidth: 16,
        drawHeight: 16,
        compareDistanceOnlyStableIds: [],
        cutoutEnabled: true,
        cutoutAlpha: 0.6,
        buildingDirectionalEligible: true,
        groupParentAfterPlayer: true,
        cutoutScreenRect: {
          minX: 0,
          minY: 0,
          maxX: 20,
          maxY: 20,
        },
        finalVisibleTriangles: [
          {
            stableId: 1,
            srcPoints: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 0, y: 16 }],
            points: [{ x: 2, y: 2 }, { x: 18, y: 2 }, { x: 2, y: 18 }],
          },
          {
            stableId: 2,
            srcPoints: [{ x: 16, y: 0 }, { x: 16, y: 16 }, { x: 0, y: 16 }],
            points: [{ x: 18, y: 2 }, { x: 18, y: 18 }, { x: 2, y: 18 }],
          },
        ],
      },
    }]);

    expect(gl.drawOrder).toEqual(["structure-triangle", "structure-triangle"]);
    expect(gl.drawModes).toEqual([gl.TRIANGLES, gl.TRIANGLES]);
  });

  it("renders projected ground decals through the WebGL triangle path", () => {
    const gl = makeFakeGl();
    const renderer = new WebGLRenderer({
      world: {} as any,
      ctx: {} as any,
      canvas: gl.canvas,
      overlayCtx: {} as any,
      overlayCanvas: { width: 100, height: 100 } as any,
      hasUiOverlay: true,
      cssW: 100,
      cssH: 100,
      screenW: 100,
      screenH: 100,
      devW: 100,
      devH: 100,
      dpr: 1,
      overlayDevW: 100,
      overlayDevH: 100,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        worldScaleDevice: 1,
        camTx: 0,
        camTy: 0,
        safeOffsetDeviceX: 0,
        safeOffsetDeviceY: 0,
      } as any,
      zoom: 1,
      worldWidth: 100,
      worldHeight: 100,
      scaledW: 100,
      scaledH: 100,
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
    }, gl);
    const image = makeImage("projected-ground");

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands([{
      pass: "GROUND",
      key: {
        slice: 0,
        within: 0,
        baseZ: 0,
        kindOrder: KindOrder.FLOOR,
        stableId: 9,
      },
      kind: "decal",
      data: {
        variant: "runtimeSidewalkTop",
        mode: "projected",
        image,
        sourceWidth: 128,
        sourceHeight: 64,
        finalVisibleTriangles: [
          {
            srcPoints: [{ x: 64, y: 0 }, { x: 128, y: 32 }, { x: 64, y: 64 }],
            points: [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 16, y: 16 }],
          },
          {
            srcPoints: [{ x: 64, y: 0 }, { x: 64, y: 64 }, { x: 0, y: 32 }],
            points: [{ x: 0, y: 0 }, { x: 16, y: 16 }, { x: -16, y: 16 }],
          },
        ],
      },
    }]);

    expect(gl.drawOrder).toEqual(["projected-ground", "projected-ground"]);
    expect(gl.drawModes).toEqual([gl.TRIANGLES, gl.TRIANGLES]);
  });

  it("refreshes world matrices when the frame context changes between frames", () => {
    const gl = makeFakeGl();
    const renderer = new WebGLRenderer({
      world: {} as any,
      ctx: {} as any,
      canvas: gl.canvas,
      overlayCtx: {} as any,
      overlayCanvas: { width: 100, height: 100 } as any,
      hasUiOverlay: true,
      cssW: 100,
      cssH: 100,
      screenW: 100,
      screenH: 100,
      devW: 100,
      devH: 100,
      dpr: 1,
      overlayDevW: 100,
      overlayDevH: 100,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        worldScaleDevice: 1,
        camTx: 0,
        camTy: 0,
        safeOffsetDeviceX: 0,
        safeOffsetDeviceY: 0,
      } as any,
      zoom: 1,
      worldWidth: 100,
      worldHeight: 100,
      scaledW: 100,
      scaledH: 100,
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
    }, gl);

    renderer.beginFrame();
    renderer.useWorldSpace();
    const firstWorldMatrix = gl.matrices[gl.matrices.length - 1];

    renderer.setFrameContext({
      world: {} as any,
      ctx: {} as any,
      canvas: gl.canvas,
      overlayCtx: {} as any,
      overlayCanvas: { width: 100, height: 100 } as any,
      hasUiOverlay: true,
      cssW: 100,
      cssH: 100,
      screenW: 100,
      screenH: 100,
      devW: 100,
      devH: 100,
      dpr: 1,
      overlayDevW: 100,
      overlayDevH: 100,
      overlayDpr: 1,
      visibleVerticalTiles: 10,
      viewport: {
        worldScaleDevice: 1,
        camTx: 24,
        camTy: 12,
        safeOffsetDeviceX: 0,
        safeOffsetDeviceY: 0,
      } as any,
      zoom: 1,
      worldWidth: 100,
      worldHeight: 100,
      scaledW: 100,
      scaledH: 100,
      safeOffsetX: 0,
      safeOffsetY: 0,
      playerWorldX: 0,
      playerWorldY: 0,
      playerTileX: 0,
      playerTileY: 0,
      cameraProjectedX: 24,
      cameraProjectedY: 12,
      camTx: 24,
      camTy: 12,
      worldScaleDevice: 1,
      renderSettings: {},
    });
    renderer.beginFrame();
    renderer.useWorldSpace();
    const secondWorldMatrix = gl.matrices[gl.matrices.length - 1];

    expect(secondWorldMatrix).not.toEqual(firstWorldMatrix);
  });
});
