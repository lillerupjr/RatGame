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
import {
    deletePaletteSnapshotRecord,
    listPaletteSnapshotRecords,
    renamePaletteSnapshotRecord,
} from "../game/paletteLab/snapshotStorage";

type GameApi = {
    previewMap: (mapId?: string) => void;
    reloadCurrentMapForDebug?: () => void;
    startRun: (characterId: PlayableCharacterId) => void;
    startDeterministicRun: (characterId: PlayableCharacterId) => void;
    startSandboxRun: (characterId: PlayableCharacterId, mapId?: string) => void;
    openPaletteSnapshot?: (snapshotId: string) => Promise<void> | void;
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
    desc: `Authored map (${def.w}x${def.h}).`,
}));

const mapChoices: MapChoice[] = staticMapChoices;

export function wireMenus(refs: DomRefs, game: GameApi): void {
  const backgroundImageUrl = getBackgroundUrl();
  applyBackground(refs.welcomeScreen, backgroundImageUrl);
  applyBackground(refs.mainMenuEl, backgroundImageUrl);
  applyBackground(refs.mapMenuEl, backgroundImageUrl);
  applyBackground(refs.paletteLabMenuEl, backgroundImageUrl);
  applyBackground(refs.menuEl, backgroundImageUrl);
    applyBackground(refs.innkeeperMenuEl, backgroundImageUrl);
    applyBackground(refs.settingsMenuEl, backgroundImageUrl);
    applyBackground(refs.creditsMenuEl, backgroundImageUrl);
    applyBackground(refs.characterSelectEl, backgroundImageUrl);

    // Start with undefined (Delve mode) by default.
    let selectedMapId: string | undefined = refs.startBtn.dataset.map || undefined;
    let selectedCharacterId: PlayableCharacterId | undefined = undefined;
    let pendingStartMode: "DELVE" | "DETERMINISTIC" | "SANDBOX" = "DELVE";
    let debugMapSelectorBtn: HTMLButtonElement | null = null;
    let debugPathSelectBtn: HTMLButtonElement | null = null;
    let starterModalOverlay: HTMLDivElement | null = null;
    let starterModalCharacterName: HTMLDivElement | null = null;
    let starterModalSpriteWrap: HTMLDivElement | null = null;
    let starterModalRelicName: HTMLDivElement | null = null;
  let starterModalRelicDesc: HTMLDivElement | null = null;
  let starterModalCharacterId: PlayableCharacterId | null = null;
  const paletteSnapshotThumbUrlById = new Map<string, string>();
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

  const formatSnapshotTime = (createdAt: number): string => {
    if (!Number.isFinite(createdAt)) return "-";
    return new Date(createdAt).toLocaleString();
  };

  const formatMapBiomeLabel = (mapId?: string, biomeId?: string): string => {
    if (mapId && biomeId) return `${toTitleCase(mapId)} · ${toTitleCase(biomeId)}`;
    if (mapId) return toTitleCase(mapId);
    if (biomeId) return toTitleCase(biomeId);
    return "Unknown map";
  };

  const revokePaletteSnapshotThumbUrls = () => {
    if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
    for (const url of paletteSnapshotThumbUrlById.values()) {
      URL.revokeObjectURL(url);
    }
    paletteSnapshotThumbUrlById.clear();
  };

    const clearPaletteSnapshotCards = () => {
        revokePaletteSnapshotThumbUrls();
        while (refs.paletteLabSnapshotGridEl.firstChild) {
            refs.paletteLabSnapshotGridEl.removeChild(refs.paletteLabSnapshotGridEl.firstChild);
        }
    };

    const readPrompt = (message: string, defaultValue: string): string | null => {
        if (typeof window === "undefined" || typeof window.prompt !== "function") return null;
        return window.prompt(message, defaultValue);
    };

    const readConfirm = (message: string): boolean => {
        if (typeof window === "undefined" || typeof window.confirm !== "function") return false;
        return window.confirm(message);
    };

    const runOpenSnapshotAction = async (snapshotId: string) => {
        if (typeof game.openPaletteSnapshot !== "function") {
            refs.paletteLabSublineEl.textContent = "Palette Lab viewer is not available in this build.";
            return;
        }
        refs.paletteLabSublineEl.textContent = "Opening snapshot...";
        try {
            await game.openPaletteSnapshot(snapshotId);
        } catch (err) {
            refs.paletteLabSublineEl.textContent =
                err instanceof Error ? err.message : "Failed to open snapshot.";
        }
    };

    const runRenameSnapshotAction = async (snapshotId: string, currentName: string) => {
        const nextNameRaw = readPrompt("Rename palette snapshot", currentName);
        if (nextNameRaw == null) return;
        const nextName = nextNameRaw.trim();
        if (!nextName) {
            refs.paletteLabSublineEl.textContent = "Snapshot name cannot be empty.";
            return;
        }
        try {
            await renamePaletteSnapshotRecord(snapshotId, nextName);
            await renderPaletteSnapshotCards();
        } catch (err) {
            refs.paletteLabSublineEl.textContent =
                err instanceof Error ? err.message : "Failed to rename snapshot.";
        }
    };

    const runDeleteSnapshotAction = async (snapshotId: string, snapshotName: string) => {
        const confirmed = readConfirm(
            `Delete snapshot \"${snapshotName}\" permanently? This cannot be undone.`,
        );
        if (!confirmed) return;
        try {
            await deletePaletteSnapshotRecord(snapshotId);
            await renderPaletteSnapshotCards();
        } catch (err) {
            refs.paletteLabSublineEl.textContent =
                err instanceof Error ? err.message : "Failed to delete snapshot.";
        }
    };

    const renderPaletteSnapshotCards = async () => {
        refs.paletteLabSublineEl.textContent = "Loading snapshots...";
        clearPaletteSnapshotCards();

        try {
            const records = await listPaletteSnapshotRecords();
            if (records.length === 0) {
                const empty = document.createElement("div");
                empty.className = "paletteLabEmpty";
                empty.textContent = "No palette snapshots saved yet.";
                refs.paletteLabSnapshotGridEl.appendChild(empty);
                refs.paletteLabSublineEl.textContent = "Saved palette snapshots: 0";
                return;
            }

            refs.paletteLabSublineEl.textContent = `Saved palette snapshots: ${records.length}`;
            for (const record of records) {
                const card = document.createElement("article");
                card.className = "paletteLabSnapshotCard";
                card.setAttribute("data-palette-snapshot-id", record.id);

                const thumbWrap = document.createElement("div");
                thumbWrap.className = "paletteLabSnapshotThumbWrap";
                const thumb = document.createElement("img");
                thumb.className = "paletteLabSnapshotThumb";
                thumb.alt = record.metadata.name;
                if (
                    record.thumbnail
                    && typeof URL !== "undefined"
                    && typeof URL.createObjectURL === "function"
                ) {
                    const url = URL.createObjectURL(record.thumbnail);
                    paletteSnapshotThumbUrlById.set(record.id, url);
                    thumb.src = url;
                }
                thumbWrap.appendChild(thumb);

                const body = document.createElement("div");
                body.className = "paletteLabSnapshotBody";
                const name = document.createElement("div");
                name.className = "paletteLabSnapshotName";
                name.textContent = record.metadata.name;
                const time = document.createElement("div");
                time.className = "paletteLabSnapshotMeta";
                time.textContent = formatSnapshotTime(record.metadata.createdAt);
                const map = document.createElement("div");
                map.className = "paletteLabSnapshotMeta";
                map.textContent = formatMapBiomeLabel(record.sceneContext.mapId, record.sceneContext.biomeId);

                const actions = document.createElement("div");
                actions.className = "paletteLabSnapshotActions";
                const addActionButton = (
                    label: string,
                    actionId: string,
                    onActivate: () => Promise<void>,
                ) => {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "SecondaryButton paletteLabSnapshotActionBtn";
                    btn.textContent = label;
                    btn.setAttribute("data-palette-snapshot-action", actionId);
                    btn.setAttribute("data-palette-snapshot-id", record.id);
                    bindActivate(btn, () => {
                        void onActivate();
                    });
                    actions.appendChild(btn);
                };

                addActionButton("Open Snapshot", "open", async () => runOpenSnapshotAction(record.id));
                addActionButton("Rename", "rename", async () =>
                    runRenameSnapshotAction(record.id, record.metadata.name),
                );
                addActionButton("Delete", "delete", async () =>
                    runDeleteSnapshotAction(record.id, record.metadata.name),
                );

                body.appendChild(name);
                body.appendChild(time);
                body.appendChild(map);
                body.appendChild(actions);
                card.appendChild(thumbWrap);
                card.appendChild(body);
                refs.paletteLabSnapshotGridEl.appendChild(card);
            }
        } catch (err) {
            const error = document.createElement("div");
            error.className = "paletteLabError";
            error.textContent =
                err instanceof Error ? err.message : "Failed to load palette snapshots.";
            refs.paletteLabSnapshotGridEl.appendChild(error);
            refs.paletteLabSublineEl.textContent = "Unable to load snapshots.";
        }
    };

    const openPaletteLab = () => {
        closeStarterModal();
        refs.mainMenuEl.hidden = true;
        refs.paletteLabMenuEl.hidden = false;
        void renderPaletteSnapshotCards();
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
        if (debugMapSelectorBtn) debugMapSelectorBtn.hidden = isUserMode;
        if (debugPathSelectBtn) debugPathSelectBtn.hidden = isUserMode;

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

  const openMapSelectorMenu = () => {
        if (isUserModeEnabled()) return;
        pendingStartMode = "SANDBOX";
        closeStarterModal();
    refs.mainMenuEl.hidden = true;
    refs.mapMenuEl.hidden = false;
    refs.paletteLabMenuEl.hidden = true;
        if (!selectedMapId && mapChoices.length > 0) {
            setSelectedMap(mapChoices[0].id);
        }
        game.previewMap(selectedMapId);
    };

  const openDeterministicPathSelect = () => {
        if (isUserModeEnabled()) return;
        pendingStartMode = "DETERMINISTIC";
        selectedMapId = undefined;
        delete refs.startBtn.dataset.map;
        updateMenuSubline();
        closeStarterModal();
    refs.mainMenuEl.hidden = true;
    refs.paletteLabMenuEl.hidden = true;
    refs.characterSelectEl.hidden = false;
    };

    const ensureDebugMapSelectorButton = () => {
        if (!import.meta.env.DEV) return;
        if (debugMapSelectorBtn) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "terminalAction SecondaryButton";
        btn.textContent = "MAP SELECTOR";
        btn.hidden = isUserModeEnabled();
        btn.setAttribute("data-map-selector-debug", "1");
        bindActivate(btn, () => openMapSelectorMenu());
        const host = ((refs.startRunBtn as any).parentNode as HTMLElement | null) ?? refs.mainMenuEl;
        const anchor = refs.innkeeperBtn ?? null;
        if (anchor && typeof (host as any).insertBefore === "function") {
            host.insertBefore(btn, anchor);
        } else {
            host.appendChild(btn);
        }
        debugMapSelectorBtn = btn;
    };

    const ensureDebugPathSelectButton = () => {
        if (!import.meta.env.DEV) return;
        if (debugPathSelectBtn) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "terminalAction SecondaryButton";
        btn.textContent = "PATH SELECT";
        btn.hidden = isUserModeEnabled();
        btn.setAttribute("data-path-select-debug", "1");
        bindActivate(btn, () => openDeterministicPathSelect());
        const host = ((refs.startRunBtn as any).parentNode as HTMLElement | null) ?? refs.mainMenuEl;
        const anchor = refs.innkeeperBtn ?? null;
        if (anchor && typeof (host as any).insertBefore === "function") {
            host.insertBefore(btn, anchor);
        } else {
            host.appendChild(btn);
        }
        debugPathSelectBtn = btn;
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

            bindActivate(btn, () => {
                setSelectedMap(choice.id);
                game.previewMap(choice.id);
            });
            refs.mapChoicesEl.appendChild(btn);
        }

        if (selectedMapId) {
            setSelectedMap(selectedMapId);
            game.previewMap(selectedMapId);
        }
    }

    buildCharacterPicker();
    ensureStarterModal();
    buildMapPicker();
    ensureDebugPathSelectButton();
    ensureDebugMapSelectorButton();
    const mapMenuActions =
        typeof (refs.mapMenuEl as any).querySelector === "function"
            ? (refs.mapMenuEl as any).querySelector(".mapMenuActions")
            : null;
    if (mapMenuActions && typeof (mapMenuActions as any).insertBefore === "function") {
        const reloadBtn = document.createElement("button");
        reloadBtn.type = "button";
        reloadBtn.className = "SecondaryButton";
        reloadBtn.textContent = "Reload Current Map";
        bindActivate(reloadBtn, () => game.reloadCurrentMapForDebug?.());
        mapMenuActions.insertBefore(reloadBtn, refs.mapContinueBtn);
    }
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
        refs.paletteLabMenuEl.hidden = true;
        refs.characterSelectEl.hidden = false;
    });

    bindActivate(refs.paletteLabBtn, () => {
        openPaletteLab();
    });

    // Character selection -> Main menu
    bindActivate(refs.characterBackBtn, () => {
        closeStarterModal();
        refs.characterSelectEl.hidden = true;
        refs.paletteLabMenuEl.hidden = true;
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
        refs.paletteLabMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    bindActivate(refs.mapContinueBtn, () => {
        pendingStartMode = "SANDBOX";
        closeStarterModal();
        refs.mapMenuEl.hidden = true;
        refs.paletteLabMenuEl.hidden = true;
        refs.characterSelectEl.hidden = false;
        game.previewMap(selectedMapId);
    });

    bindActivate(refs.paletteLabBackBtn, () => {
        refs.paletteLabMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    // Main menu -> Innkeeper
    bindActivate(refs.innkeeperBtn, () => {
        refs.mainMenuEl.hidden = true;
        refs.paletteLabMenuEl.hidden = true;
        refs.innkeeperMenuEl.hidden = false;
    });

    // Innkeeper -> Main menu
    bindActivate(refs.innkeeperBackBtn, () => {
        refs.innkeeperMenuEl.hidden = true;
        refs.paletteLabMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    // Main menu -> Settings
    bindActivate(refs.settingsBtn, () => {
        refs.mainMenuEl.hidden = true;
        refs.paletteLabMenuEl.hidden = true;
        refs.settingsMenuEl.hidden = false;
    });

    // Main menu -> Credits
    if (refs.creditsBtn) {
        bindActivate(refs.creditsBtn, () => {
            refs.mainMenuEl.hidden = true;
            refs.paletteLabMenuEl.hidden = true;
            refs.creditsMenuEl.hidden = false;
        });
    }

    // Settings -> Main menu
    bindActivate(refs.settingsBackBtn, () => {
        closeStarterModal();
        refs.settingsMenuEl.hidden = true;
        refs.paletteLabMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    // Credits -> Main menu
    bindActivate(refs.creditsBackBtn, () => {
        closeStarterModal();
        refs.creditsMenuEl.hidden = true;
        refs.paletteLabMenuEl.hidden = true;
        applyUserModeMenuGating();
        refs.mainMenuEl.hidden = false;
    });

    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
        document.addEventListener("keydown", (ev) => {
            if (!import.meta.env.DEV) return;
            const kev = ev as KeyboardEvent;
            if (kev.key.toLowerCase() !== "m" || !kev.shiftKey) return;
            if (refs.mainMenuEl.hidden || isUserModeEnabled()) return;
            openMapSelectorMenu();
        });
    }

}
