export function isPoisonCard(cardId: string): boolean {
  return cardId.toUpperCase().includes("POISON");
}

export function isIgniteCard(cardId: string): boolean {
  return cardId.toUpperCase().includes("IGNITE");
}

export function isCardVisibleForCharacter(cardId: string, characterId?: string): boolean {
  if (isPoisonCard(cardId)) return characterId === "HOBO";
  if (isIgniteCard(cardId)) return characterId === "JOEY";
  return true;
}
