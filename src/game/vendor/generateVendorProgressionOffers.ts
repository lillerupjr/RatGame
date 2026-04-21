import { RING_DEFS_V1 } from "../progression/rings/ringContent";
import type { ModifierTokenType } from "../progression/rings/ringTypes";
import type { ProgressionRewardFamily } from "../progression/rewards/rewardFamilies";
import { getVendorOfferPriceG } from "./pricing";
import type { VendorProgressionOffer } from "./vendorState";

const TOKEN_OFFERS: ModifierTokenType[] = ["LEVEL_UP", "INCREASED_EFFECT_20"];

function rngNext(world: any): number {
  if (typeof world?.rng?.float === "function") return world.rng.float();
  if (typeof world?.rng?.next === "function") return world.rng.next();
  return Math.random();
}

function pickIndex(world: any, length: number): number {
  if (length <= 1) return 0;
  return Math.floor(Math.max(0, Math.min(0.999999999, rngNext(world))) * length);
}

function makeOffer(family: ProgressionRewardFamily, optionId: string, index: number): VendorProgressionOffer {
  return {
    id: `vendor-offer-${family}-${optionId}-${index}`,
    family,
    optionId,
    priceG: getVendorOfferPriceG(family),
    isSold: false,
  };
}

export function generateVendorProgressionOffers(world: any, count = 5): VendorProgressionOffer[] {
  const offers: VendorProgressionOffer[] = [];
  const rings = [...RING_DEFS_V1];

  while (offers.length < count && rings.length > 0) {
    const idx = pickIndex(world, rings.length);
    const [ring] = rings.splice(idx, 1);
    offers.push(makeOffer("RING", ring.id, offers.length));
  }

  for (const token of TOKEN_OFFERS) {
    if (offers.length >= count) break;
    offers.push(makeOffer("RING_MODIFIER_TOKEN", token, offers.length));
  }

  return offers;
}
