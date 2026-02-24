export type VendorState = {
  cards: string[];
  purchased: boolean[];
};

export function createVendorState(cardIds: string[]): VendorState {
  return {
    cards: cardIds,
    purchased: new Array(cardIds.length).fill(false),
  };
}
