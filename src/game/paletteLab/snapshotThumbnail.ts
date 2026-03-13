import type { PaletteSnapshotCaptureDraft } from "./snapshotCapture";
import type { PaletteSnapshotArtifact } from "./terminology";

export type PaletteSnapshotThumbnailOptions = {
  width?: number;
  height?: number;
  mimeType?: string;
  quality?: number;
  createCanvas?: (width: number, height: number) => HTMLCanvasElement;
};

const DEFAULT_THUMBNAIL_WIDTH = 256;
const DEFAULT_THUMBNAIL_HEIGHT = 144;
const DEFAULT_THUMBNAIL_MIME = "image/jpeg";
const DEFAULT_THUMBNAIL_QUALITY = 0.92;

function createThumbnailCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== "function") {
      reject(new Error("Canvas toBlob is unavailable for palette snapshot thumbnail capture."));
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Palette snapshot thumbnail capture returned an empty blob."));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
}

export async function capturePaletteSnapshotThumbnail(
  sourceCanvas: HTMLCanvasElement,
  options: PaletteSnapshotThumbnailOptions = {},
): Promise<Blob> {
  const width = Math.max(1, Math.floor(options.width ?? DEFAULT_THUMBNAIL_WIDTH));
  const height = Math.max(1, Math.floor(options.height ?? DEFAULT_THUMBNAIL_HEIGHT));
  const mimeType = options.mimeType ?? DEFAULT_THUMBNAIL_MIME;
  const quality = Number.isFinite(options.quality) ? (options.quality as number) : DEFAULT_THUMBNAIL_QUALITY;

  const canvasFactory = options.createCanvas ?? createThumbnailCanvas;
  const thumbnailCanvas = canvasFactory(width, height);
  const ctx = thumbnailCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create thumbnail 2D context for palette snapshot capture.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  return toBlob(thumbnailCanvas, mimeType, quality);
}

export async function buildPaletteSnapshotArtifactFromCanvas(
  draft: PaletteSnapshotCaptureDraft,
  sourceCanvas: HTMLCanvasElement,
  options: PaletteSnapshotThumbnailOptions = {},
): Promise<PaletteSnapshotArtifact> {
  const thumbnail = await capturePaletteSnapshotThumbnail(sourceCanvas, options);
  return {
    metadata: draft.metadata,
    sceneContext: draft.sceneContext,
    cameraState: draft.cameraState,
    worldState: draft.worldState,
    thumbnail,
  };
}
