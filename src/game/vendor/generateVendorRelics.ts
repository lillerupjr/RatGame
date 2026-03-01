import { getAllRelicIds, getRelicById } from "../content/relics";
import type { VendorRelicOffer } from "./vendorState";
import { VENDOR_RELIC_PRICE_G } from "./pricing";

export function generateVendorRelicOffers(world: any, count = 5, priceG = VENDOR_RELIC_PRICE_G): VendorRelicOffer[] {
  const owned = new Set<string>(Array.isArray(world?.relics) ? world.relics : []);
  const pool = getAllRelicIds().filter((id) => {
    const def = getRelicById(id);
    if (!def || !def.isEnabled) return false;
    if (owned.has(id)) return false;
    return true;
  });
  const offers: VendorRelicOffer[] = [];
  while (offers.length < count && pool.length > 0) {
    const idx = world.rng.int(0, pool.length - 1);
    const relicId = pool[idx];
    pool.splice(idx, 1);
    offers.push({ relicId, priceG, isSold: false });
  }
  return offers;
}
