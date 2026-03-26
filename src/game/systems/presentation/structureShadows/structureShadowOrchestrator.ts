import type { ShadowV6SemanticBucket } from "../../../../settings/settingsTypes";
import type {
  RuntimeStructureTrianglePiece,
  RuntimeStructureTriangleSemanticClass,
} from "../../../structures/monolithicStructureGeometry";
import { buildStructureV6SemanticTriangles } from "./structureShadowV6Semantics";
import type {
  StructureShadowFrameResult,
  StructureShadowOverlayQueueResult,
  StructureV6ShadowDebugCandidate,
} from "./structureShadowTypes";
import { shouldBuildStructureV6ShadowMasksForFrame } from "./structureShadowVersionRouting";

export type BuildStructureShadowFrameResultInput = {
  frame: StructureShadowFrameResult;
  structureInstanceId: string;
  geometrySignature: string;
  sourceImage: CanvasImageSource;
  draw: {
    dw: number;
    dh: number;
  };
  admittedTrianglesForSemanticMasks: readonly RuntimeStructureTrianglePiece[];
  semanticByStableId: ReadonlyMap<number, RuntimeStructureTriangleSemanticClass>;
  structureShadowBand: number;
  v6PrimarySemanticBucket: ShadowV6SemanticBucket;
  v6SecondarySemanticBucket: ShadowV6SemanticBucket;
  v6TopSemanticBucket: ShadowV6SemanticBucket;
};

export function buildStructureShadowFrameResult(
  input: BuildStructureShadowFrameResultInput,
): StructureShadowOverlayQueueResult {
  if (!shouldBuildStructureV6ShadowMasksForFrame(input.frame) || !input.frame.sunModel.castsShadows) {
    return {
      structureShadowBand: input.structureShadowBand,
      v6Candidate: null,
    };
  }

  const triangles = buildStructureV6SemanticTriangles(
    input.admittedTrianglesForSemanticMasks,
    input.semanticByStableId,
  )
    .filter((triangle) => (
      triangle.semanticBucket === input.v6PrimarySemanticBucket
      || triangle.semanticBucket === input.v6SecondarySemanticBucket
      || triangle.semanticBucket === input.v6TopSemanticBucket
    ));

  const v6Candidate: StructureV6ShadowDebugCandidate | null = triangles.length > 0
    ? {
        structureInstanceId: input.structureInstanceId,
        geometrySignature: input.geometrySignature,
        sourceImage: input.sourceImage,
        sourceImageWidth: Math.max(1, Math.round(input.draw.dw)),
        sourceImageHeight: Math.max(1, Math.round(input.draw.dh)),
        triangles,
        zBand: input.structureShadowBand,
      }
    : null;

  return {
    structureShadowBand: input.structureShadowBand,
    v6Candidate,
  };
}

export type BuildStructureV6VerticalShadowFrameResultInput<TVerticalDebugData> = {
  frame: StructureShadowFrameResult;
  candidates: readonly StructureV6ShadowDebugCandidate[];
  primarySemanticBucket: ShadowV6SemanticBucket;
  requestedSemanticBucket: ShadowV6SemanticBucket;
  requestedStructureIndex: number;
  requestedSliceCount: number;
  shadowLengthPx: number;
  countCandidateTrianglesForBucket: (
    candidate: StructureV6ShadowDebugCandidate,
    bucket: ShadowV6SemanticBucket,
  ) => number;
  resolveSelectedCandidateIndex: (candidateCount: number, requestedIndex: number) => number;
  buildVerticalDebugData: (
    candidate: StructureV6ShadowDebugCandidate,
    requestedSemanticBucket: ShadowV6SemanticBucket,
    requestedStructureIndex: number,
    selectedStructureIndex: number,
    candidateCount: number,
    requestedSliceCount: number,
    shadowVector: { x: number; y: number },
  ) => TVerticalDebugData | null;
};

export type BuildStructureV6VerticalShadowFrameResults<TVerticalDebugData> = {
  selectedStructureIndex: number;
  orderedCandidateCount: number;
  shadowVector: { x: number; y: number };
  selected: TVerticalDebugData | null;
  all: readonly TVerticalDebugData[];
};

export function buildStructureV6VerticalShadowFrameResults<TVerticalDebugData>(
  input: BuildStructureV6VerticalShadowFrameResultInput<TVerticalDebugData>,
): BuildStructureV6VerticalShadowFrameResults<TVerticalDebugData> {
  const emptyResult: BuildStructureV6VerticalShadowFrameResults<TVerticalDebugData> = {
    selectedStructureIndex: -1,
    orderedCandidateCount: 0,
    shadowVector: { x: 0, y: 0 },
    selected: null,
    all: [],
  };
  if (
    !shouldBuildStructureV6ShadowMasksForFrame(input.frame)
    || !input.frame.sunModel.castsShadows
    || input.candidates.length <= 0
  ) {
    return emptyResult;
  }

  const shadowVector = {
    x: input.frame.sunModel.projectionDirection.x * input.shadowLengthPx,
    y: input.frame.sunModel.projectionDirection.y * input.shadowLengthPx,
  };

  const orderedCandidates = input.candidates
    .slice()
    .sort((a, b) => {
      const byId = a.structureInstanceId.localeCompare(b.structureInstanceId);
      if (byId !== 0) return byId;
      return (
        input.countCandidateTrianglesForBucket(b, input.primarySemanticBucket)
        - input.countCandidateTrianglesForBucket(a, input.primarySemanticBucket)
      );
    });

  const selectedStructureIndex = input.resolveSelectedCandidateIndex(
    orderedCandidates.length,
    input.requestedStructureIndex,
  );
  let selected: TVerticalDebugData | null = null;
  const all: TVerticalDebugData[] = [];
  for (let i = 0; i < orderedCandidates.length; i++) {
    const built = input.buildVerticalDebugData(
      orderedCandidates[i],
      input.requestedSemanticBucket,
      input.requestedStructureIndex,
      i,
      orderedCandidates.length,
      input.requestedSliceCount,
      shadowVector,
    );
    if (!built) continue;
    all.push(built);
    if (i === selectedStructureIndex) selected = built;
  }

  return {
    selectedStructureIndex,
    orderedCandidateCount: orderedCandidates.length,
    shadowVector,
    selected,
    all,
  };
}
