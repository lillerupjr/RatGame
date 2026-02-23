export function applyCardToWorld(world: any, cardId: string): void {
  if (!world.cards) world.cards = [];
  world.cards.push(cardId);
}
