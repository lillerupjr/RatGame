import { Container, Graphics, Text } from "pixi.js";
import { Panel } from "../primitives/Panel";
import { createTextLabel } from "../primitives/TextLabel";
import { COLORS, SPACING, TEXT_STYLES } from "../pixiTheme";
import type { HandsScreenSnapshot } from "./handsDataBridge";
import type { ResolvedWeaponStats } from "../../../game/combat_mods/stats/combatStatsResolver";

export type StatDelta = {
  shotsPerSecond: number;
  critChance: number;
  critMulti: number;
  basePhysical: number;
  chanceToPoison: number;
};

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

  update(snapshot: HandsScreenSnapshot | null, deltas?: StatDelta | null): void {
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
    const statRows: Array<[string, string, number | null]> = [
      ["Shots/sec", stats.shotsPerSecond.toFixed(2), deltas?.shotsPerSecond ?? null],
      ["Crit Chance", `${Math.round(stats.critChance * 100)}%`, deltas ? deltas.critChance * 100 : null],
      ["Crit Multi", `${stats.critMulti.toFixed(2)}x`, deltas?.critMulti ?? null],
      ["Base Physical", stats.baseDamage.physical.toFixed(1), deltas?.basePhysical ?? null],
      ["Poison Chance", `${Math.round(stats.chanceToPoison * 100)}%`, deltas ? deltas.chanceToPoison * 100 : null],
    ];

    for (const [label, value, delta] of statRows) {
      yPos = this.addStatRow(label, value, yPos, contentW, delta);
    }

    // ── Tokens ──
    const tokens = snapshot.storedTokens;
    const totalTokens = tokens.LEVEL_UP + tokens.INCREASED_EFFECT_20;
    if (totalTokens > 0) {
      yPos += 4;
      const tokenDivider = new Graphics();
      tokenDivider.rect(0, yPos, contentW + 20, 1).fill({ color: COLORS.border, alpha: 0.65 });
      this.contentContainer.addChild(tokenDivider);
      yPos += SPACING.md;

      const tokenHeader = createTextLabel("TOKENS", "sectionHeader");
      tokenHeader.y = yPos;
      this.contentContainer.addChild(tokenHeader);
      yPos += 18;

      if (tokens.LEVEL_UP > 0) {
        yPos = this.addTokenRow("Level Up", tokens.LEVEL_UP, yPos, contentW);
      }
      if (tokens.INCREASED_EFFECT_20 > 0) {
        yPos = this.addTokenRow("+20% Effect", tokens.INCREASED_EFFECT_20, yPos, contentW);
      }
    }
  }

  private addStatRow(label: string, value: string, y: number, contentW: number, delta: number | null): number {
    const labelText = createTextLabel(label, "statLabel");
    labelText.y = y;
    this.contentContainer.addChild(labelText);

    const valueText = createTextLabel(value, "statValue");
    valueText.x = contentW - valueText.width;
    valueText.y = y;
    this.contentContainer.addChild(valueText);

    // Delta indicator
    if (delta !== null && Math.abs(delta) > 0.01) {
      const isPositive = delta > 0;
      const deltaStr = isPositive ? `+${formatDelta(delta)}` : formatDelta(delta);
      const deltaStyle = TEXT_STYLES.muted.clone();
      deltaStyle.fill = isPositive ? COLORS.green : COLORS.crimson;
      deltaStyle.fontSize = 10;
      const deltaText = new Text({ text: deltaStr, style: deltaStyle });
      deltaText.x = contentW - valueText.width - deltaText.width - 6;
      deltaText.y = y + 1;
      this.contentContainer.addChild(deltaText);
    }

    // Divider
    const div = new Graphics();
    div.rect(0, y + 22, contentW, 1).fill({ color: COLORS.border, alpha: 0.3 });
    this.contentContainer.addChild(div);

    return y + 30;
  }

  private addTokenRow(label: string, count: number, y: number, contentW: number): number {
    const labelText = createTextLabel(label, "statLabel");
    labelText.y = y;
    this.contentContainer.addChild(labelText);

    const countStyle = TEXT_STYLES.statValue.clone();
    countStyle.fill = COLORS.amber;
    const countText = new Text({ text: String(count), style: countStyle });
    countText.x = contentW - countText.width;
    countText.y = y;
    this.contentContainer.addChild(countText);

    return y + 24;
  }
}

function formatDelta(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}
