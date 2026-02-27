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
    sub: HTMLDivElement;
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
    weaponSlots: HTMLDivElement;
    itemSlots: HTMLDivElement;
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
    innkeeperBtn: HTMLButtonElement;
    settingsBtn: HTMLButtonElement;
    likeSubBtn: HTMLButtonElement;
    characterSelectEl: HTMLDivElement;
    characterChoicesEl: HTMLDivElement;
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
    settingsBackBtn: HTMLButtonElement;
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
    mapSub: HTMLDivElement;
    mapSvg: SVGSVGElement;
    mapHit: HTMLDivElement;
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
    weaponSlots: HTMLDivElement;
    itemSlots: HTMLDivElement;
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
    const innkeeperBtn = getEl<HTMLButtonElement>("innkeeperBtn");
    const settingsBtn = getEl<HTMLButtonElement>("settingsBtn");
    const likeSubBtn = getEl<HTMLButtonElement>("likeSubBtn");

    const characterSelectEl = getEl<HTMLDivElement>("characterSelect");
    const characterChoicesEl = getEl<HTMLDivElement>("characterChoices");
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
    const settingsBackBtn = getEl<HTMLButtonElement>("settingsBackBtn");

    const menuEl = getEl<HTMLDivElement>("menu");
    const startBtn = getEl<HTMLButtonElement>("startBtn");
    const weaponChoicesEl = getEl<HTMLDivElement>("weaponChoices");
    const menuSublineEl = getEl<HTMLDivElement>("menuSubline");

    const hudEl = getEl<HTMLDivElement>("hud");
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
    const weaponSlots = getEl<HTMLDivElement>("weaponSlots");
    const itemSlots = getEl<HTMLDivElement>("itemSlots");
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
    const mapSub = getEl<HTMLDivElement>("mapSub");
    const mapSvg = getSvg("#mapSvg");
    const mapHit = getEl<HTMLDivElement>("mapHit");

    const hud: HudRefs = {
        root: hudEl,
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
        weaponSlots,
        itemSlots,
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
            sub: mapSub,
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
        innkeeperBtn,
        settingsBtn,
        likeSubBtn,
        characterSelectEl,
        characterChoicesEl,
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
        settingsBackBtn,
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
        mapSub,
        mapSvg,
        mapHit,
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
        weaponSlots,
        itemSlots,
        dialogRoot,
        dialogText,
        dialogChoices,
        hud,
        ui,
    };
}
