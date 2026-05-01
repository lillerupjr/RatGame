import { Container, Graphics } from "pixi.js";
import { COLORS, RADII } from "../pixiTheme";

export type PanelOptions = {
  width: number;
  height: number;
  fill?: number;
  fillAlpha?: number;
  borderColor?: number;
  borderAlpha?: number;
  borderWidth?: number;
  radius?: number;
  glowColor?: number;
  glowAlpha?: number;
};

export class Panel extends Container {
  private bg: Graphics;
  private opts: Required<PanelOptions>;

  constructor(options: PanelOptions) {
    super();
    this.opts = {
      fill: COLORS.bgPanel,
      fillAlpha: 1,
      borderColor: COLORS.border,
      borderAlpha: 0.65,
      borderWidth: 1,
      radius: RADII.md,
      glowColor: 0,
      glowAlpha: 0,
      ...options,
    };
    this.bg = new Graphics();
    this.addChild(this.bg);
    this.redraw();
  }

  resize(width: number, height: number): void {
    this.opts.width = width;
    this.opts.height = height;
    this.redraw();
  }

  private redraw(): void {
    const o = this.opts;
    this.bg.clear();

    if (o.glowAlpha > 0 && o.glowColor) {
      this.bg
        .roundRect(-2, -2, o.width + 4, o.height + 4, o.radius + 2)
        .fill({ color: o.glowColor, alpha: o.glowAlpha });
    }

    this.bg
      .roundRect(0, 0, o.width, o.height, o.radius)
      .fill({ color: o.fill, alpha: o.fillAlpha });

    if (o.borderWidth > 0) {
      this.bg
        .roundRect(0, 0, o.width, o.height, o.radius)
        .stroke({ color: o.borderColor, alpha: o.borderAlpha, width: o.borderWidth });
    }
  }
}
