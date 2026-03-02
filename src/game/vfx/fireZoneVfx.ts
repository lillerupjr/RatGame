import type { LoadedImg } from "../../engine/render/sprites/renderSprites";

// --- Types ---

export type FireZoneEmber = {
  nx: number;     // normalized [-1..1] ellipse space
  ny: number;
  phaseT: number; // animation phase offset (seconds)
  scale: number;  // per-ember scale
  alpha: number;  // per-ember alpha multiplier
};

export type FireZoneVfx = {
  x: number;      // world center
  y: number;
  rx: number;     // world-space radius (pre-iso)
  ry: number;
  t: number;      // elapsed seconds
  ttl: number;    // duration
  pulseHz: number;
  pulseAmp: number;
  baseGlowAlpha: number;
  embers: FireZoneEmber[];
  frames: string[];
  fps: number;
  frameCount: number;
};

// --- Constants ---

const EMBER_FPS = 12;
const EMBER_FRAME_COUNT = 16;

function buildEmberFrames(): string[] {
  const out: string[] = [];
  for (let i = 1; i <= EMBER_FRAME_COUNT; i++)
    out.push(`vfx/status/burning_1/1_frame_${String(i).padStart(2, "0")}`);
  return out;
}

const EMBER_FRAMES = buildEmberFrames();

// --- Helpers ---

function sampleUniformDisk(rand: () => number): { nx: number; ny: number } {
  const r = Math.sqrt(rand());
  const angle = rand() * Math.PI * 2;
  return { nx: r * Math.cos(angle), ny: r * Math.sin(angle) };
}

function computeEmberCount(radius: number): number {
  return Math.min(32, Math.max(10, Math.round(6 + radius * 0.14)));
}

// --- Spawn ---

export function spawnFireZoneVfx(args: {
  x: number;
  y: number;
  radius: number;
  duration: number;
  rand: () => number;
}): FireZoneVfx {
  const { x, y, radius, duration, rand } = args;
  const count = computeEmberCount(radius);
  const embers: FireZoneEmber[] = [];

  for (let i = 0; i < count; i++) {
    const { nx, ny } = sampleUniformDisk(rand);
    embers.push({
      nx,
      ny,
      phaseT: rand() * 10,
      scale: 0.75 + rand() * 0.55,
      alpha: 0.65 + rand() * 0.35,
    });
  }

  return {
    x,
    y,
    rx: radius,
    ry: radius,
    t: 0,
    ttl: duration,
    pulseHz: 0.8,
    pulseAmp: 0.18,
    baseGlowAlpha: 0.20,
    embers,
    frames: EMBER_FRAMES,
    fps: EMBER_FPS,
    frameCount: EMBER_FRAME_COUNT,
  };
}

// --- Update ---

export function updateFireZoneVfx(z: FireZoneVfx, dt: number): boolean {
  z.t += dt;
  return z.t < z.ttl;
}

// --- Render ---

export function renderFireZoneVfx(
  ctx: CanvasRenderingContext2D,
  z: FireZoneVfx,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  getSpriteById: (id: string) => LoadedImg,
  isoX: number,
  isoY: number,
) {
  const cx = z.x;
  const cy = z.y;
  const screenCenter = toScreen(cx, cy);
  const srx = z.rx * isoX;
  const sry = z.ry * isoY;

  // --- Pulsing radial-gradient glow ---
  const pulse = Math.sin(z.t * Math.PI * 2 * z.pulseHz);
  const glowAlpha = z.baseGlowAlpha + z.pulseAmp * pulse;

  ctx.save();
  ctx.translate(screenCenter.x, screenCenter.y);
  ctx.scale(1, sry / srx);

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, srx);
  grad.addColorStop(0, `rgba(255, 120, 30, ${glowAlpha})`);
  grad.addColorStop(0.55, `rgba(255, 60, 10, ${glowAlpha * 0.5})`);
  grad.addColorStop(1, "rgba(255, 40, 0, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, srx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Embers ---
  const embers = z.embers;
  for (let i = 0; i < embers.length; i++) {
    const e = embers[i];
    const wx = cx + e.nx * z.rx;
    const wy = cy + e.ny * z.ry;
    const sp = toScreen(wx, wy);

    const frameF = (z.t + e.phaseT) * z.fps;
    const frameIdx = ((frameF | 0) % z.frameCount + z.frameCount) % z.frameCount;
    const sprite = getSpriteById(z.frames[frameIdx]);
    if (!sprite.ready) continue;

    const img = sprite.img;
    const w = img.naturalWidth * e.scale;
    const h = img.naturalHeight * e.scale;

    ctx.globalAlpha = e.alpha;
    ctx.drawImage(img, sp.x - w * 0.5, sp.y - h * 0.5, w, h);
  }
  ctx.globalAlpha = 1;
}
