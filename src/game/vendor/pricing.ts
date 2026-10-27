import type { ProgressionRewardFamily } from "../progression/rewards/rewardFamilies";

export const VENDOR_RING_PRICE_G = 300;

export function getVendorOfferPriceG(family: ProgressionRewardFamily): number {
  return VENDOR_RING_PRICE_G;
}
