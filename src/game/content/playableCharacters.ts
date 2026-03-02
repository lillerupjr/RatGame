import type { WeaponId } from "./weapons";

export type PlayableCharacterId = "HOBO" | "JACK" | "JAMAL" | "JOEY" | "TOMMY";

export type CharacterDef = {
    id: PlayableCharacterId;
    displayName: string;
    idleSpriteKey: string;
    startingWeaponId: WeaponId;
};

export const PLAYABLE_CHARACTERS: CharacterDef[] = [
    {
        id: "HOBO",
        displayName: "Scratchy",
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
        startingWeaponId: "BOUNCER",
    },
    {
        id: "TOMMY",
        displayName: "Tommy",
        idleSpriteKey: "tommy",
        startingWeaponId: "PISTOL_EVOLVED_SPIRAL",
    },
];

export function getPlayableCharacter(id: PlayableCharacterId): CharacterDef | undefined {
    return PLAYABLE_CHARACTERS.find((character) => character.id === id);
}
