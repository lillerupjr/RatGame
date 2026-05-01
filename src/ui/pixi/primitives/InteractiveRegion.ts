import { Container, Graphics } from "pixi.js";

export type InteractiveRegionOptions = {
  width: number;
  height: number;
  shape?: "rect" | "circle";
  onHoverChange?: (hovered: boolean) => void;
  onPress?: () => void;
  cursor?: string;
};

export class InteractiveRegion extends Container {
  private hitGfx: Graphics;
  isHovered = false;

  constructor(private opts: InteractiveRegionOptions) {
    super();
    this.hitGfx = new Graphics();
    this.drawHitArea();
    this.hitGfx.alpha = 0;
    this.addChild(this.hitGfx);

    this.eventMode = "static";
    this.cursor = opts.cursor ?? "pointer";

    this.on("pointerover", this.onOver, this);
    this.on("pointerout", this.onOut, this);
    this.on("pointertap", this.onTap, this);
  }

  private drawHitArea(): void {
    this.hitGfx.clear();
    if (this.opts.shape === "circle") {
      const r = this.opts.width / 2;
      this.hitGfx.circle(r, r, r).fill({ color: 0xffffff });
    } else {
      this.hitGfx
        .rect(0, 0, this.opts.width, this.opts.height)
        .fill({ color: 0xffffff });
    }
  }

  private onOver(): void {
    this.isHovered = true;
    this.opts.onHoverChange?.(true);
  }

  private onOut(): void {
    this.isHovered = false;
    this.opts.onHoverChange?.(false);
  }

  private onTap(): void {
    this.opts.onPress?.();
  }

  resize(width: number, height: number): void {
    this.opts.width = width;
    this.opts.height = height;
    this.drawHitArea();
  }

  setOnPress(fn: (() => void) | null): void {
    this.opts.onPress = fn ?? undefined;
  }
}
