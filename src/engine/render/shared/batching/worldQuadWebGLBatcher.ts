import type { RenderFrameContext } from "../../../../game/systems/presentation/contracts/renderFrameContext";
import type { WorldQuadRenderPiece } from "../../creator/renderPieceTypes";
import {
  countRenderWebGLBatch,
  countRenderWebGLBufferUpload,
  countRenderWebGLDrawCall,
  countRenderWebGLGroundChunkTextureUpload,
  countRenderWebGLTextureBind,
  countRenderWebGLTrianglesSubmitted,
  noteRenderWebGLTextureUsage,
} from "../../../../game/systems/presentation/renderPerfCounters";
import {
  isGroundChunkTextureSource,
  isStableTextureSource,
} from "../../../../game/systems/presentation/stableTextureSource";
import { pieceDestinationQuad } from "../../creator/renderPieceTypes";

type BlendMode = "normal" | "additive";
type TrianglePoint = { x: number; y: number };
type QuadPointStrip = [TrianglePoint, TrianglePoint, TrianglePoint, TrianglePoint];
type ColorRgba = [number, number, number, number];

type BatchTriangle = {
  image: TexImageSource;
  positions: [TrianglePoint, TrianglePoint, TrianglePoint];
  texCoords: [TrianglePoint, TrianglePoint, TrianglePoint];
  blendMode: BlendMode;
  color: ColorRgba;
};

type OrderedTriangleBatch = {
  image: TexImageSource;
  blendMode: BlendMode;
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

const MAX_BATCH_TRIANGLES = 2048;

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
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) return image.naturalWidth || image.width;
  if (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) return image.width;
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) return image.width;
  if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) return image.videoWidth || image.width;
  return (image as { width?: number }).width ?? 0;
}

function sourceHeight(image: TexImageSource): number {
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) return image.naturalHeight || image.height;
  if (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) return image.height;
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) return image.height;
  if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) return image.videoHeight || image.height;
  return (image as { height?: number }).height ?? 0;
}

function isDynamicSource(image: TexImageSource): boolean {
  if (isStableTextureSource(image)) return false;
  return (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement)
    || (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement)
    || (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap);
}

function parseColorToRgba01(input: string | undefined): ColorRgba {
  const color = `${input ?? "#ffffff"}`.trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return [
      parseInt(color.slice(1, 3), 16) / 255,
      parseInt(color.slice(3, 5), 16) / 255,
      parseInt(color.slice(5, 7), 16) / 255,
      1,
    ];
  }
  return [1, 1, 1, 1];
}

function withEffectiveAlpha(color: ColorRgba, alpha: number): ColorRgba {
  const clampedAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  return [color[0], color[1], color[2], Math.max(0, Math.min(1, color[3] * clampedAlpha))];
}

export class WorldQuadWebGLBatcher {
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
  private batch: OrderedTriangleBatch | null = null;
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
    if (!positionBuffer || !texCoordBuffer || !colorBuffer) {
      throw new Error("Failed to allocate WebGL quad batch buffers.");
    }
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;
    this.colorBuffer = colorBuffer;
    const aPosition = gl.getAttribLocation(this.program, "a_position");
    const aTexCoord = gl.getAttribLocation(this.program, "a_texCoord");
    const aColor = gl.getAttribLocation(this.program, "a_color");
    const uMatrix = gl.getUniformLocation(this.program, "u_matrix");
    const uTexture = gl.getUniformLocation(this.program, "u_texture");
    if (aPosition < 0 || aTexCoord < 0 || aColor < 0 || !uMatrix || !uTexture) {
      throw new Error("Failed to resolve WebGL quad batch bindings.");
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
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uMatrix, false, this.buildWorldMatrix());
    this.batch = null;
  }

  appendPiece(piece: WorldQuadRenderPiece): boolean {
    const triangles = this.resolveBatchableTriangles(piece);
    if (triangles.length <= 0) return false;
    for (let i = 0; i < triangles.length; i++) {
      const triangle = triangles[i];
      if (!this.batch || !this.canAppendTriangleToBatch(this.batch, triangle)) {
        this.flush();
        this.batch = this.createTriangleBatch(triangle);
        continue;
      }
      this.appendTriangleToBatch(this.batch, triangle);
    }
    return true;
  }

  flush(): void {
    if (!this.batch || this.batch.triangleCount <= 0) return;
    const texture = this.bindTexture(this.batch.image);
    if (!texture) {
      this.batch = null;
      return;
    }
    this.setBlendMode(this.batch.blendMode);
    this.uploadVertices(new Float32Array(this.batch.positions));
    this.uploadTexCoords(new Float32Array(this.batch.texCoords));
    this.uploadColors(new Float32Array(this.batch.colors));
    countRenderWebGLBatch();
    countRenderWebGLDrawCall();
    countRenderWebGLTrianglesSubmitted(this.batch.triangleCount);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.batch.triangleCount * 3);
    this.batch = null;
  }

  private resolveBatchableTriangles(piece: WorldQuadRenderPiece): BatchTriangle[] {
    const image = piece.image as TexImageSource | null;
    const destinationQuad = pieceDestinationQuad(piece);
    if (!image || !destinationQuad) return [];
    const imageWidth = sourceWidth(image);
    const imageHeight = sourceHeight(image);
    const sx = Number.isFinite(Number(piece.sx)) ? Number(piece.sx) : 0;
    const sy = Number.isFinite(Number(piece.sy)) ? Number(piece.sy) : 0;
    const sw = Number.isFinite(Number(piece.sw)) ? Number(piece.sw) : imageWidth;
    const sh = Number.isFinite(Number(piece.sh)) ? Number(piece.sh) : imageHeight;
    if (!(imageWidth > 0 && imageHeight > 0 && sw > 0 && sh > 0)) return [];
    const points: QuadPointStrip = [
      destinationQuad.nw,
      destinationQuad.ne,
      destinationQuad.sw,
      destinationQuad.se,
    ];
    const texPoints = this.readSourceTexPoints(piece, imageWidth, imageHeight, sx, sy, sw, sh);
    const blendMode = piece.blendMode === "additive" ? "additive" : "normal";
    const color = withEffectiveAlpha(parseColorToRgba01(typeof piece.color === "string" ? piece.color : undefined), Number(piece.alpha ?? 1));
    return [
      {
        image,
        positions: [points[0], points[1], points[2]],
        texCoords: [texPoints[0], texPoints[1], texPoints[2]],
        blendMode,
        color,
      },
      {
        image,
        positions: [points[2], points[1], points[3]],
        texCoords: [texPoints[2], texPoints[1], texPoints[3]],
        blendMode,
        color,
      },
    ];
  }

  private readSourceTexPoints(
    piece: WorldQuadRenderPiece,
    imageWidth: number,
    imageHeight: number,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
  ): QuadPointStrip {
    const sourceQuad = piece.sourceQuad;
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
    return [
      { x: sx / imageWidth, y: sy / imageHeight },
      { x: (sx + sw) / imageWidth, y: sy / imageHeight },
      { x: sx / imageWidth, y: (sy + sh) / imageHeight },
      { x: (sx + sw) / imageWidth, y: (sy + sh) / imageHeight },
    ];
  }

  private createTriangleBatch(triangle: BatchTriangle): OrderedTriangleBatch {
    const batch: OrderedTriangleBatch = {
      image: triangle.image,
      blendMode: triangle.blendMode,
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
      && batch.triangleCount < MAX_BATCH_TRIANGLES;
  }

  private bindTexture(image: TexImageSource): CachedTexture | null {
    const source = image as unknown as object;
    const width = sourceWidth(image);
    const height = sourceHeight(image);
    if (!(width > 0 && height > 0)) return null;
    noteRenderWebGLTextureUsage(source);
    let cached = this.textureCache.get(source);
    const dynamic = isDynamicSource(image);
    const groundChunkTexture = isGroundChunkTextureSource(image);
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
      if (groundChunkTexture) countRenderWebGLGroundChunkTextureUpload();
      return cached;
    }
    countRenderWebGLTextureBind();
    this.gl.bindTexture(this.gl.TEXTURE_2D, cached.texture);
    if (dynamic || cached.width !== width || cached.height !== height) {
      cached.width = width;
      cached.height = height;
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
      if (groundChunkTexture) countRenderWebGLGroundChunkTextureUpload();
    }
    return cached;
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
