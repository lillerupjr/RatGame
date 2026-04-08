import { addGold, getGold } from "../economy/gold";
import { applyRelic } from "../systems/progression/relics";

export function tryPurchaseVendorRelic(world: any, index: number): boolean {
  const vendor = world.vendor;
  if (!vendor) return false;
  const offer = vendor.relicOffers?.[index];
  if (!offer) return false;
  if (offer.isSold) return false;
  if (getGold(world) < offer.priceG) return false;
  if (Array.isArray(world.relics) && world.relics.includes(offer.relicId)) return false;

  addGold(world, -offer.priceG);
  applyRelic(world, offer.relicId, { source: "shop" });
  offer.isSold = true;
  return true;
}
