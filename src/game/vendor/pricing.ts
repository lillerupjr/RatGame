import { getCardById } from "../combat_mods/content/cards/cardPool";

export const VENDOR_RELIC_PRICE_G = 300;

export function getVendorCardPriceG(cardId: string): number {
  const tier = Math.max(1, Math.floor(getCardById(cardId)?.powerTier ?? 1));
  return tier * 50;
}

