import { getActiveMap as getActiveCompiledMap } from "../../../map/compile/kenneyMap";
import {
  type StaticRelightDarknessBucket,
  type StaticRelightLightCandidate,
} from "../staticRelightPoc";

export type StaticRelightFrameContext = {
  baseDarknessBucket: StaticRelightDarknessBucket;
  targetDarknessBucket: 0 | 25 | 50 | 75;
  strengthScale: number;
  lights: StaticRelightLightCandidate[];
  maxLights: number;
  tileInfluenceRadius: number;
  minBlendAlpha: number;
};

export type StaticRelightRuntimeState = {
  compiledMap: ReturnType<typeof getActiveCompiledMap>;
  enabled: boolean;
  frame: StaticRelightFrameContext | null;
  relightLights: StaticRelightLightCandidate[];
  contextKey: string;
  targetDarknessBucket: 0 | 25 | 50 | 75;
  baseDarknessBucket: StaticRelightDarknessBucket;
  strengthScale: number;
};

export type StaticGroundRelightBakeResult = {
  needsRetry: boolean;
  requiredKeyCount: number;
  readyCount: number;
  pendingCount: number;
  failedCount: number;
  pendingKeys: string[];
};

export type StaticRelightBakeDependencyTracker = {
  required: Set<string>;
  ready: Set<string>;
  pending: Set<string>;
  failed: Set<string>;
  pendingSample: string[];
};
