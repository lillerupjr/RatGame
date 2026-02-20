export type PaletteSwapState = {
  currentPaletteId: string;
  lastReadyPaletteId: string;
};

export function createPaletteSwapState(initialPaletteId: string): PaletteSwapState {
  return {
    currentPaletteId: initialPaletteId,
    lastReadyPaletteId: initialPaletteId,
  };
}

export function notePaletteRequested(state: PaletteSwapState, paletteId: string): void {
  state.currentPaletteId = paletteId;
}

export function notePaletteReady(state: PaletteSwapState, paletteId: string): void {
  state.lastReadyPaletteId = paletteId;
}
