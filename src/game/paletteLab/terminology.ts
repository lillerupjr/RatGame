export interface PaletteSnapshotMetadata {
  id: string;
  version: number;
  createdAt: number;
  name: string;
}

export interface PaletteSnapshotSceneContext {
  mapId: string;
  biomeId?: string;
  seed?: number;
}

export interface PaletteSnapshotCameraState {
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
}

/**
 * Snapshot state is intentionally visual-only and does not represent a full gameplay save.
 */
export type PaletteSnapshotWorldState = Record<string, unknown>;

export interface PaletteSnapshotArtifact {
  metadata: PaletteSnapshotMetadata;
  sceneContext: PaletteSnapshotSceneContext;
  cameraState: PaletteSnapshotCameraState;
  worldState: PaletteSnapshotWorldState;
  thumbnail: Blob;
}

/**
 * Palette Lab is the main-menu workflow for browsing snapshots and running comparisons.
 */
export interface PaletteLabSnapshotEntry {
  snapshotId: string;
  snapshotName: string;
  createdAt: number;
  mapId: string;
  biomeId?: string;
}
