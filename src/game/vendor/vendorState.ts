import type { ProgressionRewardFamily } from "../progression/rewards/rewardFamilies";

export type VendorProgressionOffer = {
  id: string;
  family: ProgressionRewardFamily;
  optionId: string;
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
