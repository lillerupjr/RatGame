# DB32 Phase 3.5 — Cyberpunk Palette + Chinatown Mapping

Adds a new `cyberpunk` palette and assigns it to Chinatown map skin.

Map palette mapping:

- avenue -> db32
- docks -> divination
- china_town -> cyberpunk

Cyberpunk palette is designed for neon urban nighttime environments with deep shadows, bright cyan highlights, and magenta-forward contrast.

Palette resolution remains:

1. dev override
2. map skin `paletteId`
3. `db32`

Runtime palette swap still occurs at sprite load time and is prewarmed during floor transitions.
