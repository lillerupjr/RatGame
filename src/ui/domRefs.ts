type EndRefs = {
    root: HTMLDivElement;
    title: HTMLDivElement;
    sub: HTMLDivElement;
    btn: HTMLButtonElement;
    time: HTMLElement;
    depth: HTMLElement;
    kills: HTMLElement;
    gold: HTMLElement;
    relics: HTMLElement;
    cards: HTMLElement;
};

type LevelupRefs = {
    root: HTMLDivElement;
    choices: HTMLDivElement;
    sub: HTMLDivElement;
};

type MapRefs = {
    root: HTMLDivElement;
    topBar: HTMLDivElement;
    legend: HTMLDivElement;
    infoPanel: HTMLDivElement;
    depthLabel: HTMLDivElement;
    sub: HTMLDivElement;
    graphWrap: HTMLDivElement;
    graphContent: HTMLDivElement;
    svg: SVGSVGElement;
    hit: HTMLDivElement;
};

type DialogRefs = {
    root: HTMLDivElement;
    text: HTMLDivElement;
    choices: HTMLDivElement;
};

export type HudRefs = {
    root: HTMLDivElement;
    fpsPill: HTMLSpanElement;
    palettePill: HTMLSpanElement;
    timePill: HTMLSpanElement;
    killsPill: HTMLSpanElement;
    hpPill: HTMLSpanElement;
    armorPill: HTMLSpanElement;
    momentumPill: HTMLSpanElement;
    vitalsOrbRoot: HTMLDivElement;
    vitalsOrb: HTMLDivElement;
    vitalsOrbText: HTMLDivElement;
    vitalsArmorText: HTMLSpanElement;
    vitalsMomentumText: HTMLSpanElement;
    lvlPill: HTMLSpanElement;
    objectiveOverlay: HTMLDivElement;
    objectiveTitle: HTMLDivElement;
    objectiveStatus: HTMLDivElement;
    interactPrompt: HTMLDivElement;
    mobileControlsRoot: HTMLDivElement;
    mobileMoveStick: HTMLDivElement;
    mobileMoveKnob: HTMLDivElement;
    mobileInteractBtn: HTMLDivElement;
};

export type UiRefs = {
    menuEl: HTMLDivElement;
    endEl: EndRefs;
    levelupEl: LevelupRefs;
    mapEl: MapRefs;
    dialogEl: DialogRefs;
};

export type DomRefs = {
    canvas: HTMLCanvasElement;
    uiCanvas: HTMLCanvasElement;
    welcomeScreen: HTMLDivElement;
    continueBtn: HTMLButtonElement;
    mainMenuEl: HTMLDivElement;
    startRunBtn: HTMLButtonElement;
    deterministicRunBtn: HTMLButtonElement;
    mapsBtn: HTMLButtonElement;
    diagnosticsBtn: HTMLButtonElement | null;
    creditsBtn: HTMLButtonElement | null;
    devTerminalSectionEl: HTMLDivElement | null;
    devTerminalToggleBtn: HTMLButtonElement | null;
    devTerminalItemsEl: HTMLDivElement | null;
    innkeeperBtn: HTMLButtonElement;
    settingsBtn: HTMLButtonElement;
    likeSubBtn: HTMLButtonElement;
    characterSelectEl: HTMLDivElement;
    characterChoicesEl: HTMLDivElement;
    characterDetailEl: HTMLDivElement | null;
    characterDetailNameEl: HTMLElement | null;
    characterDetailWeaponEl: HTMLElement | null;
    characterDetailDescEl: HTMLDivElement | null;
    characterBackBtn: HTMLButtonElement;
    characterContinueBtn: HTMLButtonElement;
    mapMenuEl: HTMLDivElement;
    mapChoicesEl: HTMLDivElement;
    mapMenuSublineEl: HTMLDivElement;
    mapBackBtn: HTMLButtonElement;
    mapContinueBtn: HTMLButtonElement;
    innkeeperMenuEl: HTMLDivElement;
    innkeeperBackBtn: HTMLButtonElement;
    settingsMenuEl: HTMLDivElement;
    mainSettingsHostEl: HTMLDivElement;
    settingsBackBtn: HTMLButtonElement;
    creditsMenuEl: HTMLDivElement;
    creditsBackBtn: HTMLButtonElement;
    menuEl: HTMLDivElement;
    startBtn: HTMLButtonElement;
    weaponChoicesEl: HTMLDivElement;
    menuSublineEl: HTMLDivElement;
    hudEl: HTMLDivElement;
    endRoot: HTMLDivElement;
    endTitle: HTMLDivElement;
    endSubline: HTMLDivElement;
    endBtn: HTMLButtonElement;
    endStatTime: HTMLElement;
    endStatDepth: HTMLElement;
    endStatKills: HTMLElement;
    endStatGold: HTMLElement;
    endStatRelics: HTMLElement;
    endStatCards: HTMLElement;
    levelupRoot: HTMLDivElement;
    levelupChoices: HTMLDivElement;
    levelupSub: HTMLDivElement;
    mapRoot: HTMLDivElement;
    mapTopBar: HTMLDivElement;
    mapLegend: HTMLDivElement;
    mapInfoPanel: HTMLDivElement;
    mapDepthLabel: HTMLDivElement;
    mapSub: HTMLDivElement;
    mapGraphWrap: HTMLDivElement;
    mapGraphContent: HTMLDivElement;
    mapSvg: SVGSVGElement;
    mapHit: HTMLDivElement;
    fpsPill: HTMLSpanElement;
    palettePill: HTMLSpanElement;
    timePill: HTMLSpanElement;
    killsPill: HTMLSpanElement;
    hpPill: HTMLSpanElement;
    armorPill: HTMLSpanElement;
    momentumPill: HTMLSpanElement;
    vitalsOrbRoot: HTMLDivElement;
    vitalsOrb: HTMLDivElement;
    vitalsOrbText: HTMLDivElement;
    vitalsArmorText: HTMLSpanElement;
    vitalsMomentumText: HTMLSpanElement;
    lvlPill: HTMLSpanElement;
    interactPrompt: HTMLDivElement;
    mobileControlsRoot: HTMLDivElement;
    mobileMoveStick: HTMLDivElement;
    mobileMoveKnob: HTMLDivElement;
    mobileInteractBtn: HTMLDivElement;
    dialogRoot: HTMLDivElement;
    dialogText: HTMLDivElement;
    dialogChoices: HTMLDivElement;
    hud: HudRefs;
    ui: UiRefs;
};

function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element: ${id}`);
    return el as T;
}

function getSvg(selector: string): SVGSVGElement {
    const el = document.querySelector<SVGSVGElement>(selector);
    if (!el) throw new Error(`Missing element: ${selector}`);
    return el;
}

export function getDomRefs(): DomRefs {
    const canvas = getEl<HTMLCanvasElement>("c");
    const uiCanvas = getEl<HTMLCanvasElement>("ui");
    const welcomeScreen = getEl<HTMLDivElement>("welcomeScreen");
    const continueBtn = getEl<HTMLButtonElement>("continueBtn");

    const mainMenuEl = getEl<HTMLDivElement>("mainMenu");
    const startRunBtn = getEl<HTMLButtonElement>("startRunBtn");
    const deterministicRunBtn = getEl<HTMLButtonElement>("deterministicRunBtn");
    const mapsBtn = getEl<HTMLButtonElement>("mapsBtn");
    const diagnosticsBtn = document.getElementById("diagnosticsBtn") as HTMLButtonElement | null;
    const creditsBtn = document.getElementById("creditsBtn") as HTMLButtonElement | null;
    const devTerminalSectionEl = document.getElementById("devTerminalSection") as HTMLDivElement | null;
    const devTerminalToggleBtn = document.getElementById("devTerminalToggleBtn") as HTMLButtonElement | null;
    const devTerminalItemsEl = document.getElementById("devTerminalItems") as HTMLDivElement | null;
    const innkeeperBtn = getEl<HTMLButtonElement>("innkeeperBtn");
    const settingsBtn = getEl<HTMLButtonElement>("settingsBtn");
    const likeSubBtn = getEl<HTMLButtonElement>("likeSubBtn");

    const characterSelectEl = getEl<HTMLDivElement>("characterSelect");
    const characterChoicesEl = getEl<HTMLDivElement>("characterChoices");
    const characterDetailEl = document.getElementById("characterDetail") as HTMLDivElement | null;
    const characterDetailNameEl = document.getElementById("characterDetailName") as HTMLElement | null;
    const characterDetailWeaponEl = document.getElementById("characterDetailWeapon") as HTMLElement | null;
    const characterDetailDescEl = document.getElementById("characterDetailDesc") as HTMLDivElement | null;
    const characterBackBtn = getEl<HTMLButtonElement>("characterBackBtn");
    const characterContinueBtn = getEl<HTMLButtonElement>("characterContinueBtn");

    const mapMenuEl = getEl<HTMLDivElement>("mapMenu");
    const mapChoicesEl = getEl<HTMLDivElement>("mapChoices");
    const mapMenuSublineEl = getEl<HTMLDivElement>("mapMenuSubline");
    const mapBackBtn = getEl<HTMLButtonElement>("mapBackBtn");
    const mapContinueBtn = getEl<HTMLButtonElement>("mapContinueBtn");

    const innkeeperMenuEl = getEl<HTMLDivElement>("innkeeperMenu");
    const innkeeperBackBtn = getEl<HTMLButtonElement>("innkeeperBackBtn");

    const settingsMenuEl = getEl<HTMLDivElement>("settingsMenu");
    const mainSettingsHostEl = getEl<HTMLDivElement>("mainSettingsHost");
    const settingsBackBtn = getEl<HTMLButtonElement>("settingsBackBtn");
    const creditsMenuEl = getEl<HTMLDivElement>("creditsMenu");
    const creditsBackBtn = getEl<HTMLButtonElement>("creditsBackBtn");

    const menuEl = getEl<HTMLDivElement>("menu");
    const startBtn = getEl<HTMLButtonElement>("startBtn");
    const weaponChoicesEl = getEl<HTMLDivElement>("weaponChoices");
    const menuSublineEl = getEl<HTMLDivElement>("menuSubline");

    const hudEl = getEl<HTMLDivElement>("hud");
    const fpsPill = getEl<HTMLSpanElement>("fpsPill");
    const palettePill = getEl<HTMLSpanElement>("palettePill");
    const timePill = getEl<HTMLSpanElement>("timePill");
    const killsPill = getEl<HTMLSpanElement>("killsPill");
    const hpPill = getEl<HTMLSpanElement>("hpPill");
    const armorPill = getEl<HTMLSpanElement>("armorPill");
    const momentumPill = getEl<HTMLSpanElement>("momentumPill");
    const vitalsOrbRoot = getEl<HTMLDivElement>("vitalsOrbRoot");
    const vitalsOrb = getEl<HTMLDivElement>("vitalsOrb");
    const vitalsOrbText = getEl<HTMLDivElement>("vitalsOrbText");
    const vitalsArmorText = getEl<HTMLSpanElement>("vitalsArmorText");
    const vitalsMomentumText = getEl<HTMLSpanElement>("vitalsMomentumText");
    const lvlPill = getEl<HTMLSpanElement>("lvlPill");
    const objectiveOverlay = getEl<HTMLDivElement>("objectiveOverlay");
    const objectiveTitle = getEl<HTMLDivElement>("objectiveTitle");
    const objectiveStatus = getEl<HTMLDivElement>("objectiveStatus");
    const interactPrompt = getEl<HTMLDivElement>("interactPrompt");
    const mobileControlsRoot = getEl<HTMLDivElement>("mobileControls");
    const mobileMoveStick = getEl<HTMLDivElement>("mobileMoveStick");
    const mobileMoveKnob = getEl<HTMLDivElement>("mobileMoveKnob");
    const mobileInteractBtn = getEl<HTMLDivElement>("mobileInteractBtn");
    const dialogRoot = getEl<HTMLDivElement>("dialogBar");
    const dialogText = getEl<HTMLDivElement>("dialogText");
    const dialogChoices = getEl<HTMLDivElement>("dialogChoices");

    const endRoot = getEl<HTMLDivElement>("end");
    const endTitle = getEl<HTMLDivElement>("endTitle");
    const endSubline = getEl<HTMLDivElement>("endSubline");
    const endBtn = getEl<HTMLButtonElement>("endBtn");
    const endStatTime = getEl<HTMLElement>("endStatTime");
    const endStatDepth = getEl<HTMLElement>("endStatDepth");
    const endStatKills = getEl<HTMLElement>("endStatKills");
    const endStatGold = getEl<HTMLElement>("endStatGold");
    const endStatRelics = getEl<HTMLElement>("endStatRelics");
    const endStatCards = getEl<HTMLElement>("endStatCards");

    const levelupRoot = getEl<HTMLDivElement>("levelup");
    const levelupChoices = getEl<HTMLDivElement>("luChoices");
    const levelupSub = getEl<HTMLDivElement>("luSub");

    const mapRoot = getEl<HTMLDivElement>("map");
    const mapTopBar = getEl<HTMLDivElement>("mapTopBar");
    const mapLegend = getEl<HTMLDivElement>("mapLegend");
    const mapInfoPanel = getEl<HTMLDivElement>("mapInfoPanel");
    const mapDepthLabel = getEl<HTMLDivElement>("mapDepthLabel");
    const mapSub = getEl<HTMLDivElement>("mapSub");
    const mapGraphWrap = getEl<HTMLDivElement>("mapGraphWrap");
    const mapGraphContent = getEl<HTMLDivElement>("mapGraphContent");
    const mapSvg = getSvg("#mapSvg");
    const mapHit = getEl<HTMLDivElement>("mapHit");

    const hud: HudRefs = {
        root: hudEl,
        fpsPill,
        palettePill,
        timePill,
        killsPill,
        hpPill,
        armorPill,
        momentumPill,
        vitalsOrbRoot,
        vitalsOrb,
        vitalsOrbText,
        vitalsArmorText,
        vitalsMomentumText,
        lvlPill,
        objectiveOverlay,
        objectiveTitle,
        objectiveStatus,
        interactPrompt,
        mobileControlsRoot,
        mobileMoveStick,
        mobileMoveKnob,
        mobileInteractBtn,
    };

    const ui: UiRefs = {
        menuEl,
        endEl: {
            root: endRoot,
            title: endTitle,
            sub: endSubline,
            btn: endBtn,
            time: endStatTime,
            depth: endStatDepth,
            kills: endStatKills,
            gold: endStatGold,
            relics: endStatRelics,
            cards: endStatCards,
        },
        levelupEl: {
            root: levelupRoot,
            choices: levelupChoices,
            sub: levelupSub,
        },
        mapEl: {
            root: mapRoot,
            topBar: mapTopBar,
            legend: mapLegend,
            infoPanel: mapInfoPanel,
            depthLabel: mapDepthLabel,
            sub: mapSub,
            graphWrap: mapGraphWrap,
            graphContent: mapGraphContent,
            svg: mapSvg,
            hit: mapHit,
        },
        dialogEl: {
            root: dialogRoot,
            text: dialogText,
            choices: dialogChoices,
        },
    };

    return {
        canvas,
        uiCanvas,
        welcomeScreen,
        continueBtn,
        mainMenuEl,
        startRunBtn,
        deterministicRunBtn,
        mapsBtn,
        diagnosticsBtn,
        creditsBtn,
        devTerminalSectionEl,
        devTerminalToggleBtn,
        devTerminalItemsEl,
        innkeeperBtn,
        settingsBtn,
        likeSubBtn,
        characterSelectEl,
        characterChoicesEl,
        characterDetailEl,
        characterDetailNameEl,
        characterDetailWeaponEl,
        characterDetailDescEl,
        characterBackBtn,
        characterContinueBtn,
        mapMenuEl,
        mapChoicesEl,
        mapMenuSublineEl,
        mapBackBtn,
        mapContinueBtn,
        innkeeperMenuEl,
        innkeeperBackBtn,
        settingsMenuEl,
        mainSettingsHostEl,
        settingsBackBtn,
        creditsMenuEl,
        creditsBackBtn,
        menuEl,
        startBtn,
        weaponChoicesEl,
        menuSublineEl,
        hudEl,
        endRoot,
        endTitle,
        endSubline,
        endBtn,
        endStatTime,
        endStatDepth,
        endStatKills,
        endStatGold,
        endStatRelics,
        endStatCards,
        levelupRoot,
        levelupChoices,
        levelupSub,
        mapRoot,
        mapTopBar,
        mapLegend,
        mapInfoPanel,
        mapDepthLabel,
        mapSub,
        mapGraphWrap,
        mapGraphContent,
        mapSvg,
        mapHit,
        fpsPill,
        palettePill,
        timePill,
        killsPill,
        hpPill,
        armorPill,
        momentumPill,
        vitalsOrbRoot,
        vitalsOrb,
        vitalsOrbText,
        vitalsArmorText,
        vitalsMomentumText,
        lvlPill,
        interactPrompt,
        mobileControlsRoot,
        mobileMoveStick,
        mobileMoveKnob,
        mobileInteractBtn,
        dialogRoot,
        dialogText,
        dialogChoices,
        hud,
        ui,
    };
}
