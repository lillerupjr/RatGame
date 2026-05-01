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
