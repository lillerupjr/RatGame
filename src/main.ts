// src/main.ts
import { createGame } from "./game/game";
import { resizeCanvasPixelPerfect } from "./engine/render/pixelPerfect";
import { getDomRefs } from "./ui/domRefs";
import { wireMenus } from "./ui/menuWiring";
import {
  DEBUG_TOGGLE_DEFINITIONS,
  LIGHTING_MASK_DEBUG_MODES,
  NEUTRAL_BIRD_FORCE_STATES,
  makeAllDebugOffSettings,
  type BooleanDebugSettingKey,
} from "./debugSettings";
import { getUserSettings, initUserSettings, updateUserSettings } from "./userSettings";

function installDevSettingsUi(): void {
  if (!import.meta.env.DEV) return;

  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.top = "12px";
  root.style.right = "12px";
  root.style.zIndex = "9999";
  root.style.pointerEvents = "auto";
  document.body.appendChild(root);

  const cog = document.createElement("button");
  cog.type = "button";
  cog.textContent = "⚙";
  cog.title = "Settings";
  cog.style.width = "34px";
  cog.style.height = "34px";
  cog.style.border = "1px solid rgba(255,255,255,0.25)";
  cog.style.borderRadius = "8px";
  cog.style.background = "rgba(20,20,20,0.8)";
  cog.style.color = "#fff";
  cog.style.cursor = "pointer";
  root.appendChild(cog);

  const panel = document.createElement("div");
  panel.hidden = true;
  panel.style.marginTop = "8px";
  panel.style.minWidth = "220px";
  panel.style.padding = "10px";
  panel.style.border = "1px solid rgba(255,255,255,0.18)";
  panel.style.borderRadius = "10px";
  panel.style.background = "rgba(10,10,10,0.92)";
  panel.style.color = "#fff";
  panel.style.font = "12px monospace";
  panel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)";
  root.appendChild(panel);

  const title = document.createElement("div");
  title.textContent = "Debug Settings";
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";
  panel.appendChild(title);

  type SettingsDebug = ReturnType<typeof getUserSettings>["debug"];
  const checks = new Map<BooleanDebugSettingKey, HTMLInputElement>();

  const addToggle = (key: BooleanDebugSettingKey, label: string) => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "10px";
    row.style.padding = "4px 0";
    row.style.cursor = "pointer";

    const text = document.createElement("span");
    text.textContent = label;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener("change", () => {
      updateUserSettings({ debug: { [key]: input.checked } });
    });

    row.appendChild(text);
    row.appendChild(input);
    panel.appendChild(row);
    checks.set(key, input);
  };

  for (let i = 0; i < DEBUG_TOGGLE_DEFINITIONS.length; i++) {
    addToggle(DEBUG_TOGGLE_DEFINITIONS[i].key, DEBUG_TOGGLE_DEFINITIONS[i].label);
  }

  const modeRow = document.createElement("label");
  modeRow.style.display = "flex";
  modeRow.style.alignItems = "center";
  modeRow.style.justifyContent = "space-between";
  modeRow.style.gap = "10px";
  modeRow.style.padding = "4px 0";
  const modeText = document.createElement("span");
  modeText.textContent = "lightingMaskDebugMode";
  const modeSelect = document.createElement("select");
  modeSelect.style.background = "rgba(20,20,20,0.9)";
  modeSelect.style.color = "#fff";
  modeSelect.style.border = "1px solid rgba(255,255,255,0.25)";
  modeSelect.style.borderRadius = "4px";
  const modes = LIGHTING_MASK_DEBUG_MODES;
  for (let i = 0; i < modes.length; i++) {
    const opt = document.createElement("option");
    opt.value = modes[i];
    opt.textContent = modes[i];
    modeSelect.appendChild(opt);
  }
  modeSelect.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        lightingMaskDebugMode: modeSelect.value as SettingsDebug["lightingMaskDebugMode"],
      },
    });
  });
  modeRow.appendChild(modeText);
  modeRow.appendChild(modeSelect);
  panel.appendChild(modeRow);

  const birdTitle = document.createElement("div");
  birdTitle.textContent = "neutralBirdAI";
  birdTitle.style.fontWeight = "700";
  birdTitle.style.marginTop = "10px";
  birdTitle.style.marginBottom = "4px";
  panel.appendChild(birdTitle);

  const birdEnabledRow = document.createElement("label");
  birdEnabledRow.style.display = "flex";
  birdEnabledRow.style.alignItems = "center";
  birdEnabledRow.style.justifyContent = "space-between";
  birdEnabledRow.style.gap = "10px";
  birdEnabledRow.style.padding = "4px 0";
  const birdEnabledText = document.createElement("span");
  birdEnabledText.textContent = "enabled";
  const birdEnabledInput = document.createElement("input");
  birdEnabledInput.type = "checkbox";
  birdEnabledInput.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...getUserSettings().debug.neutralBirdAI,
          enabled: birdEnabledInput.checked,
        },
      },
    });
  });
  birdEnabledRow.appendChild(birdEnabledText);
  birdEnabledRow.appendChild(birdEnabledInput);
  panel.appendChild(birdEnabledRow);

  const birdDisableTransitionsRow = document.createElement("label");
  birdDisableTransitionsRow.style.display = "flex";
  birdDisableTransitionsRow.style.alignItems = "center";
  birdDisableTransitionsRow.style.justifyContent = "space-between";
  birdDisableTransitionsRow.style.gap = "10px";
  birdDisableTransitionsRow.style.padding = "4px 0";
  const birdDisableTransitionsText = document.createElement("span");
  birdDisableTransitionsText.textContent = "disableTransitions";
  const birdDisableTransitionsInput = document.createElement("input");
  birdDisableTransitionsInput.type = "checkbox";
  birdDisableTransitionsInput.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...getUserSettings().debug.neutralBirdAI,
          disableTransitions: birdDisableTransitionsInput.checked,
        },
      },
    });
  });
  birdDisableTransitionsRow.appendChild(birdDisableTransitionsText);
  birdDisableTransitionsRow.appendChild(birdDisableTransitionsInput);
  panel.appendChild(birdDisableTransitionsRow);

  const birdDrawDebugRow = document.createElement("label");
  birdDrawDebugRow.style.display = "flex";
  birdDrawDebugRow.style.alignItems = "center";
  birdDrawDebugRow.style.justifyContent = "space-between";
  birdDrawDebugRow.style.gap = "10px";
  birdDrawDebugRow.style.padding = "4px 0";
  const birdDrawDebugText = document.createElement("span");
  birdDrawDebugText.textContent = "drawDebug";
  const birdDrawDebugInput = document.createElement("input");
  birdDrawDebugInput.type = "checkbox";
  birdDrawDebugInput.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...getUserSettings().debug.neutralBirdAI,
          drawDebug: birdDrawDebugInput.checked,
        },
      },
    });
  });
  birdDrawDebugRow.appendChild(birdDrawDebugText);
  birdDrawDebugRow.appendChild(birdDrawDebugInput);
  panel.appendChild(birdDrawDebugRow);

  const birdForceStateRow = document.createElement("label");
  birdForceStateRow.style.display = "flex";
  birdForceStateRow.style.alignItems = "center";
  birdForceStateRow.style.justifyContent = "space-between";
  birdForceStateRow.style.gap = "10px";
  birdForceStateRow.style.padding = "4px 0";
  const birdForceStateText = document.createElement("span");
  birdForceStateText.textContent = "forceState";
  const birdForceStateSelect = document.createElement("select");
  birdForceStateSelect.style.background = "rgba(20,20,20,0.9)";
  birdForceStateSelect.style.color = "#fff";
  birdForceStateSelect.style.border = "1px solid rgba(255,255,255,0.25)";
  birdForceStateSelect.style.borderRadius = "4px";
  for (let i = 0; i < NEUTRAL_BIRD_FORCE_STATES.length; i++) {
    const opt = document.createElement("option");
    opt.value = NEUTRAL_BIRD_FORCE_STATES[i];
    opt.textContent = NEUTRAL_BIRD_FORCE_STATES[i];
    birdForceStateSelect.appendChild(opt);
  }
  birdForceStateSelect.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...getUserSettings().debug.neutralBirdAI,
          forceState: birdForceStateSelect.value as SettingsDebug["neutralBirdAI"]["forceState"],
        },
      },
    });
  });
  birdForceStateRow.appendChild(birdForceStateText);
  birdForceStateRow.appendChild(birdForceStateSelect);
  panel.appendChild(birdForceStateRow);

  const offAllBtn = document.createElement("button");
  offAllBtn.type = "button";
  offAllBtn.textContent = "Turn Off All";
  offAllBtn.style.marginTop = "10px";
  offAllBtn.style.width = "100%";
  offAllBtn.style.height = "30px";
  offAllBtn.style.border = "1px solid rgba(255,255,255,0.25)";
  offAllBtn.style.borderRadius = "6px";
  offAllBtn.style.background = "rgba(28,28,28,0.95)";
  offAllBtn.style.color = "#fff";
  offAllBtn.style.cursor = "pointer";
  offAllBtn.addEventListener("click", () => {
    updateUserSettings({
      debug: makeAllDebugOffSettings(),
    });
    syncFromSettings();
  });
  panel.appendChild(offAllBtn);

  const syncFromSettings = () => {
    const s = getUserSettings();
    for (let i = 0; i < DEBUG_TOGGLE_DEFINITIONS.length; i++) {
      const def = DEBUG_TOGGLE_DEFINITIONS[i];
      checks.get(def.key)!.checked = s.debug[def.key];
    }
    modeSelect.value = s.debug.lightingMaskDebugMode;
    birdEnabledInput.checked = s.debug.neutralBirdAI.enabled;
    birdDisableTransitionsInput.checked = s.debug.neutralBirdAI.disableTransitions;
    birdDrawDebugInput.checked = s.debug.neutralBirdAI.drawDebug;
    birdForceStateSelect.value = s.debug.neutralBirdAI.forceState;
  };

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    if (open) syncFromSettings();
  };

  cog.addEventListener("click", () => {
    setOpen(panel.hidden);
  });
}

async function bootstrap() {
  await initUserSettings();
  installDevSettingsUi();

  const refs = getDomRefs();
  const canvas = refs.canvas;
  const rawCtx = canvas.getContext("2d");
  if (!rawCtx) throw new Error("Canvas 2D context not available");
  const ctx = rawCtx;

  // This adjusts the world to screen pixel ratio
  const pixelScale = 2;

  function resize() {
    resizeCanvasPixelPerfect(canvas, ctx, window.innerWidth, window.innerHeight, pixelScale);
  }
  window.addEventListener("resize", resize);
  resize();

  const game = createGame({
    canvas,
    ctx,
    hud: refs.hud,
    ui: refs.ui,
  });

  wireMenus(refs, game);

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

void bootstrap();

// NOTE: no startBtn handler here -- game.ts owns menu click-to-start,
// and reads startBtn.dataset.weapon.
