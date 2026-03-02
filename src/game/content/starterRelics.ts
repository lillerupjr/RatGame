import { PLAYABLE_CHARACTERS, type PlayableCharacterId } from "./playableCharacters";
import { getRelicById } from "./relics";

export const STARTER_RELIC_IDS = {
  STREET_REFLEX: "STARTER_STREET_REFLEX",
  LUCKY_CHAMBER: "STARTER_LUCKY_CHAMBER",
  CONTAMINATED_ROUNDS: "STARTER_CONTAMINATED_ROUNDS",
  POINT_BLANK_CARNAGE: "STARTER_POINT_BLANK_CARNAGE",
  THERMAL_STARTER: "STARTER_THERMAL_STARTER",
} as const;

export const STARTER_RELIC_BY_CHARACTER: Record<PlayableCharacterId, string> = {
  JAMAL: STARTER_RELIC_IDS.STREET_REFLEX,
  JACK: STARTER_RELIC_IDS.LUCKY_CHAMBER,
  HOBO: STARTER_RELIC_IDS.CONTAMINATED_ROUNDS,
  TOMMY: STARTER_RELIC_IDS.POINT_BLANK_CARNAGE,
  JOEY: STARTER_RELIC_IDS.THERMAL_STARTER,
};

type ValidateStarterRelicsOptions = {
  allowDuplicates?: boolean;
};

export function validateStarterRelics(options?: ValidateStarterRelicsOptions): void {
  const allowDuplicates = !!options?.allowDuplicates;
  const errors: string[] = [];
  const seenRelics = new Set<string>();

  for (let i = 0; i < PLAYABLE_CHARACTERS.length; i++) {
    const character = PLAYABLE_CHARACTERS[i];
    const relicId = STARTER_RELIC_BY_CHARACTER[character.id];
    if (!relicId) {
      errors.push(`Missing starter relic mapping for character ${character.id}.`);
      continue;
    }
    if (!allowDuplicates && seenRelics.has(relicId)) {
      errors.push(`Starter relic ${relicId} is assigned to multiple characters.`);
      continue;
    }
    seenRelics.add(relicId);
    const relic = getRelicById(relicId);
    if (!relic) {
      errors.push(`Starter relic ${relicId} for ${character.id} does not exist.`);
      continue;
    }
    if (!relic.isStarter) {
      errors.push(`Starter relic ${relicId} must have isStarter=true.`);
    }
    if (relic.starterFor && relic.starterFor !== character.id) {
      errors.push(`Starter relic ${relicId} starterFor mismatch. Expected ${character.id}, got ${relic.starterFor}.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`[starterRelics] Validation failed:\n- ${errors.join("\n- ")}`);
  }
}

