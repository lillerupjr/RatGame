import { addGold, getGold } from "../economy/gold";
import { recomputeDerivedStats } from "../stats/derivedStats";
import { equipRing, grantModifierToken } from "../progression/rings/ringState";
import type { ModifierTokenType } from "../progression/rings/ringTypes";

export function tryPurchaseVendorOffer(world: any, index: number): boolean {
  const vendor = world.vendor;
  if (!vendor) return false;
  const offer = vendor.offers?.[index];
  if (!offer) return false;
  if (offer.isSold) return false;
  if (getGold(world) < offer.priceG) return false;

  addGold(world, -offer.priceG);
  if (offer.family === "RING") {
    equipRing(world, offer.optionId);
    recomputeDerivedStats(world);
  } else if (offer.family === "RING_MODIFIER_TOKEN") {
    grantModifierToken(world, offer.optionId as ModifierTokenType);
  }
  offer.isSold = true;
  return true;
}
