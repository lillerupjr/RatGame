import type { World } from "../../engine/world/world";
import { getCombatModsSnapshot } from "../../game/combat_mods";
import {
  applySfxSettingsToWorld,
  getAudioSettings,
  setMusicMuted,
  setMusicVolume,
  setSfxMuted,
  setSfxVolume,
} from "../../game/audio/audioSettings";

export type PauseMenuActions = {
  onResume(): void;
  onQuitRun(): void;
};

export type PauseMenuController = {
  setVisible(v: boolean): void;
  render(world: World | null): void;
  destroy(): void;
};

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function setDataAttr(el: HTMLElement, name: string): void {
  el.setAttribute(`data-${name}`, "1");
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function num(x: number, digits = 2): string {
  return x.toFixed(digits);
}

export function mountPauseMenu(args: {
  root: HTMLDivElement;
  actions: PauseMenuActions;
}): PauseMenuController {
  const root = args.root;
  const preservedChildren = Array.from(root.children).filter((el) => el instanceof HTMLElement) as HTMLElement[];

  const host = document.createElement("div");
  host.className = "pauseOverlay";
  host.hidden = true;

  const panel = document.createElement("div");
  panel.className = "pausePanel";

  const header = document.createElement("div");
  header.className = "pauseHeader";

  const title = document.createElement("div");
  title.className = "title";
  title.classList.add("pauseTitle");
  title.textContent = "Paused";

  const actionsRow = document.createElement("div");
  actionsRow.className = "pauseHeaderButtons";

  const resumeBtn = document.createElement("button");
  resumeBtn.type = "button";
  resumeBtn.className = "pauseBtn pauseResume";
  setDataAttr(resumeBtn, "pause-resume");
  resumeBtn.textContent = "Resume";

  const quitBtn = document.createElement("button");
  quitBtn.type = "button";
  quitBtn.className = "pauseBtn pauseQuit";
  setDataAttr(quitBtn, "pause-quit");
  quitBtn.textContent = "Quit Run";

  actionsRow.appendChild(resumeBtn);
  actionsRow.appendChild(quitBtn);
  header.appendChild(title);
  header.appendChild(actionsRow);

  const grid = document.createElement("div");
  grid.className = "pauseGrid";

  const audioSection = document.createElement("section");
  audioSection.className = "pauseSection pauseAudio";
  const audioTitle = document.createElement("h3");
  audioTitle.textContent = "Audio";

  const musicRow = document.createElement("label");
  musicRow.className = "audioRow";
  const musicLabel = document.createElement("span");
  musicLabel.textContent = "Music";
  const musicSlider = document.createElement("input");
  musicSlider.type = "range";
  musicSlider.min = "0";
  musicSlider.max = "1";
  musicSlider.step = "0.01";
  setDataAttr(musicSlider, "audio-music-slider");
  const musicMuteBtn = document.createElement("button");
  musicMuteBtn.type = "button";
  setDataAttr(musicMuteBtn, "audio-music-mute");
  musicRow.appendChild(musicLabel);
  musicRow.appendChild(musicSlider);
  musicRow.appendChild(musicMuteBtn);

  const sfxRow = document.createElement("label");
  sfxRow.className = "audioRow";
  const sfxLabel = document.createElement("span");
  sfxLabel.textContent = "SFX";
  const sfxSlider = document.createElement("input");
  sfxSlider.type = "range";
  sfxSlider.min = "0";
  sfxSlider.max = "1";
  sfxSlider.step = "0.01";
  setDataAttr(sfxSlider, "audio-sfx-slider");
  const sfxMuteBtn = document.createElement("button");
  sfxMuteBtn.type = "button";
  setDataAttr(sfxMuteBtn, "audio-sfx-mute");
  sfxRow.appendChild(sfxLabel);
  sfxRow.appendChild(sfxSlider);
  sfxRow.appendChild(sfxMuteBtn);

  audioSection.appendChild(audioTitle);
  audioSection.appendChild(musicRow);
  audioSection.appendChild(sfxRow);

  const buildSection = document.createElement("section");
  buildSection.className = "pauseSection pauseBuild";
  const buildTitle = document.createElement("h3");
  buildTitle.textContent = "Build";
  const characterLine = document.createElement("div");
  characterLine.className = "pauseMeta";
  setDataAttr(characterLine, "character");
  const weaponSummaryLine = document.createElement("div");
  weaponSummaryLine.className = "pauseMeta";
  setDataAttr(weaponSummaryLine, "weapon-summary");
  const weaponStatsTable = document.createElement("table");
  weaponStatsTable.className = "pauseStatTable";
  setDataAttr(weaponStatsTable, "weapon-stats-table");

  const cardsTitle = document.createElement("h4");
  cardsTitle.textContent = "Cards";
  const buildScroll = document.createElement("div");
  buildScroll.className = "pauseScroll";
  const cardGrid = document.createElement("div");
  cardGrid.className = "pauseCardGrid";
  setDataAttr(cardGrid, "card-grid");

  const relicsTitle = document.createElement("h4");
  relicsTitle.textContent = "Relics";
  const relicList = document.createElement("div");
  relicList.className = "relicList";
  setDataAttr(relicList, "relic-list");

  buildSection.appendChild(buildTitle);
  buildSection.appendChild(characterLine);
  buildSection.appendChild(weaponSummaryLine);
  buildSection.appendChild(buildScroll);
  buildScroll.appendChild(cardsTitle);
  buildScroll.appendChild(cardGrid);
  buildScroll.appendChild(weaponStatsTable);
  buildScroll.appendChild(relicsTitle);
  buildScroll.appendChild(relicList);

  const statsSection = document.createElement("section");
  statsSection.className = "pauseSection pauseStats";
  const statsTitle = document.createElement("h3");
  statsTitle.textContent = "Stats";
  const statsScroll = document.createElement("div");
  statsScroll.className = "pauseScroll";
  const statTable = document.createElement("table");
  statTable.className = "pauseStatTable";
  setDataAttr(statTable, "stat-table");
  statsSection.appendChild(statsTitle);
  statsSection.appendChild(statsScroll);
  statsScroll.appendChild(statTable);

  grid.appendChild(audioSection);
  grid.appendChild(buildSection);
  grid.appendChild(statsSection);

  panel.appendChild(header);
  panel.appendChild(grid);
  host.appendChild(panel);
  root.appendChild(host);

  let latestWorld: World | null = null;

  const syncAudioControls = () => {
    const audio = getAudioSettings();
    musicSlider.value = `${audio.musicVolume}`;
    musicMuteBtn.textContent = audio.musicMuted ? "Unmute" : "Mute";
    if (audio.musicMuted) musicMuteBtn.classList.add("muted");
    else musicMuteBtn.classList.remove("muted");

    sfxSlider.value = `${audio.sfxVolume}`;
    sfxMuteBtn.textContent = audio.sfxMuted ? "Unmute" : "Mute";
    if (audio.sfxMuted) sfxMuteBtn.classList.add("muted");
    else sfxMuteBtn.classList.remove("muted");
  };

  const applySfxToLatestWorld = () => {
    if (latestWorld) applySfxSettingsToWorld(latestWorld);
  };

  const renderStats = (world: World | null) => {
    clearChildren(statTable);
    if (!world) return;

    const critChance = safeNum(world.baseCritChance) + safeNum(world.critChanceBonus);
    const rows: Array<[string, string]> = [
      ["HP", `${safeNum(world.playerHp).toFixed(0)} / ${safeNum(world.playerHpMax).toFixed(0)}`],
      ["Move Speed", safeNum((world as any).pSpeed).toFixed(2)],
      ["Damage Mult", safeNum(world.dmgMult, 1).toFixed(2)],
      ["Fire Rate Mult", safeNum(world.fireRateMult, 1).toFixed(2)],
      ["Crit Chance", `${(Math.max(0, Math.min(1, critChance)) * 100).toFixed(1)}%`],
      ["Crit Multi", `${safeNum(world.critMultiplier, 1).toFixed(2)}x`],
      ["Gold", `${safeNum(world.gold).toFixed(0)}`],
      ["Kills", `${safeNum(world.kills).toFixed(0)}`],
    ];

    for (const [k, v] of rows) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      const td = document.createElement("td");
      th.textContent = k;
      td.textContent = v;
      tr.appendChild(th);
      tr.appendChild(td);
      statTable.appendChild(tr);
    }
  };

  const renderCardsAndRelicsAndWeapon = (world: World | null) => {
    clearChildren(cardGrid);
    clearChildren(weaponStatsTable);
    clearChildren(relicList);
    const characterId = world ? (((world as any).currentCharacterId as string | undefined) ?? "Unknown") : "Unknown";
    characterLine.textContent = `Character: ${characterId}`;

    let snapshot: ReturnType<typeof getCombatModsSnapshot> | null = null;
    try {
      snapshot = getCombatModsSnapshot(world as any);
    } catch {
      snapshot = getCombatModsSnapshot({});
    }

    if (snapshot.cards.length === 0) {
      cardGrid.textContent = "No cards yet";
    } else {
      for (const card of snapshot.cards) {
        const tile = document.createElement("div");
        tile.className = "pauseCardTile";

        const name = document.createElement("div");
        name.className = "pauseCardName";
        name.textContent = card.name;

        const count = document.createElement("div");
        count.className = "pauseCardCount";
        count.textContent = `x${card.count}`;

        tile.appendChild(name);
        tile.appendChild(count);
        cardGrid.appendChild(tile);
      }
    }

    const resolved = snapshot.weaponStats;
    weaponSummaryLine.textContent =
      `Weapon: Pistol | SPS ${num(resolved.shotsPerSecond)} | ` +
      `Damage ${(
        resolved.baseDamage.physical + resolved.baseDamage.fire + resolved.baseDamage.chaos
      ).toFixed(1)}`;

    const weaponRows: Array<[string, string]> = [
      ["shotsPerSecond", num(resolved.shotsPerSecond)],
      ["baseDamage.physical", num(resolved.baseDamage.physical, 1)],
      ["baseDamage.fire", num(resolved.baseDamage.fire, 1)],
      ["baseDamage.chaos", num(resolved.baseDamage.chaos, 1)],
      ["critChance", pct(resolved.critChance)],
      ["critMulti", `${num(resolved.critMulti)}x`],
      ["spreadBaseDeg", num(resolved.spreadBaseDeg, 1)],
      ["convert.physToFire", pct(resolved.convert.physToFire)],
      ["convert.physToChaos", pct(resolved.convert.physToChaos)],
      ["convert.fireToChaos", pct(resolved.convert.fireToChaos)],
      ["chanceToBleed", pct(resolved.chanceToBleed)],
      ["chanceToIgnite", pct(resolved.chanceToIgnite)],
      ["chanceToPoison", pct(resolved.chanceToPoison)],
    ];
    for (const [k, v] of weaponRows) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      const td = document.createElement("td");
      th.textContent = k;
      td.textContent = v;
      tr.appendChild(th);
      tr.appendChild(td);
      weaponStatsTable.appendChild(tr);
    }

    const relics = Array.isArray((world as any)?.relics) ? ((world as any).relics as string[]) : [];
    relicList.textContent = relics.length === 0 ? "No relics" : relics.join(", ");
  };

  const onMusicSlider = () => {
    setMusicVolume(Number.parseFloat(musicSlider.value));
    syncAudioControls();
  };

  const onMusicMute = () => {
    const next = !getAudioSettings().musicMuted;
    setMusicMuted(next);
    syncAudioControls();
  };

  const onSfxSlider = () => {
    setSfxVolume(Number.parseFloat(sfxSlider.value));
    applySfxToLatestWorld();
    syncAudioControls();
  };

  const onSfxMute = () => {
    const next = !getAudioSettings().sfxMuted;
    setSfxMuted(next);
    applySfxToLatestWorld();
    syncAudioControls();
  };

  resumeBtn.addEventListener("click", args.actions.onResume);
  quitBtn.addEventListener("click", args.actions.onQuitRun);
  musicSlider.addEventListener("input", onMusicSlider);
  musicMuteBtn.addEventListener("click", onMusicMute);
  sfxSlider.addEventListener("input", onSfxSlider);
  sfxMuteBtn.addEventListener("click", onSfxMute);

  syncAudioControls();

  return {
    setVisible(v: boolean): void {
      host.hidden = !v;
      root.hidden = !v;
      for (const el of preservedChildren) {
        el.hidden = v;
      }
    },
    render(world: World | null): void {
      latestWorld = world;
      applySfxToLatestWorld();
      syncAudioControls();
      renderStats(world);
      renderCardsAndRelicsAndWeapon(world);
    },
    destroy(): void {
      resumeBtn.removeEventListener("click", args.actions.onResume);
      quitBtn.removeEventListener("click", args.actions.onQuitRun);
      musicSlider.removeEventListener("input", onMusicSlider);
      musicMuteBtn.removeEventListener("click", onMusicMute);
      sfxSlider.removeEventListener("input", onSfxSlider);
      sfxMuteBtn.removeEventListener("click", onSfxMute);
      host.remove();
      for (const el of preservedChildren) {
        el.hidden = false;
      }
      root.hidden = true;
    },
  };
}
