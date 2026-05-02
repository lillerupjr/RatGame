import { Container, Graphics, Text } from "pixi.js";
import { COLORS, TEXT_STYLES } from "../pixiTheme";

export class AcquisitionBanner extends Container {
  private bg: Graphics;
  private dot: Graphics;
  private bannerLabel: Text;
  private maxH: number;
  private _pulseTime = 0;
  private _color: number = COLORS.green;
  private _width: number;

  constructor(width: number, height: number) {
    super();
    this.maxH = height;
    this._width = width;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.dot = new Graphics();
    this.dot.circle(0, 0, 3).fill({ color: COLORS.green });
    this.dot.circle(0, 0, 5).fill({ color: COLORS.green, alpha: 0.2 });
    this.dot.x = 24;
    this.dot.y = height / 2;
    this.addChild(this.dot);

    const labelStyle = TEXT_STYLES.accent.clone();
    labelStyle.fontSize = 11;
    labelStyle.fill = COLORS.green;
    labelStyle.letterSpacing = 1.0;
    this.bannerLabel = new Text({
      text: "NEW RING FOUND \u2014 Select a finger to equip",
      style: labelStyle,
    });
    this.bannerLabel.x = 38;
    this.bannerLabel.y = (height - this.bannerLabel.height) / 2;
    this.addChild(this.bannerLabel);

    this.drawBg(width);
  }

  private drawBg(width: number): void {
    this._width = width;
    this.bg.clear();
    this.bg
      .rect(0, 0, width, this.maxH)
      .fill({ color: this._color, alpha: 0.06 });
    this.bg
      .rect(0, this.maxH - 1, width, 1)
      .fill({ color: this._color, alpha: 0.3 });
  }

  private redrawDot(): void {
    this.dot.clear();
    this.dot.circle(0, 0, 3).fill({ color: this._color });
    this.dot.circle(0, 0, 5).fill({ color: this._color, alpha: 0.2 });
  }

  setColor(color: number): void {
    if (color === this._color) return;
    this._color = color;
    this.redrawDot();
    this.drawBg(this._width);
    (this.bannerLabel.style as any).fill = color;
  }

  resizeBanner(width: number): void {
    this.drawBg(width);
  }

  tickPulse(dtMs: number): void {
    this._pulseTime += dtMs * 0.004;
    this.dot.alpha = 0.6 + 0.4 * Math.sin(this._pulseTime);
  }
}
