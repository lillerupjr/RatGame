import { Container, Graphics, Text } from "pixi.js";
import { Panel } from "../primitives/Panel";
import { createTextLabel } from "../primitives/TextLabel";
import { COLORS, SPACING, TEXT_STYLES } from "../pixiTheme";
import type { HandsSlotSnapshot, HandsScreenSnapshot } from "./handsDataBridge";

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
    barBg.rect(0, yPos, contentW, 3).fill({ color: 0x1f1915 });
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

    // ── Equipped rings list ──
    const divider1 = new Graphics();
    divider1.rect(0, yPos, contentW + 20, 1).fill({ color: COLORS.border, alpha: 0.65 });
    this.contentContainer.addChild(divider1);
    yPos += SPACING.md;

    const ringsHeader = createTextLabel("EQUIPPED RINGS", "sectionHeader");
    ringsHeader.y = yPos;
    this.contentContainer.addChild(ringsHeader);
    yPos += 18;

    for (const slot of snapshot.slots) {
      yPos = this.addRingListEntry(slot, yPos, contentW);
    }

    yPos += 4;

    // ── Attributes ──
    const divider2 = new Graphics();
    divider2.rect(0, yPos, contentW + 20, 1).fill({ color: COLORS.border, alpha: 0.65 });
    this.contentContainer.addChild(divider2);
    yPos += SPACING.md;

    const attrHeader = createTextLabel("ATTRIBUTES", "sectionHeader");
    attrHeader.y = yPos;
    this.contentContainer.addChild(attrHeader);
    yPos += 18;

    const stats = snapshot.stats;
    const statRows: Array<[string, string]> = [
      ["Shots/sec", stats.shotsPerSecond.toFixed(2)],
      ["Base Physical", stats.baseDamage.physical.toFixed(1)],
      ["Base Fire", stats.baseDamage.fire.toFixed(1)],
      ["Base Chaos", stats.baseDamage.chaos.toFixed(1)],
      ["Crit Chance", `${Math.round(stats.critChance * 100)}%`],
      ["Crit Multi", `${stats.critMulti.toFixed(2)}x`],
      ["Poison Chance", `${Math.round(stats.chanceToPoison * 100)}%`],
      ["Ignite Chance", `${Math.round(stats.chanceToIgnite * 100)}%`],
      ["Bleed Chance", `${Math.round(stats.chanceToBleed * 100)}%`],
    ];

    for (const [label, value] of statRows) {
      yPos = this.addStatRow(label, value, yPos, contentW);
    }
  }

  private addRingListEntry(slot: HandsSlotSnapshot, y: number, contentW: number): number {
    const dotColor = slot.equipped ? COLORS.gold : COLORS.textMuted;
    const dot = new Graphics();
    dot.circle(2.5, y + 7, 2.5).fill({ color: dotColor });
    if (slot.equipped) {
      dot.circle(2.5, y + 7, 4).fill({ color: dotColor, alpha: 0.2 });
    }
    this.contentContainer.addChild(dot);

    const nameStyle = TEXT_STYLES.body.clone();
    nameStyle.fontSize = 11;
    nameStyle.fill = slot.equipped ? COLORS.text : COLORS.textMuted;
    nameStyle.letterSpacing = 0.25;
    const nameText = new Text({ text: slot.ringName ?? "- Empty -", style: nameStyle });
    nameText.x = 14;
    nameText.y = y;
    this.contentContainer.addChild(nameText);

    const slotStyle = TEXT_STYLES.muted.clone();
    slotStyle.fontSize = 9;
    slotStyle.letterSpacing = 0.6;
    const slotLabel = new Text({ text: slot.slotId, style: slotStyle });
    slotLabel.x = 14;
    slotLabel.y = y + 14;
    this.contentContainer.addChild(slotLabel);

    return y + 30;
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
    div.rect(0, y + 22, contentW, 1).fill({ color: 0x2e2318, alpha: 0.5 });
    this.contentContainer.addChild(div);

    return y + 30;
  }
}
