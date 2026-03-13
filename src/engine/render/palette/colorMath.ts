export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clamp255(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, v));
}

export function normalizeHueDegrees(h: number): number {
  if (!Number.isFinite(h)) return 0;
  const wrapped = h % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function hueDistanceDegrees(a: number, b: number): number {
  const ah = normalizeHueDegrees(a);
  const bh = normalizeHueDegrees(b);
  const d = Math.abs(ah - bh);
  return Math.min(d, 360 - d);
}

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
}

export function rgbToHsv(rgb: Rgb): Hsv {
  const r = clamp255(rgb.r) / 255;
  const g = clamp255(rgb.g) / 255;
  const b = clamp255(rgb.b) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h: normalizeHueDegrees(h), s, v };
}

export function hsvToRgb(hsv: Hsv): Rgb {
  const h = normalizeHueDegrees(hsv.h);
  const s = clamp01(hsv.s);
  const v = clamp01(hsv.v);

  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp >= 1 && hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp >= 2 && hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp >= 3 && hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp >= 4 && hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const m = v - c;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}
