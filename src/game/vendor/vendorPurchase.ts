import { addGold, getGold } from "../economy/gold";
import { grantCardToPlayer } from "../combat_mods/rewards/cardGranting";

export function tryPurchaseVendorCard(world: any, index: number): boolean {
  const vendor = world.vendor;
  if (!vendor) return false;
  if (vendor.purchased[index]) return false;

  const price = 100;
  if (getGold(world) < price) return false;

  addGold(world, -price);

  const cardId = vendor.cards[index];
  if (typeof cardId !== "string") return false;
  grantCardToPlayer(world, cardId);

  vendor.purchased[index] = true;
  return true;
}
