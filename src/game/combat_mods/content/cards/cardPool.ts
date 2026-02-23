import { STARTER_CARDS_V1 } from "./starterCards";

export function getAllCardIds(): string[] {
  return STARTER_CARDS_V1.map((c) => c.id);
}
