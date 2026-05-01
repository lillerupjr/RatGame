import type { ProgressionRewardFamily } from "../progression/rewards/rewardFamilies";

export const VENDOR_RING_PRICE_G = 300;
export const VENDOR_MODIFIER_TOKEN_PRICE_G = 150;
export const VENDOR_HAND_EFFECT_PRICE_G = 250;

export function getVendorOfferPriceG(family: ProgressionRewardFamily): number {
  if (family === "RING") return VENDOR_RING_PRICE_G;
  if (family === "RING_MODIFIER_TOKEN") return VENDOR_MODIFIER_TOKEN_PRICE_G;
  return VENDOR_HAND_EFFECT_PRICE_G;
}
