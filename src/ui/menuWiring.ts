import { WEAPONS, type WeaponId } from "../game/content/weapons";
import type { TableMapDef } from "../game/map/formats/table/tableMapTypes";
import { loadTableMapDefFromJson } from "../game/map/formats/json/jsonMapLoader";
import excelSanctuary01Json from "../game/map/authored/maps/jsonMaps/excel_sanctuary_01.json";
import wallTestJson from "../game/map/authored/maps/jsonMaps/wall_test.json";
import excelRenderStress01Json from "../game/map/authored/maps/jsonMaps/excel_render_stress_01.json";
import simpleTestJson from "../game/map/authored/maps/jsonMaps/simple_test.json";
import testNorth5Json from "../game/map/authored/maps/jsonMaps/test_north_5.json";
import testSouth5Json from "../game/map/authored/maps/jsonMaps/test_south_5.json";
import testEast5Json from "../game/map/authored/maps/jsonMaps/test_east_5.json";
import testWest5Json from "../game/map/authored/maps/jsonMaps/test_west_5.json";
import floorTestJson from "../game/map/authored/maps/jsonMaps/floor_test.json";
import jsonMinimalMap from "../game/map/authored/maps/jsonMaps/minimal.json";
import type { DomRefs } from "./domRefs";

type GameApi = {
    previewMap: (mapId?: string) => void;
};

type MapChoice = {
    id: string;
    label: string;
    desc: string;
};

// Load background image using Vite's import.meta.glob
const backgroundAssets = import.meta.glob("../assets/backgrounds/*.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

function getBackgroundUrl(): string {
    for (const [path, url] of Object.entries(backgroundAssets)) {
        if (path.endsWith("/background.png")) {
            return url;
        }
    }
    return "";
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

const staticMapDefs: TableMapDef[] = [
    loadTableMapDefFromJson(excelSanctuary01Json, "jsonMaps/excel_sanctuary_01.json"),
    loadTableMapDefFromJson(wallTestJson, "jsonMaps/wall_test.json"),
    loadTableMapDefFromJson(excelRenderStress01Json, "jsonMaps/excel_render_stress_01.json"),
    loadTableMapDefFromJson(simpleTestJson, "jsonMaps/simple_test.json"),
    loadTableMapDefFromJson(testNorth5Json, "jsonMaps/test_north_5.json"),
    loadTableMapDefFromJson(testSouth5Json, "jsonMaps/test_south_5.json"),
    loadTableMapDefFromJson(testEast5Json, "jsonMaps/test_east_5.json"),
    loadTableMapDefFromJson(testWest5Json, "jsonMaps/test_west_5.json"),
    loadTableMapDefFromJson(floorTestJson, "jsonMaps/floor_test.json"),
    loadTableMapDefFromJson(jsonMinimalMap, "jsonMaps/minimal.json"),
];

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

    const weaponIds = Object.keys(WEAPONS) as WeaponId[];

    let selectedWeapon: WeaponId =
        (refs.startBtn.dataset.weapon as WeaponId) ||
        (weaponIds.includes("KNIFE" as WeaponId) ? ("KNIFE" as WeaponId) : weaponIds[0]);

    let selectedMapId = refs.startBtn.dataset.map || mapChoices[0]?.id;

    function getSelectedMapLabel(): string {
        return mapChoices.find((m) => m.id === selectedMapId)?.label ?? "Unknown Map";
    }

    function updateMenuSubline() {
        const title = WEAPONS[selectedWeapon]?.title ?? selectedWeapon;
        const mapLabel = getSelectedMapLabel();
        refs.menuSublineEl.textContent =
            `Slice v0.5 - 3 floors (20 sec -> boss). Map: ${mapLabel}. Starter weapon: ${title}.`;
    }

    function setSelectedWeapon(id: WeaponId) {
        selectedWeapon = id;
        refs.startBtn.dataset.weapon = id;

        const buttons = refs.weaponChoicesEl.querySelectorAll("button[data-weapon]");
        buttons.forEach((b) => {
            const wid = (b as HTMLButtonElement).dataset.weapon as WeaponId;
            b.setAttribute("aria-pressed", wid === selectedWeapon ? "true" : "false");
        });

        updateMenuSubline();
    }

    function weaponDesc(id: WeaponId): string {
        switch (id) {
            case "KNIFE":
                return "Throws multiple knives forward.";
            case "KNIFE_EVOLVED_RING":
                return "Evolution: knives in all directions.";
            case "PISTOL":
                return "Accurate single shots.";
            case "PISTOL_EVOLVED_SPIRAL":
                return "Evolution: spiral shots.";
            case "SYRINGE":
                return "Poison shots. Poisoned kills cause an explosion (non-chaining).";
            case "SYRINGE_EVOLVED_CHAIN":
                return "Evolution: explosions apply poison and can chain.";
            case "SWORD":
                return "Melee slash in a cone.";
            case "KNUCKLES":
                return "Orbiting projectiles around you.";
            case "AURA":
                return "Damaging aura around you.";
            case "MOLOTOV":
                return "Burning ground effect.";
            case "BOUNCER":
                return "Bouncing projectiles";
            case "BOUNCER_EVOLVED_BANKSHOT":
                return "EXTREME BOUNCES!!";
            case "BAZOOKA":
                return "Shoots a slow moving missile";
            case "BAZOOKA_EVOLVED":
                return "kaboom.";
            default:
                return "Starter weapon.";
        }
    }

    function isEvolutionStarter(id: WeaponId): boolean {
        return (
            id === "KNIFE_EVOLVED_RING" ||
            id === "PISTOL_EVOLVED_SPIRAL" ||
            id === "SYRINGE_EVOLVED_CHAIN" ||
            id === "BAZOOKA_EVOLVED" ||
            id === "BOUNCER_EVOLVED_BANKSHOT"
        );
    }

    function buildWeaponPicker() {
        refs.weaponChoicesEl.innerHTML = "";

        for (const id of weaponIds) {
            const def = WEAPONS[id];
            const btn = document.createElement("button");
            btn.className = "wpnBtn";
            btn.type = "button";
            btn.dataset.weapon = id;
            btn.setAttribute("aria-pressed", "false");

            const evoTag = isEvolutionStarter(id)
                ? `<div style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,0.25);font-size:11px;font-weight:900;opacity:0.95;">EVOLUTION</div>`
                : "";

            btn.innerHTML = `
      <div class="wpnTitle">${def.title}${evoTag}</div>
      <div class="wpnDesc">${weaponDesc(id)}</div>
    `;

            btn.addEventListener("click", () => setSelectedWeapon(id));
            refs.weaponChoicesEl.appendChild(btn);
        }

        setSelectedWeapon(selectedWeapon);
    }

    function setSelectedMap(id: string) {
        selectedMapId = id;
        refs.startBtn.dataset.map = id;

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

    buildWeaponPicker();
    buildMapPicker();

    // Welcome screen -> Main menu
    refs.continueBtn.addEventListener("click", () => {
        refs.welcomeScreen.hidden = true;
        refs.mainMenuEl.hidden = false;
    });

    // Main menu -> Weapon selection
    refs.startRunBtn.addEventListener("click", () => {
        refs.mainMenuEl.hidden = true;
        refs.mapMenuEl.hidden = false;
    });

    refs.mapBackBtn.addEventListener("click", () => {
        refs.mapMenuEl.hidden = true;
        refs.mainMenuEl.hidden = false;
    });

    refs.mapContinueBtn.addEventListener("click", () => {
        refs.mapMenuEl.hidden = true;
        refs.menuEl.hidden = false;
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
