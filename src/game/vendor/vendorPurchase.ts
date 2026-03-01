import { addGold, getGold } from "../economy/gold";
import { grantCardToPlayer } from "../combat_mods/rewards/cardGranting";
import { applyRelic } from "../systems/progression/relics";
import { getVendorCardPriceG } from "./pricing";

export function tryPurchaseVendorCard(world: any, index: number): boolean {
  const vendor = world.vendor;
  if (!vendor) return false;
  if (vendor.purchased[index]) return false;

  const cardId = vendor.cards[index];
  if (typeof cardId !== "string") return false;
  const price = getVendorCardPriceG(cardId);
  if (getGold(world) < price) return false;

  addGold(world, -price);
  grantCardToPlayer(world, cardId);

  vendor.purchased[index] = true;
  return true;
}

export function tryPurchaseVendorRelic(world: any, index: number): boolean {
  const vendor = world.vendor;
  if (!vendor) return false;
  const offer = vendor.relicOffers?.[index];
  if (!offer) return false;
  if (offer.isSold) return false;
  if (getGold(world) < offer.priceG) return false;
  if (Array.isArray(world.relics) && world.relics.includes(offer.relicId)) return false;

  addGold(world, -offer.priceG);
  applyRelic(world, offer.relicId);
  offer.isSold = true;
  return true;
}
