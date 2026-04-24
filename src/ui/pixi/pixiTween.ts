// Lightweight frame-based tween manager driven by Pixi ticker delta-time.

export type EasingFn = (t: number) => number;

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
