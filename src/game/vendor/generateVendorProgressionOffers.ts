// @system   progression/objectives/rewards
// @owns     generate and price vendor progression offers
// @doc      docs/canonical/progression_objectives_rewards.md
// @agents   no purchase mutation or shop UI; see vendorPurchase.ts

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
  for (const option of ringOptions) {
    offers.push(makeOffer(option, offers.length));
  }

  return offers;
}
