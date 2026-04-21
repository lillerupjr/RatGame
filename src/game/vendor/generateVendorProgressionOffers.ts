import { generateProgressionOffers } from "../progression/rewards/progressionOffers";
import { getVendorOfferPriceG } from "./pricing";
import type { VendorProgressionOffer } from "./vendorState";

function makeOffer(option: VendorProgressionOffer["option"], index: number): VendorProgressionOffer {
  return {
    id: `vendor-offer-${option.family}-${option.id}-${index}`,
    option,
    priceG: getVendorOfferPriceG(option.family),
    isSold: false,
  };
}

export function generateVendorProgressionOffers(world: any, count = 5): VendorProgressionOffer[] {
  const offers: VendorProgressionOffer[] = [];
  const ringOptions = generateProgressionOffers(world, "RING", "SIDE_OBJECTIVE", count);
  const tokenOptions = generateProgressionOffers(world, "RING_MODIFIER_TOKEN", "SIDE_OBJECTIVE", count);
  const reservedTokenSlots = count >= 5 ? 2 : count >= 3 ? 1 : 0;
  const ringTargetCount = Math.max(0, count - Math.min(reservedTokenSlots, tokenOptions.length));

  for (const option of ringOptions) {
    if (offers.length >= ringTargetCount) break;
    offers.push(makeOffer(option, offers.length));
  }

  for (const option of tokenOptions) {
    if (offers.length >= count) break;
    offers.push(makeOffer(option, offers.length));
  }

  return offers;
}
