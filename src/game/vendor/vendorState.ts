export type VendorRelicOffer = {
  relicId: string;
  priceG: number;
  isSold: boolean;
};

export type VendorState = {
  relicOffers: VendorRelicOffer[];
};

export function createVendorState(relicOffers: VendorRelicOffer[] = []): VendorState {
  return {
    relicOffers,
  };
}
