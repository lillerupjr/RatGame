// Lightweight frame-based tween manager driven by Pixi ticker delta-time.

export type EasingFn = (t: number) => number;

// Attempt to evaluate a cubic-bezier curve at parameter t.
// Numerically solves for the t parameter on the X curve, then evaluates Y.
function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Newton-Raphson to find the bezier t for the given x
    let bt = t;
    for (let i = 0; i < 8; i++) {
      const bx = 3 * (1 - bt) * (1 - bt) * bt * x1 + 3 * (1 - bt) * bt * bt * x2 + bt * bt * bt;
      const dx = 3 * (1 - bt) * (1 - bt) * x1 + 6 * (1 - bt) * bt * (x2 - x1) + 3 * bt * bt * (1 - x2);
      if (Math.abs(dx) < 1e-7) break;
      bt -= (bx - t) / dx;
      bt = Math.max(0, Math.min(1, bt));
    }
    return 3 * (1 - bt) * (1 - bt) * bt * y1 + 3 * (1 - bt) * bt * bt * y2 + bt * bt * bt;
  };
}

export const Easing = {
  linear: (t: number) => t,
  cubicOut: (t: number) => 1 - (1 - t) ** 3,
  cubicInOut: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
  springOut: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  /** cubic-bezier(0.22, 1, 0.36, 1) — top bar, drawer, stats rail, hands shift */
  decelerate: cubicBezier(0.22, 1, 0.36, 1),
  /** cubic-bezier(0.16, 1, 0.3, 1) — hands entrance */
  decelerateStrong: cubicBezier(0.16, 1, 0.3, 1),
} as const;

type TweenTarget = Record<string, number>;

interface ActiveTween {
  target: any;
  startValues: TweenTarget;
  endValues: TweenTarget;
  elapsed: number;
  duration: number;
  easing: EasingFn;
  resolve: () => void;
}

const activeTweens: ActiveTween[] = [];

export function tweenTo(
  target: any,
  props: TweenTarget,
  duration: number,
  easing: EasingFn = Easing.cubicOut,
): Promise<void> {
  // Cancel any existing tween on the same target for the same properties
  for (let i = activeTweens.length - 1; i >= 0; i--) {
    const existing = activeTweens[i];
    if (existing.target !== target) continue;
    const overlap = Object.keys(props).some((k) => k in existing.endValues);
    if (overlap) {
      existing.resolve();
      activeTweens.splice(i, 1);
    }
  }

  const startValues: TweenTarget = {};
  for (const key of Object.keys(props)) {
    startValues[key] = typeof target[key] === "number" ? target[key] : 0;
  }

  return new Promise<void>((resolve) => {
    if (duration <= 0) {
      for (const [key, val] of Object.entries(props)) {
        target[key] = val;
      }
      resolve();
      return;
    }
    activeTweens.push({
      target,
      startValues,
      endValues: { ...props },
      elapsed: 0,
      duration,
      easing,
      resolve,
    });
  });
}

/** Call once per frame with elapsed ms since last frame. */
export function updateTweens(dtMs: number): void {
  for (let i = activeTweens.length - 1; i >= 0; i--) {
    const tw = activeTweens[i];
    tw.elapsed += dtMs;
    const raw = Math.min(tw.elapsed / tw.duration, 1);
    const t = tw.easing(raw);

    for (const key of Object.keys(tw.endValues)) {
      const start = tw.startValues[key];
      const end = tw.endValues[key];
      tw.target[key] = start + (end - start) * t;
    }

    if (raw >= 1) {
      tw.resolve();
      activeTweens.splice(i, 1);
    }
  }
}

export function cancelTweensOf(target: any): void {
  for (let i = activeTweens.length - 1; i >= 0; i--) {
    if (activeTweens[i].target === target) {
      activeTweens[i].resolve();
      activeTweens.splice(i, 1);
    }
  }
}

export function cancelAllTweens(): void {
  for (const tw of activeTweens) tw.resolve();
  activeTweens.length = 0;
}
