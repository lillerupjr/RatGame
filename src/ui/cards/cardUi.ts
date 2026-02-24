import { getCardById } from "../../game/combat_mods/content/cards/cardPool";
import type { ModOp, StatMod } from "../../game/combat_mods/stats/modifierTypes";

type CardTier = 1 | 2 | 3 | 4 | 5;

export type CardViewModel = {
  id: string;
  name: string;
  tier: CardTier | null;
  rarity: 1 | 2 | 3 | 4 | null;
  lines: string[];
};

function toTitleCase(input: string): string {
  const words = input.toLowerCase().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    out.push(w.charAt(0).toUpperCase() + w.slice(1));
  }
  return out.join(" ");
}

function formatCardName(raw: string): string {
  const noPrefix = raw.replace(/^card[_\s-]*/i, "");
  const spaced = noPrefix.replace(/[_-]+/g, " ").trim();
  if (!spaced) return raw;
  return toTitleCase(spaced);
}

const STAT_LABELS: Record<string, string> = {
  "damage.add.physical": "Physical damage",
  "damage.add.fire": "Fire damage",
  "damage.add.chaos": "Chaos damage",
  "damage.increased": "Damage",
  "damage.more": "Damage",
  "shotsPerSecond.increased": "Fire rate",
  "shotsPerSecond.more": "Fire rate",
  "critChance.add": "Crit chance",
  "critMulti.add": "Crit multiplier",
  "spreadBaseDeg.add": "Spread",
  "projectiles.add": "Projectiles",
  "projectileSpeed.increased": "Projectile speed",
  "pierce.add": "Pierce",
  "chanceToBleed.add": "Bleed chance",
  "chanceToIgnite.add": "Ignite chance",
  "chanceToPoison.add": "Poison chance",
  "convert.physicalToFire": "Physical -> Fire",
  "convert.physicalToChaos": "Physical -> Chaos",
  "convert.fireToChaos": "Fire -> Chaos",
  "life.add": "Max life",
  "damageReduction.add": "Damage reduction",
};

function isPercentOp(op: ModOp): boolean {
  return op === "increased" || op === "more";
}

function formatValue(mod: StatMod): string {
  if (isPercentOp(mod.op)) {
    const val = Math.round(mod.value * 1000) / 10;
    const sign = val > 0 ? "+" : "";
    return `${sign}${val}%`;
  }
  const val = Math.round(mod.value * 100) / 100;
  const sign = val > 0 ? "+" : "";
  return `${sign}${val}`;
}

function formatOp(mod: StatMod): string {
  if (mod.op === "more") return " more";
  if (mod.op === "increased") return " increased";
  return "";
}

function formatModLine(mod: StatMod): string {
  const label = STAT_LABELS[mod.key] ?? mod.key;
  return `${formatValue(mod)} ${label}${formatOp(mod)}`;
}

export function rarityClass(rarity: number | null | undefined): string {
  if (rarity === 4) return "rarity-4";
  if (rarity === 3) return "rarity-3";
  if (rarity === 2) return "rarity-2";
  return "rarity-1";
}

export function cardViewModel(cardId: string): CardViewModel {
  const card = getCardById(cardId);
  if (!card) {
    return {
      id: cardId,
      name: formatCardName(cardId),
      tier: null,
      rarity: null,
      lines: ["(No description)"],
    };
  }
  const lines = card.mods.length > 0
    ? card.mods.slice(0, 2).map((mod) => formatModLine(mod))
    : ["(No description)"];
  return {
    id: cardId,
    name: formatCardName(card.displayName ?? cardId),
    tier: card.powerTier ?? null,
    rarity: card.rarity ?? null,
    lines,
  };
}
