import { ZONE_KIND } from "../../../factories/zoneFactory";
import type { RenderFrameContext } from "../contracts/renderFrameContext";
import type { RenderCommand } from "../contracts/renderCommands";
import { resolveProjectedLightTintSprite } from "../renderLighting";
import {
  countRenderWebGLBatch,
  countRenderWebGLBufferUpload,
  countRenderWebGLCanvasComposite,
  countRenderWebGLDrawCall,
  countRenderWebGLProjectedSurfaceDraw,
  countRenderWebGLTextureBind,
  countRenderWebGLTrianglesSubmitted,
  noteRenderWebGLTextureUsage,
} from "../renderPerfCounters";

type BlendMode = "normal" | "additive";
type QuadSpace = "world" | "screen";
type ColorRgba = [number, number, number, number];
type TrianglePoint = { x: number; y: number };

type QuadDraw = {
  image: TexImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  alpha: number;
  rotationRad: number;
  flipX: boolean;
  blendMode: BlendMode;
  color: ColorRgba;
  space: QuadSpace;
};

type TriangleDraw = {
  image: TexImageSource;
  srcPoints: [TrianglePoint, TrianglePoint, TrianglePoint];
  dstPoints: [TrianglePoint, TrianglePoint, TrianglePoint];
  alpha: number;
  blendMode: BlendMode;
  color: ColorRgba;
  space: QuadSpace;
  sourceWidth: number;
  sourceHeight: number;
};

type BatchTriangle = {
  image: TexImageSource;
  positions: [TrianglePoint, TrianglePoint, TrianglePoint];
  texCoords: [TrianglePoint, TrianglePoint, TrianglePoint];
  alpha: number;
  blendMode: BlendMode;
  color: ColorRgba;
  space: QuadSpace;
};

type OrderedTriangleBatch = {
  image: TexImageSource;
  alpha: number;
  blendMode: BlendMode;
  color: ColorRgba;
  space: QuadSpace;
  positions: number[];
  texCoords: number[];
  triangleCount: number;
};

type CachedTexture = {
  texture: WebGLTexture;
  width: number;
  height: number;
};

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
uniform mat3 u_matrix;
varying vec2 v_texCoord;

void main() {
  vec3 clip = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform sampler2D u_texture;
uniform float u_alpha;
uniform vec4 u_color;
varying vec2 v_texCoord;

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  gl_FragColor = vec4(color.rgb * u_color.rgb, color.a * u_alpha * u_color.a);
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

let whiteTextureCanvas: HTMLCanvasElement | null = null;
let radialMaskCanvas: HTMLCanvasElement | null = null;
let ringMaskCanvas: HTMLCanvasElement | null = null;

const MAX_BATCH_TRIANGLES = 2048;

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
  return (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement)
    || (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement)
    || (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap);
}

export class WebGLRenderer {
  private readonly program: WebGLProgram;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texCoordBuffer: WebGLBuffer;
  private readonly aPosition: number;
  private readonly aTexCoord: number;
  private readonly uMatrix: WebGLUniformLocation;
  private readonly uTexture: WebGLUniformLocation;
  private readonly uAlpha: WebGLUniformLocation;
  private readonly uColor: WebGLUniformLocation;
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
    const compositeTexture = gl.createTexture();
    if (!positionBuffer || !texCoordBuffer || !compositeTexture) {
      throw new Error("Failed to allocate WebGL buffers.");
    }
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;
    this.compositeTexture = compositeTexture;
    const aPosition = gl.getAttribLocation(this.program, "a_position");
    const aTexCoord = gl.getAttribLocation(this.program, "a_texCoord");
    const uMatrix = gl.getUniformLocation(this.program, "u_matrix");
    const uTexture = gl.getUniformLocation(this.program, "u_texture");
    const uAlpha = gl.getUniformLocation(this.program, "u_alpha");
    const uColor = gl.getUniformLocation(this.program, "u_color");
    if (aPosition < 0 || aTexCoord < 0 || !uMatrix || !uTexture || !uAlpha || !uColor) {
      throw new Error("Failed to resolve WebGL shader bindings.");
    }
    this.aPosition = aPosition;
    this.aTexCoord = aTexCoord;
    this.uMatrix = uMatrix;
    this.uTexture = uTexture;
    this.uAlpha = uAlpha;
    this.uColor = uColor;

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(this.uTexture, 0);
    gl.uniform4f(this.uColor, 1, 1, 1, 1);
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

  renderCommands(commands: readonly RenderCommand[]): void {
    let batch: OrderedTriangleBatch | null = null;
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const batchableTriangles = this.resolveBatchableTriangles(command);
      if (batchableTriangles.length > 0) {
        if (
          (command.semanticFamily === "groundSurface" || command.semanticFamily === "groundDecal")
          && command.finalForm === "projectedSurface"
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
    gl.uniform1f(this.uAlpha, 1);
    gl.uniform4f(this.uColor, 1, 1, 1, 1);
    this.uploadQuadVertices(0, 0, sourceCanvas.width, sourceCanvas.height, 0, false);
    this.uploadQuadTexCoords(0, 0, 1, 1);
    countRenderWebGLDrawCall();
    countRenderWebGLTrianglesSubmitted(2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private renderCommandStandalone(command: RenderCommand): void {
    const triangles = this.resolveTriangleDraws(command);
    if (triangles.length > 0) {
      if (
        (command.semanticFamily === "groundSurface" || command.semanticFamily === "groundDecal")
        && command.finalForm === "projectedSurface"
      ) {
        countRenderWebGLProjectedSurfaceDraw();
      }
      for (let i = 0; i < triangles.length; i++) {
        this.applySpace(triangles[i].space);
        this.drawTriangle(triangles[i]);
      }
      return;
    }
    const quads = this.resolveQuadDraws(command);
    for (let i = 0; i < quads.length; i++) {
      this.applySpace(quads[i].space);
      this.drawQuad(quads[i]);
    }
  }

  private resolveBatchableTriangles(command: RenderCommand): BatchTriangle[] {
    if (
      (command.semanticFamily === "groundSurface" || command.semanticFamily === "groundDecal")
      && command.finalForm === "projectedSurface"
    ) {
      return this.resolveTriangleDraws(command).flatMap((triangle) => this.lowerTriangleDrawToBatchTriangles(triangle));
    }

    if (command.semanticFamily === "worldGeometry" && command.finalForm === "triangles") {
      return this.resolveTriangleDraws(command).flatMap((triangle) => this.lowerTriangleDrawToBatchTriangles(triangle));
    }

    if (command.semanticFamily === "worldSprite" && command.finalForm === "quad") {
      return this.resolveQuadDraws(command).flatMap((quad) => this.lowerQuadDrawToBatchTriangles(quad));
    }

    return [];
  }

  private resolveTriangleDraws(command: RenderCommand): TriangleDraw[] {
    const payload = command.payload as Record<string, unknown>;
    if (
      (command.semanticFamily === "groundSurface" || command.semanticFamily === "groundDecal")
      && command.finalForm === "projectedSurface"
    ) {
      return this.buildTriangleDrawsFromPayload(payload);
    }

    if (command.semanticFamily !== "worldGeometry" || command.finalForm !== "triangles") return [];
    return this.buildTriangleDrawsFromPayload(payload);
  }

  private resolveQuadDraws(command: RenderCommand): QuadDraw[] {
    const payload = command.payload as Record<string, unknown>;
    if (command.semanticFamily === "worldSprite" && command.finalForm === "quad" && payload.image) {
      return this.buildQuadFromData(payload, "world");
    }

    if (command.semanticFamily === "worldSprite" && command.finalForm === "quad") {
      const draw = (payload.draw ?? null) as Record<string, unknown> | null;
      if (!draw?.img) return [];
      const scale = Number.isFinite(Number(draw.scale)) ? Number(draw.scale) : 1;
      return [{
        image: draw.img as TexImageSource,
        sx: 0,
        sy: 0,
        sw: sourceWidth(draw.img as TexImageSource),
        sh: sourceHeight(draw.img as TexImageSource),
        dx: Number(draw.dx ?? 0),
        dy: Number(draw.dy ?? 0),
        dw: Number(draw.dw ?? 0) * scale,
        dh: Number(draw.dh ?? 0) * scale,
        alpha: 1,
        rotationRad: 0,
        flipX: !!draw.flipX,
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

  private buildTriangleDrawsFromPayload(payload: Record<string, unknown>): TriangleDraw[] {
    const image = (payload.image ?? null) as TexImageSource | null;
    const triangleSourceWidth = Number(payload.sourceWidth ?? 0);
    const triangleSourceHeight = Number(payload.sourceHeight ?? 0);
    if (!image || !(triangleSourceWidth > 0 && triangleSourceHeight > 0)) return [];
    const triangles = Array.isArray(payload.triangles)
      ? payload.triangles as Array<Record<string, unknown>>
      : [];
    const out: TriangleDraw[] = [];
    for (let i = 0; i < triangles.length; i++) {
      const triangle = triangles[i];
      const srcPoints = this.readTrianglePoints(triangle.srcPoints, false, 0);
      const dstPoints = this.readTrianglePoints(triangle.dstPoints, false, 0);
      if (!srcPoints || !dstPoints) continue;
      out.push({
        image,
        srcPoints,
        dstPoints,
        alpha: Number.isFinite(Number(triangle.alpha)) ? Number(triangle.alpha) : 1,
        blendMode: "normal",
        color: [1, 1, 1, 1],
        space: "world",
        sourceWidth: triangleSourceWidth,
        sourceHeight: triangleSourceHeight,
      });
    }
    return out;
  }

  private lowerTriangleDrawToBatchTriangles(triangle: TriangleDraw): BatchTriangle[] {
    if (!(triangle.sourceWidth > 0 && triangle.sourceHeight > 0)) return [];
    return [{
      image: triangle.image,
      positions: triangle.dstPoints,
      texCoords: [
        {
          x: triangle.srcPoints[0].x / triangle.sourceWidth,
          y: triangle.srcPoints[0].y / triangle.sourceHeight,
        },
        {
          x: triangle.srcPoints[1].x / triangle.sourceWidth,
          y: triangle.srcPoints[1].y / triangle.sourceHeight,
        },
        {
          x: triangle.srcPoints[2].x / triangle.sourceWidth,
          y: triangle.srcPoints[2].y / triangle.sourceHeight,
        },
      ],
      alpha: triangle.alpha,
      blendMode: triangle.blendMode,
      color: triangle.color,
      space: triangle.space,
    }];
  }

  private buildQuadFromData(data: Record<string, unknown>, space: QuadSpace): QuadDraw[] {
    const image = (data.image ?? null) as TexImageSource | null;
    if (!image) return [];
    const imageWidth = sourceWidth(image);
    const imageHeight = sourceHeight(image);
    const sw = Number.isFinite(Number(data.sw)) ? Number(data.sw) : imageWidth;
    const sh = Number.isFinite(Number(data.sh)) ? Number(data.sh) : imageHeight;
    const dw = Number(data.dw ?? 0);
    const dh = Number(data.dh ?? 0);
    if (!(imageWidth > 0 && imageHeight > 0 && sw > 0 && sh > 0 && dw > 0 && dh > 0)) return [];
    return [{
      image,
      sx: Number.isFinite(Number(data.sx)) ? Number(data.sx) : 0,
      sy: Number.isFinite(Number(data.sy)) ? Number(data.sy) : 0,
      sw,
      sh,
      dx: Number(data.dx ?? 0),
      dy: Number(data.dy ?? 0),
      dw,
      dh,
      alpha: Number.isFinite(Number(data.alpha)) ? Number(data.alpha) : 1,
      rotationRad: Number.isFinite(Number(data.rotationRad)) ? Number(data.rotationRad) : 0,
      flipX: !!data.flipX,
      blendMode: data.blendMode === "additive" ? "additive" : "normal",
      color: [1, 1, 1, 1],
      space,
    }];
  }

  private lowerQuadDrawToBatchTriangles(quad: QuadDraw): BatchTriangle[] {
    const sourceW = sourceWidth(quad.image);
    const sourceH = sourceHeight(quad.image);
    if (!(sourceW > 0 && sourceH > 0)) return [];
    const vertices = this.buildQuadVertices(quad.dx, quad.dy, quad.dw, quad.dh, quad.rotationRad, quad.flipX);
    const u0 = quad.sx / sourceW;
    const v0 = quad.sy / sourceH;
    const u1 = (quad.sx + quad.sw) / sourceW;
    const v1 = (quad.sy + quad.sh) / sourceH;
    const texCoords: [TrianglePoint, TrianglePoint, TrianglePoint, TrianglePoint] = [
      { x: u0, y: v0 },
      { x: u1, y: v0 },
      { x: u0, y: v1 },
      { x: u1, y: v1 },
    ];
    return [
      {
        image: quad.image,
        positions: [vertices[0], vertices[1], vertices[2]],
        texCoords: [texCoords[0], texCoords[1], texCoords[2]],
        alpha: quad.alpha,
        blendMode: quad.blendMode,
        color: quad.color,
        space: quad.space,
      },
      {
        image: quad.image,
        positions: [vertices[2], vertices[1], vertices[3]],
        texCoords: [texCoords[2], texCoords[1], texCoords[3]],
        alpha: quad.alpha,
        blendMode: quad.blendMode,
        color: quad.color,
        space: quad.space,
      },
    ];
  }

  private readTrianglePoints(
    input: unknown,
    flipX: boolean,
    flipWidth: number,
  ): [TrianglePoint, TrianglePoint, TrianglePoint] | null {
    if (!Array.isArray(input) || input.length < 3) return null;
    const points = input.slice(0, 3).map((point) => {
      const source = point as Record<string, unknown>;
      const x = Number(source.x ?? 0);
      const y = Number(source.y ?? 0);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {
        x: flipX ? flipWidth - x : x,
        y,
      };
    });
    if (points.some((point) => point == null)) return null;
    return points as [TrianglePoint, TrianglePoint, TrianglePoint];
  }

  private drawQuad(quad: QuadDraw): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    const texture = this.bindTexture(quad.image);
    if (!texture) return;
    const sourceW = sourceWidth(quad.image);
    const sourceH = sourceHeight(quad.image);
    if (!(sourceW > 0 && sourceH > 0)) return;

    this.setBlendMode(quad.blendMode);
    gl.uniform1f(this.uAlpha, quad.alpha);
    gl.uniform4f(this.uColor, quad.color[0], quad.color[1], quad.color[2], quad.color[3]);
    this.uploadQuadVertices(quad.dx, quad.dy, quad.dw, quad.dh, quad.rotationRad, quad.flipX);
    this.uploadQuadTexCoords(
      quad.sx / sourceW,
      quad.sy / sourceH,
      (quad.sx + quad.sw) / sourceW,
      (quad.sy + quad.sh) / sourceH,
    );
    countRenderWebGLDrawCall();
    countRenderWebGLTrianglesSubmitted(2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private drawTriangle(triangle: TriangleDraw): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    const texture = this.bindTexture(triangle.image);
    if (!texture) return;
    if (!(triangle.sourceWidth > 0 && triangle.sourceHeight > 0)) return;

    this.setBlendMode(triangle.blendMode);
    gl.uniform1f(this.uAlpha, triangle.alpha);
    gl.uniform4f(this.uColor, triangle.color[0], triangle.color[1], triangle.color[2], triangle.color[3]);
    this.uploadTriangleVertices(triangle.dstPoints);
    this.uploadTriangleTexCoords(triangle.srcPoints, triangle.sourceWidth, triangle.sourceHeight);
    countRenderWebGLDrawCall();
    countRenderWebGLTrianglesSubmitted(1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private buildSolidQuad(width: number, height: number, color: string, alpha: number): QuadDraw {
    return {
      image: getWhiteTextureCanvas(),
      sx: 0,
      sy: 0,
      sw: 1,
      sh: 1,
      dx: 0,
      dy: 0,
      dw: Math.max(0, width),
      dh: Math.max(0, height),
      alpha: Math.max(0, alpha),
      rotationRad: 0,
      flipX: false,
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
      dx: centerX - radiusX,
      dy: centerY - radiusY,
      dw: radiusX * 2,
      dh: radiusY * 2,
      alpha: Math.max(0, alpha),
      rotationRad: 0,
      flipX: false,
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
      dx: sprite.dx,
      dy: sprite.dy,
      dw: sprite.dw,
      dh: sprite.dh,
      alpha: sprite.alpha,
      rotationRad: 0,
      flipX: false,
      blendMode: sprite.blendMode,
      color: [1, 1, 1, 1],
      space: "screen",
    }];
  }

  private resolveStructureTriangleAlpha(
    data: Record<string, unknown>,
    points: [TrianglePoint, TrianglePoint, TrianglePoint],
  ): number {
    if (!data.cutoutEnabled || !data.buildingDirectionalEligible || !data.groupParentAfterPlayer) {
      return 1;
    }
    const rect = (data.cutoutScreenRect ?? null) as Record<string, unknown> | null;
    if (!rect) return 1;
    const centroidX = (points[0].x + points[1].x + points[2].x) / 3;
    const centroidY = (points[0].y + points[1].y + points[2].y) / 3;
    const minX = Number(rect.minX ?? Number.NEGATIVE_INFINITY);
    const maxX = Number(rect.maxX ?? Number.POSITIVE_INFINITY);
    const minY = Number(rect.minY ?? Number.NEGATIVE_INFINITY);
    const maxY = Number(rect.maxY ?? Number.POSITIVE_INFINITY);
    const inside = centroidX >= minX && centroidX <= maxX && centroidY >= minY && centroidY <= maxY;
    if (!inside) return 1;
    const alpha = Number(data.cutoutAlpha ?? 1);
    if (!Number.isFinite(alpha)) return 1;
    return Math.max(0, Math.min(1, alpha));
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
      alpha: triangle.alpha,
      blendMode: triangle.blendMode,
      color: [...triangle.color] as ColorRgba,
      space: triangle.space,
      positions: [],
      texCoords: [],
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
    batch.triangleCount += 1;
  }

  private canAppendTriangleToBatch(batch: OrderedTriangleBatch, triangle: BatchTriangle): boolean {
    return batch.image === triangle.image
      && batch.alpha === triangle.alpha
      && batch.blendMode === triangle.blendMode
      && batch.space === triangle.space
      && batch.color[0] === triangle.color[0]
      && batch.color[1] === triangle.color[1]
      && batch.color[2] === triangle.color[2]
      && batch.color[3] === triangle.color[3]
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
    gl.uniform1f(this.uAlpha, batch.alpha);
    gl.uniform4f(this.uColor, batch.color[0], batch.color[1], batch.color[2], batch.color[3]);
    this.uploadVertices(new Float32Array(batch.positions));
    this.uploadTexCoords(new Float32Array(batch.texCoords));
    countRenderWebGLBatch();
    countRenderWebGLDrawCall();
    countRenderWebGLTrianglesSubmitted(batch.triangleCount);
    gl.drawArrays(gl.TRIANGLES, 0, batch.triangleCount * 3);
  }

  private buildQuadVertices(
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    rotationRad: number,
    flipX: boolean,
  ): [TrianglePoint, TrianglePoint, TrianglePoint, TrianglePoint] {
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

  private uploadQuadVertices(
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    rotationRad: number,
    flipX: boolean,
  ): void {
    const points = this.buildQuadVertices(dx, dy, dw, dh, rotationRad, flipX);
    this.uploadVertices(new Float32Array([
      points[0].x, points[0].y,
      points[1].x, points[1].y,
      points[2].x, points[2].y,
      points[3].x, points[3].y,
    ]));
  }

  private uploadQuadTexCoords(u0: number, v0: number, u1: number, v1: number): void {
    const texCoords = new Float32Array([
      u0, v0,
      u1, v0,
      u0, v1,
      u1, v1,
    ]);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    countRenderWebGLBufferUpload();
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STREAM_DRAW);
  }

  private uploadTriangleVertices(points: [TrianglePoint, TrianglePoint, TrianglePoint]): void {
    this.uploadVertices(new Float32Array([
      points[0].x, points[0].y,
      points[1].x, points[1].y,
      points[2].x, points[2].y,
    ]));
  }

  private uploadTriangleTexCoords(
    points: [TrianglePoint, TrianglePoint, TrianglePoint],
    sourceWidth: number,
    sourceHeight: number,
  ): void {
    this.uploadTexCoords(new Float32Array([
      points[0].x / sourceWidth, points[0].y / sourceHeight,
      points[1].x / sourceWidth, points[1].y / sourceHeight,
      points[2].x / sourceWidth, points[2].y / sourceHeight,
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
