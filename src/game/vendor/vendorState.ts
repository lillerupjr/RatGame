export type VendorRelicOffer = {
  relicId: string;
  priceG: number;
  isSold: boolean;
};

export type VendorState = {
  cards: string[];
  purchased: boolean[];
  relicOffers: VendorRelicOffer[];
};

export function createVendorState(cardIds: string[], relicOffers: VendorRelicOffer[] = []): VendorState {
  return {
    cards: cardIds,
    purchased: new Array(cardIds.length).fill(false),
    relicOffers,
  };
}
