import type { TableMapDef } from "../game/map/formats/table/tableMapTypes";
import { AUTHORED_MAP_DEFS } from "../game/map/authored/authoredMapRegistry";
import type { DomRefs } from "./domRefs";
import { PLAYABLE_CHARACTERS, type PlayableCharacterId } from "../game/content/playableCharacters";
import { getPlayerIdleSpriteUrl } from "../engine/render/sprites/playerSprites";
import { resolveCombatStarterWeaponId } from "../game/combat_mods/content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../game/combat_mods/content/weapons/starterWeapons";

type GameApi = {
    previewMap: (mapId?: string) => void;
    startRun: (characterId: PlayableCharacterId) => void;
    startDeterministicRun: (characterId: PlayableCharacterId) => void;
    startSandboxRun: (characterId: PlayableCharacterId, mapId?: string) => void;
};

type MapChoice = {
    id: string;
    label: string;
    desc: string;
};

const MENU_BACKGROUND_URL = "";

function getBackgroundUrl(): string {
    return MENU_BACKGROUND_URL;
}

function applyBackground(el: HTMLDivElement, url: string): void {
    if (!url) return;
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.style.backgroundRepeat = "no-repeat";
}

function toTitleCase(value: string): string {
    return value
        .toLowerCase()
        .split("_")
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
        .join(" ");
}

const staticMapDefs: TableMapDef[] = AUTHORED_MAP_DEFS;

const staticMapChoices: MapChoice[] = staticMapDefs.map((def) => ({
    id: def.id,
    label: toTitleCase(def.id),
    desc: `Static map (${def.w}x${def.h}).`,
}));

const proceduralChoices: MapChoice[] = [
    { id: "PROC_ROOMS", label: "Procedural Rooms", desc: "Generated room chain with ramps." },
    { id: "PROC_MAZE", label: "Procedural Maze", desc: "Generated maze layout." },
];

const mapChoices: MapChoice[] = [...proceduralChoices, ...staticMapChoices];

export function wireMenus(refs: DomRefs, game: GameApi): void {
    const backgroundImageUrl = getBackgroundUrl();
    applyBackground(refs.welcomeScreen, backgroundImageUrl);
    applyBackground(refs.mainMenuEl, backgroundImageUrl);
    applyBackground(refs.mapMenuEl, backgroundImageUrl);
    applyBackground(refs.menuEl, backgroundImageUrl);
    applyBackground(refs.innkeeperMenuEl, backgroundImageUrl);
    applyBackground(refs.settingsMenuEl, backgroundImageUrl);
    applyBackground(refs.characterSelectEl, backgroundImageUrl);

    // Start with undefined (Delve mode) by default, not PROC_ROOMS
    let selectedMapId: string | undefined = refs.startBtn.dataset.map || undefined;
    let selectedCharacterId: PlayableCharacterId | undefined = undefined;
    let pendingStartMode: "DELVE" | "DETERMINISTIC" | "SANDBOX" = "DELVE";

    function getSelectedMapLabel(): string {
        if (!selectedMapId) return "Delve (random route)";
        return mapChoices.find((m) => m.id === selectedMapId)?.label ?? "Unknown Map";
    }

    function updateMenuSubline() {
        const mapLabel = getSelectedMapLabel();
        refs.menuSublineEl.textContent =
            `Slice v0.5 - 3 floors (20 sec -> boss). Map: ${mapLabel}.`;
    }

    function setSelectedCharacter(id: PlayableCharacterId) {
        selectedCharacterId = id;
        refs.characterContinueBtn.disabled = false;

        const buttons = refs.characterChoicesEl.querySelectorAll("button[data-character]");
        buttons.forEach((b) => {
            const cid = (b as HTMLButtonElement).dataset.character as PlayableCharacterId;
            b.setAttribute("aria-pressed", cid === selectedCharacterId ? "true" : "false");
        });
    }

    function buildCharacterPicker() {
        refs.characterChoicesEl.innerHTML = "";

        for (const character of PLAYABLE_CHARACTERS) {
            const starterWeaponId = resolveCombatStarterWeaponId(character.id);
            const weaponTitle = getCombatStarterWeaponById(starterWeaponId).displayName;
            const btn = document.createElement("button");
            btn.className = "characterCard";
            btn.type = "button";
            btn.dataset.character = character.id;
            btn.setAttribute("aria-pressed", "false");

            const spriteUrl = getPlayerIdleSpriteUrl(character.idleSpriteKey);

            btn.innerHTML = `
      <div class="characterSpriteWrap">
        ${spriteUrl ? `<img class="characterSprite" src="${spriteUrl}" alt="${character.displayName}" />` : ""}
      </div>
      <div class="characterName">${character.displayName}</div>
      <div class="characterWeapon">Starting Weapon: ${weaponTitle}</div>
    `;

            btn.addEventListener("click", () => setSelectedCharacter(character.id));
            refs.characterChoicesEl.appendChild(btn);
        }

        refs.characterContinueBtn.disabled = true;
    }

    function setSelectedMap(id: string) {
        selectedMapId = id;
        if (id) {
            refs.startBtn.dataset.map = id;
        } else {
            delete refs.startBtn.dataset.map;
        }

        const buttons = refs.mapChoicesEl.querySelectorAll("button[data-map]");
        buttons.forEach((b) => {
            const mid = (b as HTMLButtonElement).dataset.map;
            b.setAttribute("aria-pressed", mid === selectedMapId ? "true" : "false");
        });

        refs.mapMenuSublineEl.textContent = `Selected: ${getSelectedMapLabel()}`;
        updateMenuSubline();
    }

    function buildMapPicker() {
        refs.mapChoicesEl.innerHTML = "";

        for (const choice of mapChoices) {
            const btn = document.createElement("button");
            btn.className = "mapChoiceBtn";
            btn.type = "button";
            btn.dataset.map = choice.id;
            btn.setAttribute("aria-pressed", "false");

            btn.innerHTML = `
      <div class="mapChoiceTitle">${choice.label}</div>
      <div class="mapChoiceDesc">${choice.desc}</div>
    `;

            btn.addEventListener("click", () => setSelectedMap(choice.id));
            refs.mapChoicesEl.appendChild(btn);
        }

        if (selectedMapId) {
            setSelectedMap(selectedMapId);
        }
    }

    buildCharacterPicker();
    buildMapPicker();

    // Welcome screen -> Main menu
    refs.continueBtn.addEventListener("click", () => {
        refs.welcomeScreen.hidden = true;
        refs.mainMenuEl.hidden = false;
    });

    // Main menu -> Character selection
    refs.startRunBtn.addEventListener("click", () => {
        selectedMapId = undefined;
        pendingStartMode = "DELVE";
        delete refs.startBtn.dataset.map;
        updateMenuSubline();

        refs.mainMenuEl.hidden = true;
        refs.characterSelectEl.hidden = false;
    });

    refs.deterministicRunBtn.addEventListener("click", () => {
        selectedMapId = undefined;
        pendingStartMode = "DETERMINISTIC";
        delete refs.startBtn.dataset.map;
        updateMenuSubline();

        refs.mainMenuEl.hidden = true;
        refs.characterSelectEl.hidden = false;
    });

    // Character selection -> Main menu
    refs.characterBackBtn.addEventListener("click", () => {
        refs.characterSelectEl.hidden = true;
        refs.mainMenuEl.hidden = false;
    });

    // Character selection -> Delve map start
    refs.characterContinueBtn.addEventListener("click", () => {
        if (!selectedCharacterId) return;

        refs.characterSelectEl.hidden = true;
        refs.mainMenuEl.hidden = true;
        refs.menuEl.hidden = true;
        if (pendingStartMode === "SANDBOX") {
            game.startSandboxRun(selectedCharacterId, selectedMapId);
        } else if (pendingStartMode === "DETERMINISTIC") {
            game.startDeterministicRun(selectedCharacterId);
        } else {
            game.startRun(selectedCharacterId);
        }
    });

    // Main menu -> Map selection
    refs.mapsBtn.addEventListener("click", () => {
        refs.mainMenuEl.hidden = true;
        refs.mapMenuEl.hidden = false;
    });

    refs.mapBackBtn.addEventListener("click", () => {
        refs.mapMenuEl.hidden = true;
        refs.mainMenuEl.hidden = false;
    });

    refs.mapContinueBtn.addEventListener("click", () => {
        pendingStartMode = "SANDBOX";
        refs.mapMenuEl.hidden = true;
        refs.characterSelectEl.hidden = false;
        game.previewMap(selectedMapId);
    });

    // Main menu -> Innkeeper
    refs.innkeeperBtn.addEventListener("click", () => {
        refs.mainMenuEl.hidden = true;
        refs.innkeeperMenuEl.hidden = false;
    });

    // Innkeeper -> Main menu
    refs.innkeeperBackBtn.addEventListener("click", () => {
        refs.innkeeperMenuEl.hidden = true;
        refs.mainMenuEl.hidden = false;
    });

    // Main menu -> Settings
    refs.settingsBtn.addEventListener("click", () => {
        refs.mainMenuEl.hidden = true;
        refs.settingsMenuEl.hidden = false;
    });

    // Settings -> Main menu
    refs.settingsBackBtn.addEventListener("click", () => {
        refs.settingsMenuEl.hidden = true;
        refs.mainMenuEl.hidden = false;
    });

    // Like & Subscribe button
    refs.likeSubBtn.addEventListener("click", () => {
        window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
    });
}
