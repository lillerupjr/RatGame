import type { WeaponId } from "./weapons";

export type PlayableCharacterId = "HOBO" | "JACK" | "JAMAL" | "JOEY";

export type CharacterDef = {
    id: PlayableCharacterId;
    displayName: string;
    idleSpriteKey: string;
    startingWeaponId: WeaponId;
};

export const PLAYABLE_CHARACTERS: CharacterDef[] = [
    {
        id: "HOBO",
        displayName: "Hobo",
        idleSpriteKey: "hobo",
        startingWeaponId: "SYRINGE",
    },
    {
        id: "JACK",
        displayName: "Jack",
        idleSpriteKey: "jack",
        startingWeaponId: "PISTOL",
    },
    {
        id: "JAMAL",
        displayName: "Jamal",
        idleSpriteKey: "jamal",
        startingWeaponId: "KNIFE",
    },
    {
        id: "JOEY",
        displayName: "Joey",
        idleSpriteKey: "joey",
        startingWeaponId: "BAZOOKA",
    },
];

export function getPlayableCharacter(id: PlayableCharacterId): CharacterDef | undefined {
    return PLAYABLE_CHARACTERS.find((character) => character.id === id);
}

