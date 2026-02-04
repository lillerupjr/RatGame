// src/main.ts
import { createGame } from "./game/game";
import { WEAPONS, type WeaponId } from "./game/content/weapons";

// Load background image using Vite's import.meta.glob
const backgroundAssets = import.meta.glob("./assets/backgrounds/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

// Find the background.png URL
let backgroundImageUrl = "";
for (const [path, url] of Object.entries(backgroundAssets)) {
  if (path.endsWith("/background.png")) {
    backgroundImageUrl = url;
    break;
  }
}

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D context not available");

// Welcome screen
const welcomeScreen = document.getElementById("welcomeScreen") as HTMLDivElement;
const continueBtn = document.getElementById("continueBtn") as HTMLButtonElement;

// Apply background image to welcome screen and main menu
if (backgroundImageUrl) {
  welcomeScreen.style.backgroundImage = `url(${backgroundImageUrl})`;
  welcomeScreen.style.backgroundSize = "cover";
  welcomeScreen.style.backgroundPosition = "center";
  welcomeScreen.style.backgroundRepeat = "no-repeat";
}

// Main menu
const mainMenuEl = document.getElementById("mainMenu") as HTMLDivElement;
const startRunBtn = document.getElementById("startRunBtn") as HTMLButtonElement;
const innkeeperBtn = document.getElementById("innkeeperBtn") as HTMLButtonElement;
const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;
const likeSubBtn = document.getElementById("likeSubBtn") as HTMLButtonElement;

// Apply background image to main menu
if (backgroundImageUrl) {
  mainMenuEl.style.backgroundImage = `url(${backgroundImageUrl})`;
  mainMenuEl.style.backgroundSize = "cover";
  mainMenuEl.style.backgroundPosition = "center";
  mainMenuEl.style.backgroundRepeat = "no-repeat";
}

// Innkeeper menu
const innkeeperMenuEl = document.getElementById("innkeeperMenu") as HTMLDivElement;
const innkeeperBackBtn = document.getElementById("innkeeperBackBtn") as HTMLButtonElement;

// Settings menu
const settingsMenuEl = document.getElementById("settingsMenu") as HTMLDivElement;
const settingsBackBtn = document.getElementById("settingsBackBtn") as HTMLButtonElement;

// Weapon selection menu
const menuEl = document.getElementById("menu") as HTMLDivElement;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const hudEl = document.getElementById("hud") as HTMLDivElement;

// Run end overlay (WIN / LOSE)
const endRoot = document.getElementById("end") as HTMLDivElement;
const endTitle = document.getElementById("endTitle") as HTMLDivElement;
const endSubline = document.getElementById("endSubline") as HTMLDivElement;
const endBtn = document.getElementById("endBtn") as HTMLButtonElement;

const levelupRoot = document.getElementById("levelup") as HTMLDivElement;
const levelupChoices = document.getElementById("luChoices") as HTMLDivElement;
const levelupSub = document.getElementById("luSub") as HTMLDivElement;

const mapRoot = document.getElementById("map") as HTMLDivElement;
const mapSub = document.getElementById("mapSub") as HTMLDivElement;
const mapSvg = document.querySelector<SVGSVGElement>("#mapSvg")!;
const mapHit = document.getElementById("mapHit") as HTMLDivElement;


const weaponChoicesEl = document.getElementById("weaponChoices") as HTMLDivElement;
const menuSublineEl = document.getElementById("menuSubline") as HTMLDivElement;

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  // @ts-ignore
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ---- Weapon picker ----
// NOTE: This picker is intentionally "directly from WEAPONS" so you can allow
// hidden / evolved / dev weapons as starter options when you want.
const weaponIds = Object.keys(WEAPONS) as WeaponId[];

let selectedWeapon: WeaponId =
    (startBtn.dataset.weapon as WeaponId) ||
    (weaponIds.includes("KNIFE" as WeaponId) ? ("KNIFE" as WeaponId) : weaponIds[0]);

function setSelectedWeapon(id: WeaponId) {
  selectedWeapon = id;
  startBtn.dataset.weapon = id;

  // Update visual pressed state
  const buttons = weaponChoicesEl.querySelectorAll("button[data-weapon]");
  buttons.forEach((b) => {
    const wid = (b as HTMLButtonElement).dataset.weapon as WeaponId;
    b.setAttribute("aria-pressed", wid === selectedWeapon ? "true" : "false");
  });

  const title = WEAPONS[id]?.title ?? id;
  menuSublineEl.textContent = `Slice v0.5 — 3 floors (20 sec → boss). Starter weapon: ${title}.`;
}

/**
 * Keep switch order aligned with WeaponId order:
 * KNIFE, KNIFE_EVOLVED_RING, PISTOL, PISTOL_EVOLVED_SPIRAL, SYRINGE,
 * SYRINGE_EVOLVED_CHAIN, SWORD, KNUCKLES, AURA, MOLOTOV
 */
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
  // Minimal rule for now: explicit evolved ids.
  // If you later add explicit metadata on the weapon def, swap to that.
  return (
      id === "KNIFE_EVOLVED_RING" ||
      id === "PISTOL_EVOLVED_SPIRAL" ||
      id === "SYRINGE_EVOLVED_CHAIN" ||
      id === "BAZOOKA_EVOLVED" ||
      id === "BOUNCER_EVOLVED_BANKSHOT"
  );
}

function buildWeaponPicker() {
  weaponChoicesEl.innerHTML = "";

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
    weaponChoicesEl.appendChild(btn);
  }

  setSelectedWeapon(selectedWeapon);
}

buildWeaponPicker();

// ---- Menu Navigation ----
// Welcome screen → Main menu
continueBtn.addEventListener("click", () => {
  welcomeScreen.hidden = true;
  mainMenuEl.hidden = false;
});

// Main menu → Weapon selection
startRunBtn.addEventListener("click", () => {
  mainMenuEl.hidden = true;
  menuEl.hidden = false;
});

// Main menu → Innkeeper
innkeeperBtn.addEventListener("click", () => {
  mainMenuEl.hidden = true;
  innkeeperMenuEl.hidden = false;
});

// Innkeeper → Main menu
innkeeperBackBtn.addEventListener("click", () => {
  innkeeperMenuEl.hidden = true;
  mainMenuEl.hidden = false;
});

// Main menu → Settings
settingsBtn.addEventListener("click", () => {
  mainMenuEl.hidden = true;
  settingsMenuEl.hidden = false;
});

// Settings → Main menu
settingsBackBtn.addEventListener("click", () => {
  settingsMenuEl.hidden = true;
  mainMenuEl.hidden = false;
});

// Like & Subscribe button
likeSubBtn.addEventListener("click", () => {
  window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
});

// ---- Game ----
const game = createGame({
  canvas,
  ctx,
  hud: {
    root: hudEl,
    timePill: document.getElementById("timePill") as HTMLSpanElement,
    killsPill: document.getElementById("killsPill") as HTMLSpanElement,
    hpPill: document.getElementById("hpPill") as HTMLSpanElement,
    lvlPill: document.getElementById("lvlPill") as HTMLSpanElement,

    // NEW: inventory HUD
    weaponSlots: document.getElementById("weaponSlots") as HTMLDivElement,
    itemSlots: document.getElementById("itemSlots") as HTMLDivElement,
  },
  ui: {
    menuEl,
    endEl: {
      root: endRoot,
      title: endTitle,
      sub: endSubline,
      btn: endBtn,
    },
    levelupEl: {
      root: levelupRoot,
      choices: levelupChoices,
      sub: levelupSub,
    },
    mapEl: {
      root: mapRoot,
      sub: mapSub,
      svg: mapSvg,
      hit: mapHit,
    },
  },
});



let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// NOTE: no startBtn handler here — game.ts owns menu click-to-start,
// and reads startBtn.dataset.weapon.
