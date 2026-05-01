import type {
  CommandStage,
  RenderCommand,
  RenderCommandPayload,
  RenderFrame,
  RenderPass,
} from "../contracts/renderCommands";
import {
  KindOrder,
  compareRenderKeys,
  deriveFeetSortYFromKey,
  isGroundKindForRenderPass,
  isWorldKindForRenderPass,
  resolveRenderZBand,
  type RenderKey,
} from "../worldRenderOrdering";

export interface RenderFrameBuilder {
  sliceCommands: Map<number, RenderCommand[]>;
  worldBand: RenderCommand[];
  worldTail: RenderCommand[];
  screen: RenderCommand[];
  nextSyntheticStableId: number;
}

export interface FinalizeRenderFrameInput {
  builder: RenderFrameBuilder;
  countRenderSliceKeySort: () => void;
  countRenderDrawableSort: () => void;
  setRenderZBandCount: (count: number) => void;
  tileWorld: number;
  projectToScreenAtZ: (worldX: number, worldY: number, zVisual: number) => { y: number };
  rampRoadTiles: ReadonlySet<string>;
}

type EnqueuedCommand = Omit<RenderCommand, "pass" | "key">;

function cloneRenderKey(key: RenderKey): RenderKey {
  return {
    slice: key.slice,
    within: key.within,
    baseZ: key.baseZ,
    feetSortY: key.feetSortY,
    kindOrder: key.kindOrder,
    structureSouthSlice: key.structureSouthSlice,
    structureSouthWithin: key.structureSouthWithin,
    stableId: key.stableId,
  };
}

function syntheticKey(kindOrder: KindOrder, stableId: number): RenderKey {
  return {
    slice: 0,
    within: 0,
    baseZ: 0,
    kindOrder,
    stableId,
  };
}

export function createRenderFrameBuilder(): RenderFrameBuilder {
  return {
    sliceCommands: new Map<number, RenderCommand[]>(),
    worldBand: [],
    worldTail: [],
    screen: [],
    nextSyntheticStableId: 1_000_000_000,
  };
}

function withStage<T extends RenderCommandPayload>(payload: T, stage: CommandStage): T {
  return {
    ...payload,
    stage: payload.stage ?? stage,
  };
}

function materializeCommand(
  pass: RenderPass,
  key: RenderKey,
  command: EnqueuedCommand,
  stage: CommandStage,
): RenderCommand {
  return {
    pass,
    key,
    ...command,
    payload: withStage(command.payload, stage),
  } as RenderCommand;
}

export function enqueueSliceCommand(
  builder: RenderFrameBuilder,
  key: RenderKey,
  command: EnqueuedCommand,
): void {
  const pass: RenderPass = isGroundKindForRenderPass(key.kindOrder) ? "GROUND" : "WORLD";
  const slice = key.slice | 0;
  const bucket = builder.sliceCommands.get(slice) ?? [];
  bucket.push(materializeCommand(pass, cloneRenderKey(key), command, "slice"));
  if (!builder.sliceCommands.has(slice)) builder.sliceCommands.set(slice, bucket);
}

export function enqueueWorldBandCommand(
  builder: RenderFrameBuilder,
  command: EnqueuedCommand,
  key?: RenderKey,
): void {
  builder.worldBand.push(materializeCommand(
    "WORLD",
    key ? cloneRenderKey(key) : syntheticKey(KindOrder.OVERLAY, builder.nextSyntheticStableId++),
    command,
    "band",
  ));
}

export function enqueueWorldTailCommand(
  builder: RenderFrameBuilder,
  command: EnqueuedCommand,
  key?: RenderKey,
): void {
  builder.worldTail.push(materializeCommand(
    "WORLD",
    key ? cloneRenderKey(key) : syntheticKey(KindOrder.OVERLAY, builder.nextSyntheticStableId++),
    command,
    "tail",
  ));
}

export function enqueueScreenCommand(
  builder: RenderFrameBuilder,
  command: EnqueuedCommand,
  key?: RenderKey,
): void {
  builder.screen.push(materializeCommand(
    "SCREEN",
    key ? cloneRenderKey(key) : syntheticKey(KindOrder.OVERLAY, builder.nextSyntheticStableId++),
    command,
    "tail",
  ));
}

export function finalizeRenderFrame(input: FinalizeRenderFrameInput): RenderFrame {
  const {
    builder,
    countRenderSliceKeySort,
    countRenderDrawableSort,
    setRenderZBandCount,
    tileWorld,
    projectToScreenAtZ,
    rampRoadTiles,
  } = input;

  const sliceKeys = Array.from(builder.sliceCommands.keys());
  countRenderSliceKeySort();
  sliceKeys.sort((a, b) => a - b);

  const zBands = new Set<number>();
  const ground: RenderCommand[] = [];
  const world: RenderCommand[] = [];

  for (let i = 0; i < sliceKeys.length; i++) {
    const commands = builder.sliceCommands.get(sliceKeys[i])!;
    for (let j = 0; j < commands.length; j++) {
      const key = commands[j].key;
      if (isWorldKindForRenderPass(key.kindOrder) && key.feetSortY == null) {
        key.feetSortY = deriveFeetSortYFromKey(key, tileWorld, projectToScreenAtZ);
      }
      zBands.add(resolveRenderZBand(key, rampRoadTiles));
    }
    countRenderDrawableSort();
    commands.sort((a, b) => compareRenderKeys(a.key, b.key));
    for (let j = 0; j < commands.length; j++) {
      if (commands[j].pass === "GROUND") ground.push(commands[j]);
      else world.push(commands[j]);
    }
  }

  for (let i = 0; i < builder.worldBand.length; i++) {
    const zBand = builder.worldBand[i].payload.zBand;
    if (typeof zBand === "number") zBands.add(zBand);
  }

  const zBandKeys = Array.from(zBands);
  zBandKeys.sort((a, b) => a - b);
  setRenderZBandCount(zBandKeys.length);

  return {
    ground,
    world: [...world, ...builder.worldBand, ...builder.worldTail],
    screen: [...builder.screen],
  };
}
