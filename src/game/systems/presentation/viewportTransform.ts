export type ViewportWorldRect = {
  top: number;
  bottom: number;
  width: number;
  height: number;
};

export type ViewportTransformInit = {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  visibleVerticalTiles: number;
  tileWorldUnits: number;
  uiTopPx?: number;
  uiBottomPx?: number;
};

type WorldProjector = (worldX: number, worldY: number) => { x: number; y: number };

export class ViewportTransform {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly dpr: number;
  readonly worldRect: ViewportWorldRect;
  readonly zoom: number;
  readonly visibleWorldWidth: number;
  readonly visibleWorldHeight: number;
  readonly safeOffsetCssX: number;
  readonly safeOffsetCssY: number;
  readonly safeOffsetDeviceX: number;
  readonly safeOffsetDeviceY: number;
  readonly worldScaleDevice: number;
  private worldProjector: WorldProjector | null = null;

  camTx = 0;
  camTy = 0;

  constructor(init: ViewportTransformInit) {
    const cssWidth = Math.max(1, init.cssWidth);
    const cssHeight = Math.max(1, init.cssHeight);
    const dpr = Math.max(1, init.dpr || 1);
    const uiTopPx = Math.max(0, init.uiTopPx ?? 0);
    const uiBottomPx = Math.max(0, init.uiBottomPx ?? 0);
    const worldRectHeight = Math.max(1, cssHeight - uiTopPx - uiBottomPx);
    const visibleWorldHeight = Math.max(1, init.visibleVerticalTiles * init.tileWorldUnits);
    const zoom = worldRectHeight / visibleWorldHeight;
    const visibleWorldWidth = cssWidth / zoom;

    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr;
    this.worldRect = {
      top: uiTopPx,
      bottom: uiBottomPx,
      width: cssWidth,
      height: worldRectHeight,
    };
    this.zoom = zoom;
    this.visibleWorldWidth = visibleWorldWidth;
    this.visibleWorldHeight = visibleWorldHeight;
    this.safeOffsetCssX = 0;
    this.safeOffsetCssY = uiTopPx;
    this.safeOffsetDeviceX = this.safeOffsetCssX * dpr;
    this.safeOffsetDeviceY = this.safeOffsetCssY * dpr;
    this.worldScaleDevice = dpr * zoom;
  }

  centerOnProjected(projectedX: number, projectedY: number): void {
    const centerX = this.visibleWorldWidth * 0.5;
    const centerY = this.visibleWorldHeight * 0.5;
    this.camTx = Math.round(centerX - projectedX);
    this.camTy = Math.round(centerY - projectedY);
  }

  applyWorldTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(
      this.worldScaleDevice,
      0,
      0,
      this.worldScaleDevice,
      this.safeOffsetDeviceX,
      this.safeOffsetDeviceY,
    );
    ctx.translate(this.camTx, this.camTy);
  }

  applyWorld(ctx: CanvasRenderingContext2D): void {
    this.applyWorldTransform(ctx);
  }

  setWorldProjector(projector: WorldProjector): void {
    this.worldProjector = projector;
  }

  projectProjectedToCss(projectedX: number, projectedY: number): { x: number; y: number } {
    return {
      x: this.safeOffsetCssX + (projectedX + this.camTx) * this.zoom,
      y: this.safeOffsetCssY + (projectedY + this.camTy) * this.zoom,
    };
  }

  projectProjectedToDevice(projectedX: number, projectedY: number): { x: number; y: number } {
    const p = this.projectProjectedToCss(projectedX, projectedY);
    return {
      x: p.x * this.dpr,
      y: p.y * this.dpr,
    };
  }

  project(worldX: number, worldY: number, zPx: number = 0): { cssX: number; cssY: number; x: number; y: number } {
    if (!this.worldProjector) {
      throw new Error("ViewportTransform world projector is not configured");
    }
    const projected = this.worldProjector(worldX, worldY);
    const css = this.projectProjectedToCss(projected.x, projected.y - zPx);
    return {
      cssX: css.x,
      cssY: css.y,
      x: css.x * this.dpr,
      y: css.y * this.dpr,
    };
  }

  projectToView(worldX: number, worldY: number, zPx: number = 0): { x: number; y: number } {
    if (!this.worldProjector) {
      throw new Error("ViewportTransform world projector is not configured");
    }
    const projected = this.worldProjector(worldX, worldY);
    return {
      x: projected.x,
      y: projected.y - zPx,
    };
  }

  getPatternOffsetDevice(): { x: number; y: number } {
    const worldOffsetX = this.camTx + this.safeOffsetCssX / this.zoom;
    const worldOffsetY = this.camTy + this.safeOffsetCssY / this.zoom;
    return {
      x: Math.round(worldOffsetX * this.worldScaleDevice),
      y: Math.round(worldOffsetY * this.worldScaleDevice),
    };
  }
}
