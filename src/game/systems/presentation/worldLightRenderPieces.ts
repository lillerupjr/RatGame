import type { ProjectedLight } from "./renderLighting";
import {
  resolveLightColorAndIntensity,
  type LightColorMode,
  type LightStrength,
} from "./lightColorResolution";

type LightFlicker = ProjectedLight["flicker"];

export type CompiledStaticLight = {
  id: string;
  worldX: number;
  worldY: number;
  zBase?: number;
  zLogical?: number;
  supportHeightUnits?: number;
  heightUnits: number;
  poolHeightOffsetUnits?: number;
  screenOffsetPx?: { x: number; y: number };
  intensity: number;
  radiusPx: number;
  colorMode?: LightColorMode;
  strength?: LightStrength;
  color?: string;
  tintStrength?: number;
  shape?: ProjectedLight["shape"];
  pool?: { radiusPx: number; yScale?: number };
  cone?: { dirRad: number; angleRad: number; lengthPx: number };
  flicker?: LightFlicker;
};

export type RuntimeBeamLightConfig = {
  active: boolean;
  startWorldX: number;
  startWorldY: number;
  endWorldX: number;
  endWorldY: number;
  zVisual: number;
  widthPx: number;
  glowIntensity: number;
};

export type FrameWorldLightSource = "MAP_STATIC" | "RUNTIME_BEAM";

export type FrameWorldLightRecord = {
  id: string;
  anchorTx: number;
  anchorTy: number;
  anchorZ: number;
  projected: ProjectedLight;
  source: FrameWorldLightSource;
};

export type WorldLightRenderPiece = {
  kind: "LIGHT";
  source: FrameWorldLightSource;
  stableId: number;
  slice: number;
  within: number;
  baseZ: number;
  light: FrameWorldLightRecord;
};

export type FrameWorldLightRegistry = {
  lights: FrameWorldLightRecord[];
  renderPieces: WorldLightRenderPiece[];
  projectedLights: ProjectedLight[];
  lightsByHeight: Map<number, number>;
};

export type BuildFrameWorldLightRegistryParams = {
  mapId: string;
  tileWorld: number;
  elevPx: number;
  worldScale: number;
  streetLampOcclusionEnabled: boolean;
  lightOverrides: {
    colorModeOverride: "authored" | LightColorMode;
    strengthOverride: "authored" | LightStrength;
  };
  lightPalette: {
    paletteId: string;
    saturationWeight: number;
  };
  staticLights: ReadonlyArray<CompiledStaticLight>;
  runtimeBeam?: RuntimeBeamLightConfig | null;
  tileHeightAtWorld: (worldX: number, worldY: number) => number;
  isTileInRenderRadius: (tx: number, ty: number) => boolean;
  projectToScreen: (worldX: number, worldY: number, zPx: number) => { x: number; y: number };
};

function stableIdFromString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildStaticLightRecord(
  light: CompiledStaticLight,
  index: number,
  params: BuildFrameWorldLightRegistryParams,
): FrameWorldLightRecord | null {
  const ltx = Math.floor(light.worldX / params.tileWorld);
  const lty = Math.floor(light.worldY / params.tileWorld);
  if (!params.isTileInRenderRadius(ltx, lty)) return null;

  const isStreetLamp = (light.shape ?? "RADIAL") === "STREET_LAMP";
  const supportZ = Number.isFinite(light.supportHeightUnits)
    ? (light.supportHeightUnits as number)
    : Number.isFinite(light.zBase)
      ? (light.zBase as number)
    : params.tileHeightAtWorld(light.worldX, light.worldY);
  const anchorZ = Math.floor(supportZ + 1e-3);
  const projectedZ = isStreetLamp
    ? anchorZ
    : Math.floor(light.heightUnits + 1e-3);
  const screenOffsetX = (light.screenOffsetPx?.x ?? 0) * params.worldScale;
  const screenOffsetY = (light.screenOffsetPx?.y ?? 0) * params.worldScale;
  const pos = params.projectToScreen(light.worldX, light.worldY, light.heightUnits * params.elevPx);
  const sx = pos.x + screenOffsetX;
  const sy = pos.y + screenOffsetY;
  const effectiveColorMode = params.lightOverrides.colorModeOverride === "authored"
    ? light.colorMode
    : params.lightOverrides.colorModeOverride;
  const effectiveStrength = params.lightOverrides.strengthOverride === "authored"
    ? light.strength
    : params.lightOverrides.strengthOverride;
  const resolvedLight = resolveLightColorAndIntensity({
    colorMode: effectiveColorMode,
    strength: effectiveStrength,
    authoredColor: light.color,
    baseIntensity: light.intensity,
    paletteId: params.lightPalette.paletteId,
    saturationWeight: params.lightPalette.saturationWeight,
  });
  if (resolvedLight.skip) return null;
  const poolSy = sy - (light.poolHeightOffsetUnits ?? 0) * params.elevPx * params.worldScale;
  const flickerPhase = (Math.sin(light.worldX * 0.013 + light.worldY * 0.007) * 43758.5453) % (Math.PI * 2);

  const projected: ProjectedLight = {
    sx,
    sy,
    poolSy,
    lightZ: projectedZ,
    radiusPx: light.radiusPx * params.worldScale,
    intensity: resolvedLight.intensity,
    occlusion: isStreetLamp && params.streetLampOcclusionEnabled ? 1 : 0,
    shape: light.shape ?? "RADIAL",
    color: resolvedLight.color,
    tintStrength: light.tintStrength ?? 0.35,
    flicker: light.flicker ?? { kind: "NONE" },
    flickerPhase,
    pool: light.pool
      ? { radiusPx: light.pool.radiusPx * params.worldScale, yScale: light.pool.yScale ?? 1 }
      : undefined,
    cone: light.cone
      ? { dirRad: light.cone.dirRad, angleRad: light.cone.angleRad, lengthPx: light.cone.lengthPx * params.worldScale }
      : undefined,
  };

  return {
    id: light.id || `map:${params.mapId}:light:${index}`,
    anchorTx: ltx,
    anchorTy: lty,
    anchorZ,
    projected,
    source: "MAP_STATIC",
  };
}

function appendRuntimeBeamRecords(
  out: FrameWorldLightRecord[],
  params: BuildFrameWorldLightRegistryParams,
  beam: RuntimeBeamLightConfig,
): void {
  if (!beam.active) return;
  const dx = beam.endWorldX - beam.startWorldX;
  const dy = beam.endWorldY - beam.startWorldY;
  const len = Math.hypot(dx, dy);
  if (len <= 1) return;

  const sampleCount = Math.max(3, Math.min(8, Math.ceil(len / 100)));
  const beamZ = Math.floor(beam.zVisual + 1e-3);
  const beamRadius = Math.max(18, Math.max(1, beam.widthPx) * 6 * params.worldScale);
  for (let i = 0; i < sampleCount; i++) {
    const t = sampleCount <= 1 ? 0 : i / (sampleCount - 1);
    const worldX = beam.startWorldX + dx * t;
    const worldY = beam.startWorldY + dy * t;
    const tx = Math.floor(worldX / params.tileWorld);
    const ty = Math.floor(worldY / params.tileWorld);
    if (!params.isTileInRenderRadius(tx, ty)) continue;
    const pos = params.projectToScreen(worldX, worldY, beam.zVisual * params.elevPx);
    const projected: ProjectedLight = {
      sx: pos.x,
      sy: pos.y,
      lightZ: beamZ,
      radiusPx: beamRadius,
      intensity: Math.max(0.05, 0.12 * Math.max(0, beam.glowIntensity)),
      occlusion: 0,
      shape: "RADIAL",
      color: "#ff5f5f",
      tintStrength: 0.20,
      flicker: { kind: "PULSE", speed: 2.8, amount: 0.08 },
      flickerPhase: t * Math.PI,
    };
    out.push({
      id: `runtime:beam:${i}`,
      anchorTx: tx,
      anchorTy: ty,
      anchorZ: beamZ,
      projected,
      source: "RUNTIME_BEAM",
    });
  }
}

export function toWorldLightRenderPiece(light: FrameWorldLightRecord): WorldLightRenderPiece {
  return {
    kind: "LIGHT",
    source: light.source,
    stableId: stableIdFromString(light.id),
    slice: light.anchorTx + light.anchorTy,
    within: light.anchorTx,
    baseZ: light.anchorZ,
    light,
  };
}

export function buildFrameWorldLightRegistry(
  params: BuildFrameWorldLightRegistryParams,
): FrameWorldLightRegistry {
  const lights: FrameWorldLightRecord[] = [];
  for (let i = 0; i < params.staticLights.length; i++) {
    const record = buildStaticLightRecord(params.staticLights[i], i, params);
    if (!record) continue;
    lights.push(record);
  }
  if (params.runtimeBeam) appendRuntimeBeamRecords(lights, params, params.runtimeBeam);

  const renderPieces: WorldLightRenderPiece[] = lights.map(toWorldLightRenderPiece);
  const projectedLights: ProjectedLight[] = lights.map((light) => light.projected);
  const lightsByHeight = new Map<number, number>();
  for (let i = 0; i < projectedLights.length; i++) {
    const z = projectedLights[i].lightZ ?? 0;
    lightsByHeight.set(z, (lightsByHeight.get(z) ?? 0) + 1);
  }
  return { lights, renderPieces, projectedLights, lightsByHeight };
}
