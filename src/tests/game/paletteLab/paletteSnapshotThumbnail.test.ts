import { describe, expect, test } from "vitest";
import {
  buildPaletteSnapshotArtifactFromCanvas,
  capturePaletteSnapshotThumbnail,
} from "../../../game/paletteLab/snapshotThumbnail";

class Fake2DContext {
  imageSmoothingEnabled = false;
  clearRectCalls: Array<[number, number, number, number]> = [];
  drawImageCalls: Array<[any, number, number, number, number]> = [];

  clearRect(x: number, y: number, w: number, h: number): void {
    this.clearRectCalls.push([x, y, w, h]);
  }

  drawImage(source: any, x: number, y: number, w: number, h: number): void {
    this.drawImageCalls.push([source, x, y, w, h]);
  }
}

class FakeCanvas {
  width = 0;
  height = 0;
  readonly context = new Fake2DContext();
  readonly blob = new Blob(["thumb"], { type: "image/jpeg" });
  toBlobCalls: Array<{ mimeType?: string; quality?: number }> = [];

  getContext(kind: string): Fake2DContext | null {
    if (kind !== "2d") return null;
    return this.context;
  }

  toBlob(cb: (blob: Blob | null) => void, mimeType?: string, quality?: number): void {
    this.toBlobCalls.push({ mimeType, quality });
    cb(this.blob);
  }
}

const sourceCanvas = {} as HTMLCanvasElement;

describe("palette snapshot thumbnail capture", () => {
  test("captures approximate 256x144 thumbnail from current canvas", async () => {
    const thumbCanvas = new FakeCanvas();
    const blob = await capturePaletteSnapshotThumbnail(sourceCanvas, {
      createCanvas: (w, h) => {
        thumbCanvas.width = w;
        thumbCanvas.height = h;
        return thumbCanvas as unknown as HTMLCanvasElement;
      },
    });

    expect(thumbCanvas.width).toBe(256);
    expect(thumbCanvas.height).toBe(144);
    expect(thumbCanvas.context.imageSmoothingEnabled).toBe(true);
    expect(thumbCanvas.context.drawImageCalls).toHaveLength(1);
    expect(thumbCanvas.context.drawImageCalls[0]).toEqual([sourceCanvas, 0, 0, 256, 144]);
    expect(thumbCanvas.toBlobCalls[0]).toEqual({ mimeType: "image/jpeg", quality: 0.92 });
    expect(blob).toBe(thumbCanvas.blob);
  });

  test("builds artifact with thumbnail blob alongside metadata and state", async () => {
    const thumbCanvas = new FakeCanvas();
    const draft: any = {
      metadata: { id: "id-1", version: 1, createdAt: 10, name: "Avenue - 2026-03-13 18:32" },
      sceneContext: { mapId: "Avenue", biomeId: "SEWERS", seed: 99 },
      cameraState: { cameraX: 10, cameraY: 20, cameraZoom: 2 },
      worldState: { player: { pgxi: 1, pgyi: 2 } },
    };

    const artifact = await buildPaletteSnapshotArtifactFromCanvas(draft, sourceCanvas, {
      createCanvas: (w, h) => {
        thumbCanvas.width = w;
        thumbCanvas.height = h;
        return thumbCanvas as unknown as HTMLCanvasElement;
      },
    });

    expect(artifact.metadata).toEqual(draft.metadata);
    expect(artifact.sceneContext).toEqual(draft.sceneContext);
    expect(artifact.cameraState).toEqual(draft.cameraState);
    expect(artifact.worldState).toEqual(draft.worldState);
    expect(artifact.thumbnail).toBe(thumbCanvas.blob);
  });
});
