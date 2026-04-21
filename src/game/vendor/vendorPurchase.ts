import { addGold, getGold } from "../economy/gold";
import { applyProgressionRewardOption } from "../progression/rewards/progressionRewardFlow";

export function tryPurchaseVendorOffer(world: any, index: number): boolean {
  const vendor = world.vendor;
  if (!vendor) return false;
  const offer = vendor.offers?.[index];
  if (!offer) return false;
  if (offer.isSold) return false;
  if (getGold(world) < offer.priceG) return false;

  addGold(world, -offer.priceG);
  applyProgressionRewardOption(world, offer.option);
  offer.isSold = true;
  return true;
}
