export type PlayableCharacterId = "HOBO" | "JACK" | "JAMAL" | "JOEY" | "TOMMY";

export type CharacterDef = {
    id: PlayableCharacterId;
    displayName: string;
    idleSpriteKey: string;
};

export const PLAYABLE_CHARACTERS: CharacterDef[] = [
    {
        id: "HOBO",
        displayName: "Scratchy",
        idleSpriteKey: "hobo",
    },
    {
        id: "JACK",
        displayName: "Jack",
        idleSpriteKey: "jack",
    },
    {
        id: "JAMAL",
        displayName: "Jamal",
        idleSpriteKey: "jamal",
    },
    {
        id: "JOEY",
        displayName: "Joey",
        idleSpriteKey: "joey",
    },
    {
        id: "TOMMY",
        displayName: "Tommy",
        idleSpriteKey: "tommy",
    },
];

export function getPlayableCharacter(id: PlayableCharacterId): CharacterDef | undefined {
    return PLAYABLE_CHARACTERS.find((character) => character.id === id);
}
