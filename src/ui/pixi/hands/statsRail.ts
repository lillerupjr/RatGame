import { Container, Graphics, Text } from "pixi.js";
import { Panel } from "../primitives/Panel";
import { createTextLabel } from "../primitives/TextLabel";
import { COLORS, SPACING, TEXT_STYLES } from "../pixiTheme";
import type { HandsScreenSnapshot } from "./handsDataBridge";

export class StatsRail extends Container {
  private panel: Panel;
  private contentContainer: Container;
  private width_: number;
  private height_: number;

  constructor(width: number, height: number) {
    super();
    this.width_ = width;
    this.height_ = height;

    this.panel = new Panel({
      width,
      height,
      fill: COLORS.bgPanel,
      borderColor: COLORS.border,
      borderWidth: 1,
      radius: 0,
    });
    this.addChild(this.panel);

    this.contentContainer = new Container();
    this.contentContainer.x = SPACING.xl;
    this.contentContainer.y = 0;
    this.addChild(this.contentContainer);
  }

  resize(width: number, height: number): void {
    this.width_ = width;
    this.height_ = height;
    this.panel.resize(width, height);
  }

  update(snapshot: HandsScreenSnapshot | null): void {
    this.contentContainer.removeChildren();
    if (!snapshot) return;

    let yPos: number = SPACING.lg;
    const contentW = this.width_ - SPACING.xl * 2;

    // ── Character header ──
    const charHeader = createTextLabel("CHARACTER", "sectionHeader");
    charHeader.y = yPos;
    this.contentContainer.addChild(charHeader);
    yPos += 22;

    const charName = createTextLabel("Gnaw", "charName");
    charName.y = yPos;
    this.contentContainer.addChild(charName);
    yPos += 26;

    // Equip progress bar
    const barBg = new Graphics();
    barBg.rect(0, yPos, contentW, 3).fill({ color: COLORS.bgPanel2 });
    this.contentContainer.addChild(barBg);

    const fillW = (snapshot.equippedCount / 8) * contentW;
    if (fillW > 0) {
      const barFill = new Graphics();
      barFill.rect(0, yPos, fillW, 3).fill({ color: COLORS.goldDim });
      this.contentContainer.addChild(barFill);
    }

    const equipText = createTextLabel(`${snapshot.equippedCount}/8`, "equipProgress");
    equipText.x = contentW + 6;
    equipText.y = yPos - 4;
    this.contentContainer.addChild(equipText);
    yPos += 18;

    // ── Attributes ──
    const divider = new Graphics();
    divider.rect(0, yPos, contentW + 20, 1).fill({ color: COLORS.border, alpha: 0.65 });
    this.contentContainer.addChild(divider);
    yPos += SPACING.md;

    const attrHeader = createTextLabel("ATTRIBUTES", "sectionHeader");
    attrHeader.y = yPos;
    this.contentContainer.addChild(attrHeader);
    yPos += 18;

    const stats = snapshot.stats;
    const statRows: Array<[string, string]> = [
      ["Shots/sec", stats.shotsPerSecond.toFixed(2)],
      ["Crit Chance", `${Math.round(stats.critChance * 100)}%`],
      ["Crit Multi", `${stats.critMulti.toFixed(2)}x`],
      ["Base Physical", stats.baseDamage.physical.toFixed(1)],
      ["Poison Chance", `${Math.round(stats.chanceToPoison * 100)}%`],
    ];

    for (const [label, value] of statRows) {
      yPos = this.addStatRow(label, value, yPos, contentW);
    }
  }

  private addStatRow(label: string, value: string, y: number, contentW: number): number {
    const labelText = createTextLabel(label, "statLabel");
    labelText.y = y;
    this.contentContainer.addChild(labelText);

    const valueText = createTextLabel(value, "statValue");
    valueText.x = contentW - valueText.width;
    valueText.y = y;
    this.contentContainer.addChild(valueText);

    // Divider
    const div = new Graphics();
    div.rect(0, y + 22, contentW, 1).fill({ color: COLORS.border, alpha: 0.3 });
    this.contentContainer.addChild(div);

    return y + 30;
  }
}
