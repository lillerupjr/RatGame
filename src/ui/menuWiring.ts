import type { TableMapDef } from "../game/map/formats/table/tableMapTypes";
import { AUTHORED_MAP_DEFS } from "../game/map/authored/authoredMapRegistry";
import type { DomRefs } from "./domRefs";
import { PLAYABLE_CHARACTERS, type PlayableCharacterId } from "../game/content/playableCharacters";
import { getPlayerIdleSpriteUrl } from "../engine/render/sprites/playerSprites";
import { resolveCombatStarterWeaponId } from "../game/combat_mods/content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../game/combat_mods/content/weapons/starterWeapons";
import { getRelicById, getRelicShortDesc } from "../game/content/relics";
import { STARTER_RELIC_BY_CHARACTER } from "../game/content/starterRelics";
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
    let starterModalOverlay: HTMLDivElement | null = null;
    let starterModalCharacterName: HTMLDivElement | null = null;
    let starterModalSpriteWrap: HTMLDivElement | null = null;
    let starterModalRelicName: HTMLDivElement | null = null;
    let starterModalRelicDesc: HTMLDivElement | null = null;
    let starterModalCharacterId: PlayableCharacterId | null = null;
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

    const launchRunForCharacter = (characterId: PlayableCharacterId) => {
        closeStarterModal();
        refs.characterSelectEl.hidden = true;
        refs.mainMenuEl.hidden = true;
        refs.menuEl.hidden = true;
        if (pendingStartMode === "SANDBOX") {
            game.startSandboxRun(characterId, selectedMapId);
        } else if (pendingStartMode === "DETERMINISTIC") {
            game.startDeterministicRun(characterId);
        } else {
            game.startRun(characterId);
        }
    };

    const closeStarterModal = () => {
        if (!starterModalOverlay) return;
        starterModalOverlay.hidden = true;
        starterModalCharacterId = null;
    };

    const ensureStarterModal = () => {
        if (starterModalOverlay) return;

        const overlay = document.createElement("div");
        overlay.className = "characterStarterModalOverlay";
        overlay.hidden = true;
        overlay.setAttribute("data-character-starter-modal", "1");

        const panel = document.createElement("div");
        panel.className = "characterStarterModal";

        const header = document.createElement("div");
        header.className = "characterStarterModalHeader";

        const headerTitle = document.createElement("div");
        headerTitle.className = "characterStarterModalCharacterName";
        header.setAttribute("data-character-starter-modal-header", "1");

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "characterStarterModalClose";
        closeBtn.textContent = "Close";
        closeBtn.setAttribute("data-character-starter-close", "1");
        closeBtn.addEventListener("click", () => {
            closeStarterModal();
        });

        header.appendChild(headerTitle);
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        body.className = "characterStarterModalBody";

        const spritePane = document.createElement("div");
        spritePane.className = "characterStarterModalSpritePane";
        const spriteWrap = document.createElement("div");
        spriteWrap.className = "characterStarterModalSpriteWrap";
        spritePane.appendChild(spriteWrap);

        const infoPane = document.createElement("div");
        infoPane.className = "characterStarterModalInfoPane";
        const relicLabel = document.createElement("div");
        relicLabel.className = "characterStarterModalRelicLabel";
        relicLabel.textContent = "Starter Relic";
        const relicName = document.createElement("div");
        relicName.className = "characterStarterModalRelicName";
        relicName.setAttribute("data-character-starter-relic-name", "1");
        const relicDesc = document.createElement("div");
        relicDesc.className = "characterStarterModalRelicDesc";
        relicDesc.setAttribute("data-character-starter-relic-desc", "1");
        const selectBtn = document.createElement("button");
        selectBtn.type = "button";
        selectBtn.className = "characterStarterModalSelectBtn";
        selectBtn.textContent = "Select Rat";
        selectBtn.setAttribute("data-character-starter-select", "1");
        bindActivate(selectBtn, () => {
            if (starterModalCharacterId) {
                setSelectedCharacter(starterModalCharacterId);
                launchRunForCharacter(starterModalCharacterId);
            }
        });
        infoPane.appendChild(relicLabel);
        infoPane.appendChild(relicName);
        infoPane.appendChild(relicDesc);
        infoPane.appendChild(selectBtn);

        body.appendChild(spritePane);
        body.appendChild(infoPane);

        panel.appendChild(header);
        panel.appendChild(body);
        overlay.appendChild(panel);
        refs.characterSelectEl.appendChild(overlay);

        overlay.addEventListener("click", (ev) => {
            if (ev.target !== overlay) return;
            closeStarterModal();
        });
        overlay.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
        });

        if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
            document.addEventListener("keydown", (ev) => {
                const kev = ev as KeyboardEvent;
                if (kev.key !== "Escape") return;
                if (!starterModalOverlay || starterModalOverlay.hidden) return;
                closeStarterModal();
            });
        }

        starterModalOverlay = overlay;
        starterModalCharacterName = headerTitle;
        starterModalSpriteWrap = spriteWrap;
        starterModalRelicName = relicName;
        starterModalRelicDesc = relicDesc;
    };

    const openStarterModal = (characterId: PlayableCharacterId) => {
        ensureStarterModal();
        const character = PLAYABLE_CHARACTERS.find((it) => it.id === characterId);
        if (!character || !starterModalOverlay || !starterModalCharacterName || !starterModalSpriteWrap || !starterModalRelicName || !starterModalRelicDesc) {
            return;
        }
        starterModalCharacterName.textContent = character.displayName;
        while (starterModalSpriteWrap.firstChild) starterModalSpriteWrap.removeChild(starterModalSpriteWrap.firstChild as Node);
        const spriteUrl = getPlayerIdleSpriteUrl(character.idleSpriteKey);
        if (spriteUrl) {
            const sprite = document.createElement("img");
            sprite.className = "characterStarterModalSprite";
            sprite.src = spriteUrl;
            sprite.alt = character.displayName;
            starterModalSpriteWrap.appendChild(sprite);
        }

        const starterRelicId = STARTER_RELIC_BY_CHARACTER[character.id];
        const starterRelic = getRelicById(starterRelicId);
        starterModalRelicName.textContent = starterRelic?.displayName ?? starterRelicId ?? "Starter Relic";
        starterModalRelicDesc.textContent = getRelicShortDesc(starterRelic) || starterRelic?.desc?.[0] || "No description.";
        starterModalCharacterId = character.id;
        starterModalOverlay.hidden = false;
    };

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
            const spriteWrap = document.createElement("div");
            spriteWrap.className = "characterSpriteWrap";
            if (spriteUrl) {
                const sprite = document.createElement("img");
                sprite.className = "characterSprite";
                sprite.src = spriteUrl;
                sprite.alt = character.displayName;
                spriteWrap.appendChild(sprite);
            }

            const name = document.createElement("div");
            name.className = "characterName";
            name.textContent = character.displayName;

            const weapon = document.createElement("div");
            weapon.className = "characterWeapon";
            weapon.textContent = `Starting Weapon: ${weaponTitle}`;

            btn.appendChild(spriteWrap);
            btn.appendChild(name);
            btn.appendChild(weapon);

            bindActivate(btn, () => {
                setSelectedCharacter(character.id);
                openStarterModal(character.id);
            });
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
    ensureStarterModal();
    buildMapPicker();
    refs.characterContinueBtn.hidden = true;
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

        closeStarterModal();
        refs.mainMenuEl.hidden = true;
        refs.characterSelectEl.hidden = false;
    });

    // Character selection -> Main menu
    bindActivate(refs.characterBackBtn, () => {
        closeStarterModal();
        refs.characterSelectEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    // Character selection -> Delve map start (legacy hidden button path)
    bindActivate(refs.characterContinueBtn, () => {
        if (!selectedCharacterId) return;
        launchRunForCharacter(selectedCharacterId);
    });

    bindActivate(refs.mapBackBtn, () => {
        closeStarterModal();
        refs.mapMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    bindActivate(refs.mapContinueBtn, () => {
        pendingStartMode = "SANDBOX";
        closeStarterModal();
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
        closeStarterModal();
        refs.settingsMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    // Credits -> Main menu
    bindActivate(refs.creditsBackBtn, () => {
        closeStarterModal();
        refs.creditsMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

}
