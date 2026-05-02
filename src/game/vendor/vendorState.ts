// @system   progression/objectives/rewards
// @owns     define vendor offer/state shapes and default vendor state
// @doc      docs/canonical/progression_objectives_rewards.md
// @agents   no offer generation or purchase application; see generateVendorProgressionOffers.ts and vendorPurchase.ts

import type { ProgressionRewardOption } from "../progression/rewards/progressionOffers";

export type VendorProgressionOffer = {
  id: string;
  option: ProgressionRewardOption;
  priceG: number;
  isSold: boolean;
};

export type VendorState = {
  offers: VendorProgressionOffer[];
};

export function createVendorState(offers: VendorProgressionOffer[] = []): VendorState {
  return {
    offers,
  };
}
