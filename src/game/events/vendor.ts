import type { World } from "../../engine/world/world";
import type { FloorIntent } from "../map/floorIntent";
import { RNG } from "../util/rng";
import { RELICS } from "../content/relics";

export type VendorOffer = {
  kind: "RELIC" | "UPGRADE" | "HEAL" | "REROLL";
  id: string;
  cost: number;
};

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function buildVendorSeed(intent: FloorIntent): number {
  return hashString(`${intent.nodeId}|${intent.depth}|${intent.zoneId}`);
}

export function generateVendorOffers(intent: FloorIntent): VendorOffer[] {
  const rng = new RNG(buildVendorSeed(intent));
  const offers: VendorOffer[] = [];

  const kinds: VendorOffer["kind"][] = ["RELIC", "UPGRADE", "HEAL", "REROLL"];
  for (let i = 0; i < 4; i++) {
    const kind = kinds[i];
    const relic = RELICS.length > 0 ? RELICS[rng.int(0, RELICS.length - 1)].id : "RELIC_UNKNOWN";
    offers.push({
      kind,
      id: kind === "RELIC" ? relic : `${kind}_${intent.depth}_${i + 1}`,
      cost: 10 + rng.int(0, 10) + intent.depth * 2,
    });
  }

  return offers;
}

export function applyVendorPurchase(world: World, offer: VendorOffer): boolean {
  if (world.gold < offer.cost) return false;
  world.gold -= offer.cost;
  world.vendorPurchases = [...(world.vendorPurchases ?? []), offer.id];
  return true;
}
