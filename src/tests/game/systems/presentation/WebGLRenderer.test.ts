import { describe, expect, it } from "vitest";
import { WebGLRenderer } from "../../../../game/systems/presentation/backend/WebGLRenderer";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
import { buildDiamondSourceQuad, buildTrianglePairFromQuad } from "../../../../game/systems/presentation/renderCommandGeometry";
import { KindOrder } from "../../../../game/systems/presentation/worldRenderOrdering";

function makeFakeGl() {
  let textureId = 0;
  const drawOrder: string[] = [];
  const drawModes: number[] = [];
  const matrices: number[][] = [];
  const textureUploads: string[] = [];
  let currentTexture: any = null;
  return {
    drawOrder,
    drawModes,
    matrices,
    textureUploads,
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
      const label = source.getAttribute?.("data-label") ?? "unknown";
      if (currentTexture) currentTexture.label = label;
      textureUploads.push(label);
    },
    deleteTexture: () => {},
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

function makeChunkCanvas(label: string, width: number = 64, height: number = 32): any {
  return {
    width,
    height,
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
    semanticFamily: "worldSprite",
    finalForm: "quad",
    payload: {
      image,
      dx: stableId,
      dy: stableId,
      dw: 16,
      dh: 16,
    },
  } as RenderCommand;
}

function makeProjectedSurfaceCommand(image: any, stableId: number, offsetX: number = 0): RenderCommand {
  return {
    pass: "GROUND",
    key: {
      slice: 0,
      within: 0,
      baseZ: 0,
      kindOrder: KindOrder.FLOOR,
      stableId,
    },
    semanticFamily: "groundSurface",
    finalForm: "projectedSurface",
    payload: {
      image,
      sourceWidth: 128,
      sourceHeight: 64,
      triangles: buildTrianglePairFromQuad(buildDiamondSourceQuad(128, 64), {
        nw: { x: offsetX + 0, y: 0 },
        ne: { x: offsetX + 32, y: 0 },
        se: { x: offsetX + 16, y: 16 },
        sw: { x: offsetX - 16, y: 16 },
      }),
    },
  } as RenderCommand;
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
      semanticFamily: "worldGeometry",
      finalForm: "triangles",
      payload: {
        image,
        sourceWidth: 16,
        sourceHeight: 16,
        triangles: [
          {
            stableId: 1,
            srcPoints: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 0, y: 16 }],
            dstPoints: [{ x: 2, y: 2 }, { x: 18, y: 2 }, { x: 2, y: 18 }],
            alpha: 1,
          },
          {
            stableId: 2,
            srcPoints: [{ x: 16, y: 0 }, { x: 16, y: 16 }, { x: 0, y: 16 }],
            dstPoints: [{ x: 18, y: 2 }, { x: 18, y: 18 }, { x: 2, y: 18 }],
            alpha: 0.6,
          },
        ],
      },
    } as RenderCommand]);

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
    renderer.renderCommands([makeProjectedSurfaceCommand(image, 9)]);

    expect(gl.drawOrder).toEqual(["projected-ground"]);
    expect(gl.drawModes).toEqual([gl.TRIANGLES]);
  });

  it("renders cached ground chunks and skips covered ground commands", () => {
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
    const chunkCanvas = makeChunkCanvas("chunk-z0");

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands([
      makeProjectedSurfaceCommand(makeImage("covered-ground"), 9),
      makeCommand(makeImage("entity"), 10),
    ], {
      groundChunkCache: {
        generation: 1,
        getVisibleEntries: (zBand: number) => zBand === 0 ? [{
          zBand: 0,
          chunkX: 0,
          chunkY: 0,
          minTx: 0,
          maxTx: 1,
          minTy: 0,
          maxTy: 1,
          sortSlice: 0,
          sortWithin: 0,
          drawX: -32,
          drawY: -16,
          canvas: chunkCanvas,
        }] : [],
        hasCoveredStableId: (stableId: number) => stableId === 9,
      },
      viewRect: { minTx: -1, maxTx: 2, minTy: -1, maxTy: 2 },
      rampRoadTiles: new Set<string>(),
    });

    expect(gl.drawOrder).toEqual(["chunk-z0", "entity"]);
    expect(gl.drawModes).toEqual([gl.TRIANGLE_STRIP, gl.TRIANGLES]);
  });

  it("keeps chunk draw order aligned with z-band transitions", () => {
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
      makeProjectedSurfaceCommand(makeImage("covered-ground-z0"), 1, 0),
      makeCommand(makeImage("entity-z0"), 2),
      {
        ...makeProjectedSurfaceCommand(makeImage("covered-ground-z1"), 3, 40),
        key: {
          slice: 1,
          within: 0,
          baseZ: 1,
          kindOrder: KindOrder.FLOOR,
          stableId: 3,
        },
      } as RenderCommand,
      {
        ...makeCommand(makeImage("entity-z1"), 4),
        key: {
          slice: 1,
          within: 0,
          baseZ: 1,
          kindOrder: KindOrder.ENTITY,
          stableId: 4,
        },
      } as RenderCommand,
    ], {
      groundChunkCache: {
        generation: 1,
        getVisibleEntries: (zBand: number) => zBand === 0
          ? [{
            zBand: 0,
            chunkX: 0,
            chunkY: 0,
            minTx: 0,
            maxTx: 1,
            minTy: 0,
            maxTy: 1,
            sortSlice: 0,
            sortWithin: 0,
            drawX: -32,
            drawY: -16,
            canvas: makeChunkCanvas("chunk-z0"),
          }]
          : zBand === 1
            ? [{
              zBand: 1,
              chunkX: 0,
              chunkY: 0,
              minTx: 0,
              maxTx: 1,
              minTy: 0,
              maxTy: 1,
              sortSlice: 0,
              sortWithin: 0,
              drawX: -32,
              drawY: 16,
              canvas: makeChunkCanvas("chunk-z1"),
            }]
            : [],
        hasCoveredStableId: (stableId: number) => stableId === 1 || stableId === 3,
      },
      viewRect: { minTx: -1, maxTx: 2, minTy: -1, maxTy: 2 },
      rampRoadTiles: new Set<string>(),
    });

    expect(gl.drawOrder).toEqual(["chunk-z0", "entity-z0", "chunk-z1", "entity-z1"]);
  });

  it("does not redraw cached ground chunks for tail-stage world commands", () => {
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
    const chunkCanvas = makeChunkCanvas("chunk-z0");

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands([
      makeProjectedSurfaceCommand(makeImage("covered-ground"), 9),
      {
        pass: "WORLD",
        key: {
          slice: 0,
          within: 0,
          baseZ: 0,
          kindOrder: KindOrder.OVERLAY,
          stableId: 10,
        },
        semanticFamily: "screenOverlay",
        finalForm: "primitive",
        payload: {
          stage: "tail",
        },
      } as RenderCommand,
    ], {
      groundChunkCache: {
        generation: 1,
        getVisibleEntries: (zBand: number) => zBand === 0 ? [{
          zBand: 0,
          chunkX: 0,
          chunkY: 0,
          minTx: 0,
          maxTx: 1,
          minTy: 0,
          maxTy: 1,
          sortSlice: 0,
          sortWithin: 0,
          drawX: -32,
          drawY: -16,
          canvas: chunkCanvas,
        }] : [],
        hasCoveredStableId: (stableId: number) => stableId === 9,
      },
      viewRect: { minTx: -1, maxTx: 2, minTy: -1, maxTy: 2 },
      rampRoadTiles: new Set<string>(),
    });

    expect(gl.drawOrder).toEqual(["chunk-z0"]);
  });

  it("keeps uncovered projected surfaces on the legacy WebGL path", () => {
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
    const image = makeImage("uncovered-ground");

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands([makeProjectedSurfaceCommand(image, 9)], {
      groundChunkCache: {
        generation: 1,
        getVisibleEntries: () => [],
        hasCoveredStableId: () => false,
      },
      viewRect: { minTx: -1, maxTx: 2, minTy: -1, maxTy: 2 },
      rampRoadTiles: new Set<string>(),
    });

    expect(gl.drawOrder).toEqual(["uncovered-ground"]);
    expect(gl.drawModes).toEqual([gl.TRIANGLES]);
  });

  it("reuses chunk textures across frames and reuploads after cache invalidation", () => {
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
    const commands = [makeProjectedSurfaceCommand(makeImage("covered-ground"), 9)];
    const chunkGen1Canvas = makeChunkCanvas("chunk-gen1");
    const chunkGen2Canvas = makeChunkCanvas("chunk-gen2");

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands(commands, {
      groundChunkCache: {
        generation: 1,
        getVisibleEntries: () => [{
          zBand: 0,
          chunkX: 0,
          chunkY: 0,
          minTx: 0,
          maxTx: 1,
          minTy: 0,
          maxTy: 1,
          sortSlice: 0,
          sortWithin: 0,
          drawX: -32,
          drawY: -16,
          canvas: chunkGen1Canvas,
        }],
        hasCoveredStableId: () => true,
      },
      viewRect: { minTx: -1, maxTx: 2, minTy: -1, maxTy: 2 },
      rampRoadTiles: new Set<string>(),
    });

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands(commands, {
      groundChunkCache: {
        generation: 1,
        getVisibleEntries: () => [{
          zBand: 0,
          chunkX: 0,
          chunkY: 0,
          minTx: 0,
          maxTx: 1,
          minTy: 0,
          maxTy: 1,
          sortSlice: 0,
          sortWithin: 0,
          drawX: -32,
          drawY: -16,
          canvas: chunkGen1Canvas,
        }],
        hasCoveredStableId: () => true,
      },
      viewRect: { minTx: -1, maxTx: 2, minTy: -1, maxTy: 2 },
      rampRoadTiles: new Set<string>(),
    });

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands(commands, {
      groundChunkCache: {
        generation: 2,
        getVisibleEntries: () => [{
          zBand: 0,
          chunkX: 0,
          chunkY: 0,
          minTx: 0,
          maxTx: 1,
          minTy: 0,
          maxTy: 1,
          sortSlice: 0,
          sortWithin: 0,
          drawX: -32,
          drawY: -16,
          canvas: chunkGen2Canvas,
        }],
        hasCoveredStableId: () => true,
      },
      viewRect: { minTx: -1, maxTx: 2, minTy: -1, maxTy: 2 },
      rampRoadTiles: new Set<string>(),
    });

    expect(gl.textureUploads).toEqual(["chunk-gen1", "chunk-gen2"]);
  });

  it("batches adjacent compatible projected surfaces without changing stream order", () => {
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
    const image = makeImage("batched-ground");

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands([
      makeProjectedSurfaceCommand(image, 9, 0),
      makeProjectedSurfaceCommand(image, 10, 40),
    ]);

    expect(gl.drawOrder).toEqual(["batched-ground"]);
    expect(gl.drawModes).toEqual([gl.TRIANGLES]);
  });

  it("batches adjacent compatible world sprite quads into one ordered submission", () => {
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
    const image = makeImage("batched-sprite");

    renderer.beginFrame();
    renderer.useWorldSpace();
    renderer.renderCommands([
      makeCommand(image, 1),
      makeCommand(image, 2),
    ]);

    expect(gl.drawOrder).toEqual(["batched-sprite"]);
    expect(gl.drawModes).toEqual([gl.TRIANGLES]);
  });

  it("flushes ordered runs when texture compatibility breaks", () => {
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
      makeCommand(makeImage("a"), 1),
      makeCommand(makeImage("b"), 2),
      makeCommand(makeImage("a"), 3),
    ]);

    expect(gl.drawOrder).toEqual(["a", "b", "a"]);
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
