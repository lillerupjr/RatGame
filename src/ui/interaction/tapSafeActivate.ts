const DEFAULT_SUPPRESS_CLICK_WINDOW_MS = 450;
const DEFAULT_SUPPRESS_CLICK_RADIUS_PX = 40;

type TapSafeActivatorOptions = {
  isBlockedNow?: () => boolean;
  now?: () => number;
  suppressClickWindowMs?: number;
  suppressClickRadiusPx?: number;
};

function isPrimaryPointerButton(ev: PointerEvent): boolean {
  const btn = typeof ev.button === "number" ? ev.button : 0;
  return btn === 0 || btn === -1;
}

export function createTapSafeActivator(options: TapSafeActivatorOptions = {}): {
  bindActivate: (el: HTMLElement, action: () => void) => void;
} {
  const now = options.now ?? (() => Date.now());
  const suppressClickWindowMs = options.suppressClickWindowMs ?? DEFAULT_SUPPRESS_CLICK_WINDOW_MS;
  const suppressClickRadiusPx = options.suppressClickRadiusPx ?? DEFAULT_SUPPRESS_CLICK_RADIUS_PX;

  let suppressClickUntilMs = 0;
  let suppressClickX = 0;
  let suppressClickY = 0;

  const isBlockedNow = (): boolean => options.isBlockedNow?.() ?? false;

  const armCrossControlClickSuppression = (clientX: number, clientY: number): void => {
    suppressClickUntilMs = now() + suppressClickWindowMs;
    suppressClickX = Number.isFinite(clientX) ? clientX : 0;
    suppressClickY = Number.isFinite(clientY) ? clientY : 0;
  };

  const shouldSuppressSyntheticClick = (ev: Event): boolean => {
    if (now() > suppressClickUntilMs) return false;
    const mev = ev as MouseEvent;
    const hasCoords = Number.isFinite(mev.clientX) && Number.isFinite(mev.clientY);
    if (hasCoords) {
      const dx = mev.clientX - suppressClickX;
      const dy = mev.clientY - suppressClickY;
      if (dx * dx + dy * dy > suppressClickRadiusPx * suppressClickRadiusPx) return false;
    }
    suppressClickUntilMs = 0;
    return true;
  };

  const bindActivate = (el: HTMLElement, action: () => void): void => {
    let activePointerId: number | null = null;
    let downTarget: EventTarget | null = null;

    el.addEventListener("pointerdown", (ev) => {
      const pev = ev as PointerEvent;
      if (!isPrimaryPointerButton(pev)) return;
      if (isBlockedNow()) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      activePointerId = pev.pointerId;
      downTarget = pev.target;
    });

    el.addEventListener("pointerup", (ev) => {
      const pev = ev as PointerEvent;
      if (activePointerId !== pev.pointerId) return;
      const target = pev.target as Node | null;
      const sameElementInteraction = !!target && el.contains(target);
      const validDownTarget = downTarget ? el.contains(downTarget as Node) : true;
      activePointerId = null;
      downTarget = null;
      if (!sameElementInteraction || !validDownTarget) return;
      ev.preventDefault();
      if (isBlockedNow()) {
        armCrossControlClickSuppression(pev.clientX, pev.clientY);
        ev.stopPropagation();
        return;
      }
      action();
      armCrossControlClickSuppression(pev.clientX, pev.clientY);
    });

    el.addEventListener("pointercancel", (ev) => {
      const pev = ev as PointerEvent;
      if (activePointerId !== pev.pointerId) return;
      activePointerId = null;
      downTarget = null;
    });

    el.addEventListener("lostpointercapture", (ev) => {
      const pev = ev as PointerEvent;
      if (activePointerId !== pev.pointerId) return;
      activePointerId = null;
      downTarget = null;
    });

    el.addEventListener("click", (ev) => {
      if (isBlockedNow() || shouldSuppressSyntheticClick(ev)) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      action();
    });
  };

  return { bindActivate };
}
