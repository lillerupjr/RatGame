import { ZONE_KIND } from "../../../factories/zoneFactory";
import type { ViewRect } from "../../../map/compile/kenneyMap";
import type { RenderFrameContext } from "../contracts/renderFrameContext";
import type { RenderCommand } from "../contracts/renderCommands";
import type { CanvasGroundChunkCacheStore } from "../canvasGroundChunkCache";
import { resolveProjectedLightTintSprite } from "../renderLighting";
import {
  countRenderWebGLBatch,
  countRenderWebGLBufferUpload,
  countRenderWebGLCanvasComposite,
  countRenderWebGLDrawCall,
  countRenderWebGLGroundChunkDraw,
  countRenderWebGLGroundChunksVisible,
  countRenderWebGLProjectedSurfaceDraw,
  countRenderWebGLTextureBind,
  countRenderWebGLTrianglesSubmitted,
  noteRenderWebGLTextureUsage,
} from "../renderPerfCounters";
import { isStableTextureSource } from "../stableTextureSource";
import { resolveRenderZBand } from "../worldRenderOrdering";

type BlendMode = "normal" | "additive";
type QuadSpace = "world" | "screen";
type ColorRgba = [number, number, number, number];
type TrianglePoint = { x: number; y: number };
type QuadPointStrip = [TrianglePoint, TrianglePoint, TrianglePoint, TrianglePoint];

type QuadDraw = {
  image: TexImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  points: QuadPointStrip;
  texPoints: QuadPointStrip;
  alpha: number;
  blendMode: BlendMode;
  color: ColorRgba;
  space: QuadSpace;
};

type BatchTriangle = {
  image: TexImageSource;
  positions: [TrianglePoint, TrianglePoint, TrianglePoint];
  texCoords: [TrianglePoint, TrianglePoint, TrianglePoint];
  blendMode: BlendMode;
  color: ColorRgba;
  space: QuadSpace;
};

type OrderedTriangleBatch = {
  image: TexImageSource;
  blendMode: BlendMode;
  space: QuadSpace;
  positions: number[];
  texCoords: number[];
  colors: number[];
  triangleCount: number;
};

type CachedTexture = {
  texture: WebGLTexture;
  width: number;
  height: number;
};

type GroundChunkRenderContext = {
  groundChunkCache: Pick<CanvasGroundChunkCacheStore, "getVisibleEntries" | "getVisibleCommands" | "hasCoveredStableId">;
  viewRect: ViewRect;
  rampRoadTiles: ReadonlySet<string>;
};

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;
uniform mat3 u_matrix;
varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
  vec3 clip = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_texCoord = a_texCoord;
  v_color = a_color;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform sampler2D u_texture;
varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  gl_FragColor = vec4(color.rgb * v_color.rgb, color.a * v_color.a);
}
`;

function createBackendCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    throw new Error("WebGL backend texture generation requires DOM canvas support.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function hexPair(value: string): number {
  return parseInt(value, 16) / 255;
}

function parseColorToRgba01(input: string | undefined): ColorRgba {
  const color = `${input ?? "#ffffff"}`.trim();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return [
      hexPair(color[1] + color[1]),
      hexPair(color[2] + color[2]),
      hexPair(color[3] + color[3]),
      1,
    ];
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return [
      hexPair(color.slice(1, 3)),
      hexPair(color.slice(3, 5)),
      hexPair(color.slice(5, 7)),
      1,
    ];
  }
  const rgbaMatch = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(",").map((part) => Number(part.trim()));
    const r = Math.max(0, Math.min(255, parts[0] ?? 255)) / 255;
    const g = Math.max(0, Math.min(255, parts[1] ?? 255)) / 255;
    const b = Math.max(0, Math.min(255, parts[2] ?? 255)) / 255;
    const a = Math.max(0, Math.min(1, parts[3] ?? 1));
    return [r, g, b, a];
  }
  return [1, 1, 1, 1];
}

function withEffectiveAlpha(color: ColorRgba, alpha: number): ColorRgba {
  const clampedAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  return [
    color[0],
    color[1],
    color[2],
    Math.max(0, Math.min(1, color[3] * clampedAlpha)),
  ];
}

let whiteTextureCanvas: HTMLCanvasElement | null = null;
let radialMaskCanvas: HTMLCanvasElement | null = null;
let ringMaskCanvas: HTMLCanvasElement | null = null;

const MAX_BATCH_TRIANGLES = 2048;
const EMPTY_RAMP_ROAD_TILES = new Set<string>();

function getWhiteTextureCanvas(): HTMLCanvasElement {
  if (whiteTextureCanvas) return whiteTextureCanvas;
  const canvas = createBackendCanvas(1, 1);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create white texture canvas.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 1, 1);
  whiteTextureCanvas = canvas;
  return canvas;
}

function getRadialMaskCanvas(): HTMLCanvasElement {
  if (radialMaskCanvas) return radialMaskCanvas;
  const canvas = createBackendCanvas(256, 256);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create radial mask canvas.");
  const radius = 128;
  const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();
  radialMaskCanvas = canvas;
  return canvas;
}

function getRingMaskCanvas(): HTMLCanvasElement {
  if (ringMaskCanvas) return ringMaskCanvas;
  const canvas = createBackendCanvas(256, 256);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create ring mask canvas.");
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.stroke();
  ringMaskCanvas = canvas;
  return canvas;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "Unknown shader compile failure.";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create WebGL program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "Unknown WebGL link failure.";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

function sourceWidth(image: TexImageSource): number {
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    return image.naturalWidth || image.width;
  }
  if (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) return image.width;
  if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) return image.videoWidth || image.width;
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) return image.width;
  return (image as { width?: number }).width ?? 0;
}

function sourceHeight(image: TexImageSource): number {
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    return image.naturalHeight || image.height;
  }
  if (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) return image.height;
  if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) return image.videoHeight || image.height;
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) return image.height;
  return (image as { height?: number }).height ?? 0;
}

function hasFiniteRectLikePayload(payload: Record<string, unknown>): boolean {
  return Number.isFinite(Number(payload.dx))
    && Number.isFinite(Number(payload.dy))
    && Number.isFinite(Number(payload.dw))
    && Number.isFinite(Number(payload.dh));
}

function isDynamicSource(image: TexImageSource): boolean {
  if (isStableTextureSource(image)) return false;
  return (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement)
    || (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement)
    || (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap);
}

export class WebGLRenderer {
  private readonly program: WebGLProgram;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texCoordBuffer: WebGLBuffer;
  private readonly colorBuffer: WebGLBuffer;
  private readonly aPosition: number;
  private readonly aTexCoord: number;
  private readonly aColor: number;
  private readonly uMatrix: WebGLUniformLocation;
  private readonly uTexture: WebGLUniformLocation;
  private readonly textureCache = new WeakMap<object, CachedTexture>();
  private readonly compositeTexture: WebGLTexture;
  private currentSpace: QuadSpace = "world";
  private frameContext: RenderFrameContext;

  constructor(
    frameContext: RenderFrameContext,
    private readonly gl: WebGLRenderingContext,
  ) {
    this.frameContext = frameContext;
    this.program = createProgram(gl);
    const positionBuffer = gl.createBuffer();
    const texCoordBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const compositeTexture = gl.createTexture();
    if (!positionBuffer || !texCoordBuffer || !colorBuffer || !compositeTexture) {
      throw new Error("Failed to allocate WebGL buffers.");
    }
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;
    this.colorBuffer = colorBuffer;
    this.compositeTexture = compositeTexture;
    const aPosition = gl.getAttribLocation(this.program, "a_position");
    const aTexCoord = gl.getAttribLocation(this.program, "a_texCoord");
    const aColor = gl.getAttribLocation(this.program, "a_color");
    const uMatrix = gl.getUniformLocation(this.program, "u_matrix");
    const uTexture = gl.getUniformLocation(this.program, "u_texture");
    if (aPosition < 0 || aTexCoord < 0 || aColor < 0 || !uMatrix || !uTexture) {
      throw new Error("Failed to resolve WebGL shader bindings.");
    }
    this.aPosition = aPosition;
    this.aTexCoord = aTexCoord;
    this.aColor = aColor;
    this.uMatrix = uMatrix;
    this.uTexture = uTexture;

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.enableVertexAttribArray(this.aColor);
    gl.vertexAttribPointer(this.aColor, 4, gl.FLOAT, false, 0, 0);
    gl.uniform1i(this.uTexture, 0);
    gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  setFrameContext(frameContext: RenderFrameContext): void {
    this.frameContext = frameContext;
  }

  beginFrame(): void {
    const { gl } = this;
    gl.viewport(0, 0, this.frameContext.canvas.width, this.frameContext.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.currentSpace = "world";
    this.useWorldSpace();
  }

  useWorldSpace(): void {
    this.currentSpace = "world";
    this.gl.useProgram(this.program);
    this.gl.uniformMatrix3fv(this.uMatrix, false, this.buildWorldMatrix());
  }

  useScreenSpace(): void {
    this.currentSpace = "screen";
    this.gl.useProgram(this.program);
    this.gl.uniformMatrix3fv(this.uMatrix, false, this.buildScreenMatrix());
  }

  renderCommands(
    commands: readonly RenderCommand[],
    groundChunkContext?: GroundChunkRenderContext,
  ): void {
    let batch: OrderedTriangleBatch | null = null;
    let lastZBand: number | null = null;
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const stage = (command.payload as { stage?: string } | undefined)?.stage ?? "slice";
      if (groundChunkContext && stage !== "tail") {
        const zBand = resolveRenderZBand(command.key, groundChunkContext.rampRoadTiles ?? EMPTY_RAMP_ROAD_TILES);
        if (zBand !== lastZBand) {
          this.flushTriangleBatch(batch);
          batch = null;
          this.drawVisibleGroundChunksForBand(zBand, groundChunkContext);
          lastZBand = zBand;
        }
      }
      if (this.shouldSkipGroundCommand(command, groundChunkContext)) continue;
      const batchableTriangles = this.resolveBatchableTriangles(command);
      if (batchableTriangles.length > 0) {
        if (
          (command.semanticFamily === "groundSurface" || command.semanticFamily === "groundDecal")
          && command.finalForm === "quad"
        ) {
          countRenderWebGLProjectedSurfaceDraw();
        }
        for (let j = 0; j < batchableTriangles.length; j++) {
          const triangle = batchableTriangles[j];
          if (!batch || !this.canAppendTriangleToBatch(batch, triangle)) {
            this.flushTriangleBatch(batch);
            batch = this.createTriangleBatch(triangle);
            continue;
          }
          this.appendTriangleToBatch(batch, triangle);
        }
        continue;
      }
      this.flushTriangleBatch(batch);
      batch = null;
      this.renderCommandStandalone(command);
    }
    this.flushTriangleBatch(batch);
  }

  private drawVisibleGroundChunksForBand(
    zBand: number,
    groundChunkContext: GroundChunkRenderContext,
  ): void {
    const entries = groundChunkContext.groundChunkCache.getVisibleEntries(zBand, groundChunkContext.viewRect);
    const commands = groundChunkContext.groundChunkCache.getVisibleCommands(zBand, groundChunkContext.viewRect);
    if (entries.length <= 0 || commands.length <= 0) return;
    countRenderWebGLGroundChunksVisible(entries.length);
    countRenderWebGLGroundChunkDraw(commands.length);
    let batch: OrderedTriangleBatch | null = null;
    for (let i = 0; i < commands.length; i++) {
      const batchableTriangles = this.resolveBatchableTriangles(commands[i]);
      if (batchableTriangles.length > 0) {
        for (let j = 0; j < batchableTriangles.length; j++) {
          const triangle = batchableTriangles[j];
          if (!batch || !this.canAppendTriangleToBatch(batch, triangle)) {
            this.flushTriangleBatch(batch);
            batch = this.createTriangleBatch(triangle);
            continue;
          }
          this.appendTriangleToBatch(batch, triangle);
        }
        continue;
      }
      this.flushTriangleBatch(batch);
      batch = null;
      this.renderCommandStandalone(commands[i]);
    }
    this.flushTriangleBatch(batch);
  }

  private shouldSkipGroundCommand(
    command: RenderCommand,
    groundChunkContext: GroundChunkRenderContext | undefined,
  ): boolean {
    if (!groundChunkContext) return false;
    if (command.semanticFamily !== "groundSurface" && command.semanticFamily !== "groundDecal") return false;
    return groundChunkContext.groundChunkCache.hasCoveredStableId(command.key?.stableId) === true;
  }

  compositeCanvasSurface(sourceCanvas: HTMLCanvasElement): void {
    if (sourceCanvas.width <= 0 || sourceCanvas.height <= 0) return;
    this.useScreenSpace();
    const { gl } = this;
    countRenderWebGLCanvasComposite();
    noteRenderWebGLTextureUsage(sourceCanvas as unknown as object);
    gl.activeTexture(gl.TEXTURE0);
    countRenderWebGLTextureBind();
    gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
    if (typeof gl.pixelStorei === "function" && "UNPACK_PREMULTIPLY_ALPHA_WEBGL" in gl) {
      gl.pixelStorei((gl as unknown as { UNPACK_PREMULTIPLY_ALPHA_WEBGL: number }).UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    if (typeof gl.pixelStorei === "function" && "UNPACK_PREMULTIPLY_ALPHA_WEBGL" in gl) {
      gl.pixelStorei((gl as unknown as { UNPACK_PREMULTIPLY_ALPHA_WEBGL: number }).UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    }
    this.setPremultipliedCompositeBlendMode();
    this.uploadQuadVertices(this.buildRectQuadPoints(0, 0, sourceCanvas.width, sourceCanvas.height, 0, false));
    this.uploadQuadTexCoords(this.buildRectTexPoints(1, 1, 0, 0, 1, 1));
    this.uploadQuadColors([1, 1, 1, 1]);
    countRenderWebGLDrawCall();
    countRenderWebGLTrianglesSubmitted(2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private renderCommandStandalone(command: RenderCommand): void {
    const quads = this.resolveQuadDraws(command);
    for (let i = 0; i < quads.length; i++) {
      this.applySpace(quads[i].space);
      this.drawQuad(quads[i]);
    }
  }

  private resolveBatchableTriangles(command: RenderCommand): BatchTriangle[] {
    if (
      (command.semanticFamily === "groundSurface" || command.semanticFamily === "groundDecal")
      && command.finalForm === "quad"
    ) {
      return this.resolveQuadDraws(command).flatMap((quad) => this.lowerQuadDrawToBatchTriangles(quad));
    }

    if (command.semanticFamily === "worldSprite" && command.finalForm === "quad") {
      return this.resolveQuadDraws(command).flatMap((quad) => this.lowerQuadDrawToBatchTriangles(quad));
    }

    return [];
  }
  private resolveQuadDraws(command: RenderCommand): QuadDraw[] {
    const payload = command.payload as Record<string, unknown>;
    if (
      (command.semanticFamily === "groundSurface" || command.semanticFamily === "groundDecal" || command.semanticFamily === "worldSprite")
      && command.finalForm === "quad"
      && payload.image
    ) {
      return this.buildQuadFromData(payload, "world");
    }

    if (command.semanticFamily === "worldSprite" && command.finalForm === "quad") {
      const draw = (payload.draw ?? null) as Record<string, unknown> | null;
      if (!draw?.img) return [];
      const scale = Number.isFinite(Number(draw.scale)) ? Number(draw.scale) : 1;
      const dx = Number(draw.dx ?? 0);
      const dy = Number(draw.dy ?? 0);
      const dw = Number(draw.dw ?? 0) * scale;
      const dh = Number(draw.dh ?? 0) * scale;
      return [{
        image: draw.img as TexImageSource,
        sx: 0,
        sy: 0,
        sw: sourceWidth(draw.img as TexImageSource),
        sh: sourceHeight(draw.img as TexImageSource),
        texPoints: this.buildRectTexPoints(
          sourceWidth(draw.img as TexImageSource),
          sourceHeight(draw.img as TexImageSource),
          0,
          0,
          sourceWidth(draw.img as TexImageSource),
          sourceHeight(draw.img as TexImageSource),
        ),
        points: this.buildRectQuadPoints(dx, dy, dw, dh, 0, !!draw.flipX),
        alpha: 1,
        blendMode: "normal",
        color: [1, 1, 1, 1],
        space: "world",
      }];
    }

    if (command.semanticFamily === "screenOverlay" && command.finalForm === "quad") {
      return [this.buildSolidQuad(
        Number(payload.width ?? 0),
        Number(payload.height ?? 0),
        String(payload.color ?? "#000"),
        Number(payload.alpha ?? 1),
      )];
    }

    if (command.semanticFamily === "screenOverlay" && command.finalForm === "primitive" && (
      payload.darknessAlpha !== undefined
      || payload.ambientTint !== undefined
      || payload.ambientTintStrength !== undefined
    )) {
      return this.buildAmbientDarknessQuads(payload);
    }

    if (command.semanticFamily === "worldPrimitive" && payload.zoneKind !== undefined) {
      return this.buildZoneEffectQuads(payload);
    }

    if (command.semanticFamily === "worldPrimitive" && payload.lightPiece) {
      return this.buildProjectedLightQuads(payload);
    }

    return [];
  }

  private buildQuadFromData(data: Record<string, unknown>, space: QuadSpace): QuadDraw[] {
    const image = (data.image ?? null) as TexImageSource | null;
    if (!image) return [];
    const imageWidth = sourceWidth(image);
    const imageHeight = sourceHeight(image);
    const sw = Number.isFinite(Number(data.sw)) ? Number(data.sw) : imageWidth;
    const sh = Number.isFinite(Number(data.sh)) ? Number(data.sh) : imageHeight;
    if (!(imageWidth > 0 && imageHeight > 0 && sw > 0 && sh > 0)) return [];
    const sx = Number.isFinite(Number(data.sx)) ? Number(data.sx) : 0;
    const sy = Number.isFinite(Number(data.sy)) ? Number(data.sy) : 0;
    const explicitPoints = this.readQuadPoints(data);
    const rectPoints = explicitPoints ?? (
      hasFiniteRectLikePayload(data)
        ? this.buildRectQuadPoints(
          Number(data.dx ?? 0),
          Number(data.dy ?? 0),
          Number(data.dw ?? 0),
          Number(data.dh ?? 0),
          Number.isFinite(Number(data.rotationRad)) ? Number(data.rotationRad) : 0,
          !!data.flipX,
        )
        : null
    );
    if (!rectPoints) return [];
    return [{
      image,
      sx,
      sy,
      sw,
      sh,
      texPoints: this.readSourceTexPoints(data, imageWidth, imageHeight, sx, sy, sw, sh),
      points: rectPoints,
      alpha: Number.isFinite(Number(data.alpha)) ? Number(data.alpha) : 1,
      blendMode: data.blendMode === "additive" ? "additive" : "normal",
      color: parseColorToRgba01(typeof data.color === "string" ? String(data.color) : undefined),
      space,
    }];
  }

  private lowerQuadDrawToBatchTriangles(quad: QuadDraw): BatchTriangle[] {
    return [
      {
        image: quad.image,
        positions: [quad.points[0], quad.points[1], quad.points[2]],
        texCoords: [quad.texPoints[0], quad.texPoints[1], quad.texPoints[2]],
        blendMode: quad.blendMode,
        color: withEffectiveAlpha(quad.color, quad.alpha),
        space: quad.space,
      },
      {
        image: quad.image,
        positions: [quad.points[2], quad.points[1], quad.points[3]],
        texCoords: [quad.texPoints[2], quad.texPoints[1], quad.texPoints[3]],
        blendMode: quad.blendMode,
        color: withEffectiveAlpha(quad.color, quad.alpha),
        space: quad.space,
      },
    ];
  }

  private drawQuad(quad: QuadDraw): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    const texture = this.bindTexture(quad.image);
    if (!texture) return;

    this.setBlendMode(quad.blendMode);
    this.uploadQuadVertices(quad.points);
    this.uploadQuadTexCoords(quad.texPoints);
    this.uploadQuadColors(withEffectiveAlpha(quad.color, quad.alpha));
    countRenderWebGLDrawCall();
    countRenderWebGLTrianglesSubmitted(2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private buildSolidQuad(width: number, height: number, color: string, alpha: number): QuadDraw {
    return {
      image: getWhiteTextureCanvas(),
      sx: 0,
      sy: 0,
      sw: 1,
      sh: 1,
      texPoints: this.buildRectTexPoints(1, 1, 0, 0, 1, 1),
      points: this.buildRectQuadPoints(0, 0, Math.max(0, width), Math.max(0, height), 0, false),
      alpha: Math.max(0, alpha),
      blendMode: "normal",
      color: parseColorToRgba01(color),
      space: "screen",
    };
  }

  private buildMaskedEllipseQuad(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    color: string,
    alpha: number,
    mask: "radial" | "ring",
    space: QuadSpace,
    blendMode: BlendMode = "normal",
  ): QuadDraw {
    const source = mask === "ring" ? getRingMaskCanvas() : getRadialMaskCanvas();
    return {
      image: source,
      sx: 0,
      sy: 0,
      sw: source.width,
      sh: source.height,
      texPoints: this.buildRectTexPoints(source.width, source.height, 0, 0, source.width, source.height),
      points: this.buildRectQuadPoints(centerX - radiusX, centerY - radiusY, radiusX * 2, radiusY * 2, 0, false),
      alpha: Math.max(0, alpha),
      blendMode,
      color: parseColorToRgba01(color),
      space,
    };
  }

  private buildAmbientDarknessQuads(data: Record<string, unknown>): QuadDraw[] {
    const width = Number(data.width ?? 0);
    const height = Number(data.height ?? 0);
    const darknessAlpha = Math.max(0, Math.min(1, Number(data.darknessAlpha ?? 0)));
    if (!(width > 0 && height > 0 && darknessAlpha > 0)) return [];
    const tintStrength = Math.max(0, Math.min(1, Number(data.ambientTintStrength ?? 0)));
    const quads = [
      this.buildSolidQuad(width, height, "#000000", darknessAlpha),
    ];
    if (tintStrength > 0) {
      quads.push(this.buildSolidQuad(width, height, String(data.ambientTint ?? "#000000"), darknessAlpha * tintStrength));
    }
    return quads;
  }

  private buildZoneEffectQuads(data: Record<string, unknown>): QuadDraw[] {
    const centerX = Number(data.screenX ?? 0);
    const centerY = Number(data.screenY ?? 0);
    const radiusX = Math.max(0, Number(data.radiusScreenX ?? 0));
    const radiusY = Math.max(0, Number(data.radiusScreenY ?? 0));
    if (!(radiusX > 0 && radiusY > 0)) return [];
    const zoneKind = Number(data.zoneKind ?? 0);
    if (zoneKind === ZONE_KIND.FIRE) return [];
    if (zoneKind === ZONE_KIND.AURA) {
      return [
        this.buildMaskedEllipseQuad(centerX, centerY, radiusX, radiusY, "#7bdcff", 0.16, "radial", "world"),
        this.buildMaskedEllipseQuad(centerX, centerY, radiusX * 0.98, radiusY * 0.98, "#ffffff", 0.28, "ring", "world"),
      ];
    }
    const world = this.frameContext.world as any;
    const pulse = 0.85 + 0.15 * Math.sin((world.time ?? 0) * 7 + Number(data.zoneIndex ?? 0) * 0.37);
    return [
      this.buildMaskedEllipseQuad(centerX, centerY, radiusX, radiusY, "#ff3a2e", 0.26 * pulse, "radial", "world"),
    ];
  }

  private buildProjectedLightQuads(data: Record<string, unknown>): QuadDraw[] {
    const lightPiece = data.lightPiece as { light?: { projected?: Parameters<typeof resolveProjectedLightTintSprite>[0] } } | null;
    const projected = lightPiece?.light?.projected;
    if (!projected) return [];
    const sprite = resolveProjectedLightTintSprite(
      projected,
      (this.frameContext.world as any).time ?? 0,
      (this.frameContext.world as any).lighting?.groundYScale ?? 0.65,
    );
    if (!sprite) return [];
    return [{
      image: sprite.image,
      sx: 0,
      sy: 0,
      sw: sprite.image.width,
      sh: sprite.image.height,
      texPoints: this.buildRectTexPoints(sprite.image.width, sprite.image.height, 0, 0, sprite.image.width, sprite.image.height),
      points: this.buildRectQuadPoints(sprite.dx, sprite.dy, sprite.dw, sprite.dh, 0, false),
      alpha: sprite.alpha,
      blendMode: sprite.blendMode,
      color: [1, 1, 1, 1],
      space: "screen",
    }];
  }

  private applySpace(space: QuadSpace): void {
    if (space === this.currentSpace) return;
    if (space === "screen") this.useScreenSpace();
    else this.useWorldSpace();
  }

  private bindTexture(image: TexImageSource): CachedTexture | null {
    const source = image as unknown as object;
    const width = sourceWidth(image);
    const height = sourceHeight(image);
    if (!(width > 0 && height > 0)) return null;
    noteRenderWebGLTextureUsage(source);
    let cached = this.textureCache.get(source);
    const dynamic = isDynamicSource(image);
    if (!cached) {
      const texture = this.gl.createTexture();
      if (!texture) return null;
      cached = { texture, width, height };
      this.textureCache.set(source, cached);
      countRenderWebGLTextureBind();
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
      return cached;
    }

    countRenderWebGLTextureBind();
    this.gl.bindTexture(this.gl.TEXTURE_2D, cached.texture);
    if (dynamic || cached.width !== width || cached.height !== height) {
      cached.width = width;
      cached.height = height;
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
    }
    return cached;
  }

  private createTriangleBatch(triangle: BatchTriangle): OrderedTriangleBatch {
    const batch: OrderedTriangleBatch = {
      image: triangle.image,
      blendMode: triangle.blendMode,
      space: triangle.space,
      positions: [],
      texCoords: [],
      colors: [],
      triangleCount: 0,
    };
    this.appendTriangleToBatch(batch, triangle);
    return batch;
  }

  private appendTriangleToBatch(batch: OrderedTriangleBatch, triangle: BatchTriangle): void {
    batch.positions.push(
      triangle.positions[0].x, triangle.positions[0].y,
      triangle.positions[1].x, triangle.positions[1].y,
      triangle.positions[2].x, triangle.positions[2].y,
    );
    batch.texCoords.push(
      triangle.texCoords[0].x, triangle.texCoords[0].y,
      triangle.texCoords[1].x, triangle.texCoords[1].y,
      triangle.texCoords[2].x, triangle.texCoords[2].y,
    );
    batch.colors.push(
      triangle.color[0], triangle.color[1], triangle.color[2], triangle.color[3],
      triangle.color[0], triangle.color[1], triangle.color[2], triangle.color[3],
      triangle.color[0], triangle.color[1], triangle.color[2], triangle.color[3],
    );
    batch.triangleCount += 1;
  }

  private canAppendTriangleToBatch(batch: OrderedTriangleBatch, triangle: BatchTriangle): boolean {
    return batch.image === triangle.image
      && batch.blendMode === triangle.blendMode
      && batch.space === triangle.space
      && batch.triangleCount < MAX_BATCH_TRIANGLES;
  }

  private flushTriangleBatch(batch: OrderedTriangleBatch | null): void {
    if (!batch || batch.triangleCount <= 0) return;
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    const texture = this.bindTexture(batch.image);
    if (!texture) return;
    this.applySpace(batch.space);
    this.setBlendMode(batch.blendMode);
    this.uploadVertices(new Float32Array(batch.positions));
    this.uploadTexCoords(new Float32Array(batch.texCoords));
    this.uploadColors(new Float32Array(batch.colors));
    countRenderWebGLBatch();
    countRenderWebGLDrawCall();
    countRenderWebGLTrianglesSubmitted(batch.triangleCount);
    gl.drawArrays(gl.TRIANGLES, 0, batch.triangleCount * 3);
  }

  private buildRectQuadPoints(
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    rotationRad: number,
    flipX: boolean,
  ): QuadPointStrip {
    let x0 = dx;
    let x1 = dx + dw;
    const y0 = dy;
    const y1 = dy + dh;
    if (flipX) {
      x0 = dx + dw;
      x1 = dx;
    }
    if (!rotationRad) {
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x0, y: y1 },
        { x: x1, y: y1 },
      ];
    }
    const cx = dx + dw * 0.5;
    const cy = dy + dh * 0.5;
    const localLeft = flipX ? dw * 0.5 : -dw * 0.5;
    const localRight = flipX ? -dw * 0.5 : dw * 0.5;
    const localTop = -dh * 0.5;
    const localBottom = dh * 0.5;
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);
    const rotate = (lx: number, ly: number): TrianglePoint => ({
      x: cx + lx * cos - ly * sin,
      y: cy + lx * sin + ly * cos,
    });
    return [
      rotate(localLeft, localTop),
      rotate(localRight, localTop),
      rotate(localLeft, localBottom),
      rotate(localRight, localBottom),
    ];
  }

  private readQuadPoints(
    input: Record<string, unknown>,
  ): QuadPointStrip | null {
    const x0 = Number(input.x0);
    const y0 = Number(input.y0);
    const x1 = Number(input.x1);
    const y1 = Number(input.y1);
    const x2 = Number(input.x2);
    const y2 = Number(input.y2);
    const x3 = Number(input.x3);
    const y3 = Number(input.y3);
    if (![x0, y0, x1, y1, x2, y2, x3, y3].every(Number.isFinite)) return null;
    return [
      { x: x0, y: y0 },
      { x: x1, y: y1 },
      { x: x3, y: y3 },
      { x: x2, y: y2 },
    ];
  }

  private uploadQuadVertices(points: [TrianglePoint, TrianglePoint, TrianglePoint, TrianglePoint]): void {
    this.uploadVertices(new Float32Array([
      points[0].x, points[0].y,
      points[1].x, points[1].y,
      points[2].x, points[2].y,
      points[3].x, points[3].y,
    ]));
  }

  private uploadQuadTexCoords(points: QuadPointStrip): void {
    const texCoords = new Float32Array([
      points[0].x, points[0].y,
      points[1].x, points[1].y,
      points[2].x, points[2].y,
      points[3].x, points[3].y,
    ]);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    countRenderWebGLBufferUpload();
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STREAM_DRAW);
  }

  private buildRectTexPoints(
    sourceW: number,
    sourceH: number,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
  ): QuadPointStrip {
    return [
      { x: sx / sourceW, y: sy / sourceH },
      { x: (sx + sw) / sourceW, y: sy / sourceH },
      { x: sx / sourceW, y: (sy + sh) / sourceH },
      { x: (sx + sw) / sourceW, y: (sy + sh) / sourceH },
    ];
  }

  private readSourceTexPoints(
    input: Record<string, unknown>,
    imageWidth: number,
    imageHeight: number,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
  ): QuadPointStrip {
    const sourceQuad = input.sourceQuad as {
      nw?: { x?: number; y?: number };
      ne?: { x?: number; y?: number };
      se?: { x?: number; y?: number };
      sw?: { x?: number; y?: number };
    } | null;
    const readPoint = (point: { x?: number; y?: number } | undefined): TrianglePoint | null => {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x: x / imageWidth, y: y / imageHeight };
    };
    const nw = readPoint(sourceQuad?.nw);
    const ne = readPoint(sourceQuad?.ne);
    const se = readPoint(sourceQuad?.se);
    const swPoint = readPoint(sourceQuad?.sw);
    if (nw && ne && se && swPoint) {
      return [nw, ne, swPoint, se];
    }
    return this.buildRectTexPoints(imageWidth, imageHeight, sx, sy, sw, sh);
  }

  private uploadQuadColors(color: ColorRgba): void {
    this.uploadColors(new Float32Array([
      color[0], color[1], color[2], color[3],
      color[0], color[1], color[2], color[3],
      color[0], color[1], color[2], color[3],
      color[0], color[1], color[2], color[3],
    ]));
  }

  private uploadVertices(vertices: Float32Array): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    countRenderWebGLBufferUpload();
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STREAM_DRAW);
  }

  private uploadTexCoords(texCoords: Float32Array): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    countRenderWebGLBufferUpload();
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STREAM_DRAW);
  }

  private uploadColors(colors: Float32Array): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
    countRenderWebGLBufferUpload();
    this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.STREAM_DRAW);
  }

  private setBlendMode(mode: BlendMode): void {
    const glWithSeparate = this.gl as WebGLRenderingContext & {
      blendFuncSeparate?: (
        srcRGB: number,
        dstRGB: number,
        srcAlpha: number,
        dstAlpha: number,
      ) => void;
    };
    if (typeof glWithSeparate.blendFuncSeparate === "function") {
      if (mode === "additive") {
        glWithSeparate.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
        return;
      }
      glWithSeparate.blendFuncSeparate(
        this.gl.SRC_ALPHA,
        this.gl.ONE_MINUS_SRC_ALPHA,
        this.gl.ONE,
        this.gl.ONE_MINUS_SRC_ALPHA,
      );
      return;
    }
    if (mode === "additive") {
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
      return;
    }
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  }

  private setPremultipliedCompositeBlendMode(): void {
    const glWithSeparate = this.gl as WebGLRenderingContext & {
      blendFuncSeparate?: (
        srcRGB: number,
        dstRGB: number,
        srcAlpha: number,
        dstAlpha: number,
      ) => void;
    };
    if (typeof glWithSeparate.blendFuncSeparate === "function") {
      glWithSeparate.blendFuncSeparate(
        this.gl.ONE,
        this.gl.ONE_MINUS_SRC_ALPHA,
        this.gl.ONE,
        this.gl.ONE_MINUS_SRC_ALPHA,
      );
      return;
    }
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
  }

  private buildScreenMatrix(): Float32Array {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const devW = Math.max(1, canvas.width);
    const devH = Math.max(1, canvas.height);
    return new Float32Array([
      2 / devW, 0, 0,
      0, -2 / devH, 0,
      -1, 1, 1,
    ]);
  }

  private buildWorldMatrix(): Float32Array {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const devW = Math.max(1, canvas.width);
    const devH = Math.max(1, canvas.height);
    const scale = this.frameContext.viewport.worldScaleDevice;
    const tx = this.frameContext.viewport.camTx * scale + this.frameContext.viewport.safeOffsetDeviceX;
    const ty = this.frameContext.viewport.camTy * scale + this.frameContext.viewport.safeOffsetDeviceY;
    return new Float32Array([
      (2 * scale) / devW, 0, 0,
      0, (-2 * scale) / devH, 0,
      (2 * tx) / devW - 1, 1 - (2 * ty) / devH, 1,
    ]);
  }
}
