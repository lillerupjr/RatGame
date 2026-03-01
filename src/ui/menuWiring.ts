import type { TableMapDef } from "../game/map/formats/table/tableMapTypes";
import { AUTHORED_MAP_DEFS } from "../game/map/authored/authoredMapRegistry";
import type { DomRefs } from "./domRefs";
import { PLAYABLE_CHARACTERS, type PlayableCharacterId } from "../game/content/playableCharacters";
import { getPlayerIdleSpriteUrl } from "../engine/render/sprites/playerSprites";
import { resolveCombatStarterWeaponId } from "../game/combat_mods/content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../game/combat_mods/content/weapons/starterWeapons";
import { isUserModeEnabled } from "../userSettings";

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
    applyBackground(refs.creditsMenuEl, backgroundImageUrl);
    applyBackground(refs.characterSelectEl, backgroundImageUrl);

    // Start with undefined (Delve mode) by default, not PROC_ROOMS
    let selectedMapId: string | undefined = refs.startBtn.dataset.map || undefined;
    let selectedCharacterId: PlayableCharacterId | undefined = undefined;
    let pendingStartMode: "DELVE" | "DETERMINISTIC" | "SANDBOX" = "DELVE";
    const SUPPRESS_CLICK_WINDOW_MS = 450;
    const SUPPRESS_CLICK_RADIUS_PX = 40;
    let suppressClickUntilMs = 0;
    let suppressClickX = 0;
    let suppressClickY = 0;

    const armCrossControlClickSuppression = (ev: PointerEvent) => {
        suppressClickUntilMs = Date.now() + SUPPRESS_CLICK_WINDOW_MS;
        suppressClickX = Number.isFinite(ev.clientX) ? ev.clientX : 0;
        suppressClickY = Number.isFinite(ev.clientY) ? ev.clientY : 0;
    };

    const shouldSuppressSyntheticClick = (ev: Event): boolean => {
        if (Date.now() > suppressClickUntilMs) return false;
        const mev = ev as MouseEvent;
        const hasCoords = Number.isFinite(mev.clientX) && Number.isFinite(mev.clientY);
        if (hasCoords) {
            const dx = mev.clientX - suppressClickX;
            const dy = mev.clientY - suppressClickY;
            if (dx * dx + dy * dy > SUPPRESS_CLICK_RADIUS_PX * SUPPRESS_CLICK_RADIUS_PX) return false;
        }
        suppressClickUntilMs = 0;
        return true;
    };

    const clearActiveUiFocus = () => {
        const active = document.activeElement as HTMLElement | null;
        if (active && typeof active.blur === "function") active.blur();
    };

    const bindActivate = (el: HTMLElement, action: () => void) => {
        let activePointerId: number | null = null;
        let downTarget: EventTarget | null = null;

        el.addEventListener("pointerdown", (ev) => {
            const pev = ev as PointerEvent;
            const btn = typeof pev.button === "number" ? pev.button : 0;
            if (btn !== 0 && btn !== -1) return;
            activePointerId = pev.pointerId;
            downTarget = pev.target;
        });

        el.addEventListener("pointerup", (ev) => {
            const pev = ev as PointerEvent;
            if (activePointerId !== pev.pointerId) return;
            const target = pev.target as Node | null;
            const sameElementInteraction = !!target && el.contains(target);
            const validDownTarget = downTarget ? el.contains(downTarget as Node) : true;
            activePointerId = null;
            downTarget = null;
            if (!sameElementInteraction || !validDownTarget) return;
            ev.preventDefault();
            action();
            armCrossControlClickSuppression(pev);
        });

        el.addEventListener("pointercancel", (ev) => {
            const pev = ev as PointerEvent;
            if (activePointerId !== pev.pointerId) return;
            activePointerId = null;
            downTarget = null;
        });

        el.addEventListener("lostpointercapture", (ev) => {
            const pev = ev as PointerEvent;
            if (activePointerId !== pev.pointerId) return;
            activePointerId = null;
            downTarget = null;
        });

        el.addEventListener("click", (ev) => {
            if (shouldSuppressSyntheticClick(ev)) {
                ev.preventDefault();
                ev.stopPropagation();
                clearActiveUiFocus();
                return;
            }
            action();
        });
    };

    const applyUserModeMenuGating = () => {
        const isUserMode = isUserModeEnabled();

        if (isUserMode && pendingStartMode !== "DELVE") {
            pendingStartMode = "DELVE";
            selectedMapId = undefined;
            delete refs.startBtn.dataset.map;
            updateMenuSubline();
        }

        if (isUserMode && !refs.mapMenuEl.hidden) {
            refs.mapMenuEl.hidden = true;
            refs.mainMenuEl.hidden = false;
        }
    };

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

            bindActivate(btn, () => setSelectedCharacter(character.id));
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

            bindActivate(btn, () => setSelectedMap(choice.id));
            refs.mapChoicesEl.appendChild(btn);
        }

        if (selectedMapId) {
            setSelectedMap(selectedMapId);
        }
    }

    buildCharacterPicker();
    buildMapPicker();
    applyUserModeMenuGating();
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("ratgame:settings-changed", applyUserModeMenuGating as EventListener);
    }

    // Welcome screen -> Main menu
    bindActivate(refs.continueBtn, () => {
        refs.welcomeScreen.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    // Main menu -> Character selection
    bindActivate(refs.startRunBtn, () => {
        selectedMapId = undefined;
        pendingStartMode = "DELVE";
        delete refs.startBtn.dataset.map;
        updateMenuSubline();

        refs.mainMenuEl.hidden = true;
        refs.characterSelectEl.hidden = false;
    });

    // Character selection -> Main menu
    bindActivate(refs.characterBackBtn, () => {
        refs.characterSelectEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    // Character selection -> Delve map start
    bindActivate(refs.characterContinueBtn, () => {
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

    bindActivate(refs.mapBackBtn, () => {
        refs.mapMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    bindActivate(refs.mapContinueBtn, () => {
        pendingStartMode = "SANDBOX";
        refs.mapMenuEl.hidden = true;
        refs.characterSelectEl.hidden = false;
        game.previewMap(selectedMapId);
    });

    // Main menu -> Innkeeper
    bindActivate(refs.innkeeperBtn, () => {
        refs.mainMenuEl.hidden = true;
        refs.innkeeperMenuEl.hidden = false;
    });

    // Innkeeper -> Main menu
    bindActivate(refs.innkeeperBackBtn, () => {
        refs.innkeeperMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    // Main menu -> Settings
    bindActivate(refs.settingsBtn, () => {
        refs.mainMenuEl.hidden = true;
        refs.settingsMenuEl.hidden = false;
    });

    // Main menu -> Credits
    if (refs.creditsBtn) {
        bindActivate(refs.creditsBtn, () => {
            refs.mainMenuEl.hidden = true;
            refs.creditsMenuEl.hidden = false;
        });
    }

    // Settings -> Main menu
    bindActivate(refs.settingsBackBtn, () => {
        refs.settingsMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    // Credits -> Main menu
    bindActivate(refs.creditsBackBtn, () => {
        refs.creditsMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

}
