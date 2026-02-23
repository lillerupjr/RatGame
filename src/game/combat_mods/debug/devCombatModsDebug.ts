import { STARTER_CARDS_V1, getStarterCardById } from "../content/cards/starterCards";
import { JACK_PISTOL_V1 } from "../content/weapons/jackPistol";
import { resolveWeaponStats } from "../stats/combatStatsResolver";

const devGrantedCardIds: string[] = [];

function grantCard(id: string): void {
  if (!getStarterCardById(id)) return;
  devGrantedCardIds.push(id);
  console.info("[combat_mods][dev] granted", id, "cards=", [...devGrantedCardIds]);
}

function printResolvedStats(): void {
  const cards = devGrantedCardIds
    .map((id) => getStarterCardById(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const resolved = resolveWeaponStats(JACK_PISTOL_V1, { cards });
  console.info("[combat_mods][dev] pistol stats", {
    grantedCardIds: [...devGrantedCardIds],
    grantedCards: cards.map((c) => c.id),
    availableCardCount: STARTER_CARDS_V1.length,
    resolved,
  });
}

export function handleDevCombatModsKeys(e: KeyboardEvent): boolean {
  if (!import.meta.env.DEV) return false;
  if (e.repeat) return false;

  if (e.code === "F6") {
    e.preventDefault();
    grantCard("CARD_DAMAGE_FLAT_1");
    return true;
  }

  if (e.code === "F7") {
    e.preventDefault();
    grantCard("CARD_CONVERT_FIRE_1");
    return true;
  }

  if (e.code === "F8") {
    e.preventDefault();
    grantCard("CARD_IGNITE_CHANCE_1");
    return true;
  }

  if (e.code === "F9") {
    e.preventDefault();
    printResolvedStats();
    return true;
  }

  return false;
}

export function getDevGrantedCardIds(): readonly string[] {
  return devGrantedCardIds;
}
