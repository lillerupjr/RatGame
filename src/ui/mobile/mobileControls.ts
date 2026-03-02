export type MobileControlsController = {
  setEnabled(enabled: boolean): void;
  destroy(): void;
};

type CreateMobileControlsArgs = {
  root: HTMLDivElement;
  stickBase: HTMLDivElement;
  stickKnob: HTMLDivElement;
  interactBtn: HTMLDivElement;
  onMove(x: number, y: number, active: boolean): void;
  onInteractDown(down: boolean): void;
};

function safeSetPointerCapture(target: HTMLElement, pointerId: number): void {
  const fn = (target as any).setPointerCapture;
  if (typeof fn === "function") fn.call(target, pointerId);
}

function safeReleasePointerCapture(target: HTMLElement, pointerId: number): void {
  const fn = (target as any).releasePointerCapture;
  if (typeof fn === "function") fn.call(target, pointerId);
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function isPrimaryPointerDown(ev: PointerEvent): boolean {
  const btn = typeof ev.button === "number" ? ev.button : 0;
  return btn === 0;
}

export function createMobileControls(args: CreateMobileControlsArgs): MobileControlsController {
  let enabled = false;
  let stickPointerId: number | null = null;
  let interactPointerId: number | null = null;
  let stickBaseCx = 0;
  let stickBaseCy = 0;

  const resetStickVisualAnchor = () => {
    args.stickBase.style.left = "";
    args.stickBase.style.top = "";
    args.stickBase.style.right = "";
    args.stickBase.style.bottom = "";
    args.stickBase.classList.remove("isFloating");
  };

  const clampStickCenterToViewport = (cx: number, cy: number): { cx: number; cy: number } => {
    const baseRect = args.stickBase.getBoundingClientRect();
    const halfW = Math.max(1, baseRect.width * 0.5);
    const halfH = Math.max(1, baseRect.height * 0.5);
    const viewportW =
      typeof window !== "undefined" && Number.isFinite(window.innerWidth)
        ? window.innerWidth
        : baseRect.width;
    const viewportH =
      typeof window !== "undefined" && Number.isFinite(window.innerHeight)
        ? window.innerHeight
        : baseRect.height;
    const minX = halfW;
    const maxX = Math.max(minX, viewportW - halfW);
    const minY = halfH;
    const maxY = Math.max(minY, viewportH - halfH);
    const nx = Math.max(minX, Math.min(maxX, cx));
    const ny = Math.max(minY, Math.min(maxY, cy));
    return { cx: nx, cy: ny };
  };

  const setFloatingStickCenter = (cx: number, cy: number) => {
    const clamped = clampStickCenterToViewport(cx, cy);
    stickBaseCx = clamped.cx;
    stickBaseCy = clamped.cy;
    const baseRect = args.stickBase.getBoundingClientRect();
    const left = Math.round(stickBaseCx - baseRect.width * 0.5);
    const top = Math.round(stickBaseCy - baseRect.height * 0.5);
    args.stickBase.style.left = `${left}px`;
    args.stickBase.style.top = `${top}px`;
    args.stickBase.style.right = "auto";
    args.stickBase.style.bottom = "auto";
    args.stickBase.classList.add("isFloating");
  };

  const resetStick = () => {
    args.stickBase.classList.remove("isActive");
    resetStickVisualAnchor();
    args.stickKnob.style.transform = "translate(-50%, -50%)";
    args.onMove(0, 0, false);
  };

  const resetInteract = () => {
    args.interactBtn.classList.remove("isPressed");
    args.onInteractDown(false);
  };

  const stopStickPointer = () => {
    if (stickPointerId === null) return;
    safeReleasePointerCapture(args.root, stickPointerId);
    stickPointerId = null;
    resetStick();
  };

  const releaseActivePointerCaptures = () => {
    if (stickPointerId !== null) {
      safeReleasePointerCapture(args.root, stickPointerId);
    }
    if (interactPointerId !== null) {
      safeReleasePointerCapture(args.interactBtn, interactPointerId);
    }
  };

  const pointerTargetsInteract = (ev: PointerEvent): boolean => {
    const pathFn = (ev as any).composedPath;
    if (typeof pathFn === "function") {
      const path = pathFn.call(ev);
      if (Array.isArray(path) && path.includes(args.interactBtn)) return true;
    }
    return ev.target === args.interactBtn;
  };

  const onContextMenu = (ev: MouseEvent) => {
    if (!enabled) return;
    ev.preventDefault();
  };

  const stickRadiusPx = () => {
    const baseRect = args.stickBase.getBoundingClientRect();
    const knobRect = args.stickKnob.getBoundingClientRect();
    const available = (Math.min(baseRect.width, baseRect.height) - Math.max(knobRect.width, knobRect.height)) * 0.5;
    return Math.max(1, available);
  };

  const updateStickFromPointer = (ev: PointerEvent) => {
    const rawDx = ev.clientX - stickBaseCx;
    const rawDy = ev.clientY - stickBaseCy;
    const radius = stickRadiusPx();
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(radius, dist);
    const nx = dist > 1e-6 ? rawDx / dist : 0;
    const ny = dist > 1e-6 ? rawDy / dist : 0;
    const knobX = nx * clampedDist;
    const knobY = ny * clampedDist;
    args.stickKnob.style.transform = `translate(calc(-50% + ${Math.round(knobX)}px), calc(-50% + ${Math.round(knobY)}px))`;
    args.onMove(clampUnit(knobX / radius), clampUnit(-knobY / radius), true);
  };

  const onStickPointerDown = (ev: PointerEvent) => {
    if (!enabled) return;
    if (!isPrimaryPointerDown(ev)) {
      ev.preventDefault();
      return;
    }
    if (pointerTargetsInteract(ev)) return;
    if (stickPointerId !== null) return;
    stickPointerId = ev.pointerId;
    setFloatingStickCenter(ev.clientX, ev.clientY);
    args.stickBase.classList.add("isActive");
    ev.preventDefault();
    safeSetPointerCapture(args.root, ev.pointerId);
    updateStickFromPointer(ev);
  };

  const onStickPointerMove = (ev: PointerEvent) => {
    if (!enabled) return;
    if (stickPointerId !== ev.pointerId) return;
    ev.preventDefault();
    updateStickFromPointer(ev);
  };

  const onStickPointerEnd = (ev: PointerEvent) => {
    if (stickPointerId !== ev.pointerId) return;
    safeReleasePointerCapture(args.root, ev.pointerId);
    stickPointerId = null;
    resetStick();
  };

  const onInteractPointerDown = (ev: PointerEvent) => {
    if (!enabled) return;
    if (!isPrimaryPointerDown(ev)) {
      ev.preventDefault();
      return;
    }
    if (interactPointerId !== null) return;
    stopStickPointer();
    interactPointerId = ev.pointerId;
    ev.preventDefault();
    ev.stopPropagation();
    safeSetPointerCapture(args.interactBtn, ev.pointerId);
    args.interactBtn.classList.add("isPressed");
    args.onInteractDown(true);
  };

  const onInteractPointerEnd = (ev: PointerEvent) => {
    if (interactPointerId !== ev.pointerId) return;
    safeReleasePointerCapture(args.interactBtn, ev.pointerId);
    interactPointerId = null;
    resetInteract();
  };

  args.root.addEventListener("pointerdown", onStickPointerDown as EventListener);
  args.root.addEventListener("pointermove", onStickPointerMove as EventListener);
  args.root.addEventListener("pointerup", onStickPointerEnd as EventListener);
  args.root.addEventListener("pointercancel", onStickPointerEnd as EventListener);
  args.root.addEventListener("lostpointercapture", onStickPointerEnd as EventListener);
  args.root.addEventListener("contextmenu", onContextMenu as EventListener);
  args.interactBtn.addEventListener("pointerdown", onInteractPointerDown as EventListener);
  args.interactBtn.addEventListener("pointerup", onInteractPointerEnd as EventListener);
  args.interactBtn.addEventListener("pointercancel", onInteractPointerEnd as EventListener);
  args.interactBtn.addEventListener("lostpointercapture", onInteractPointerEnd as EventListener);
  args.interactBtn.addEventListener("contextmenu", onContextMenu as EventListener);

  resetStick();
  resetInteract();
  args.root.hidden = true;
  args.root.style.display = "none";
  args.root.style.pointerEvents = "none";

  return {
    setEnabled(nextEnabled: boolean): void {
      enabled = nextEnabled;
      args.root.hidden = !enabled;
      args.root.style.display = enabled ? "" : "none";
      args.root.style.pointerEvents = enabled ? "auto" : "none";
      if (!enabled) {
        releaseActivePointerCaptures();
        stickPointerId = null;
        interactPointerId = null;
        resetStick();
        resetInteract();
      }
    },
    destroy(): void {
      args.root.removeEventListener("pointerdown", onStickPointerDown as EventListener);
      args.root.removeEventListener("pointermove", onStickPointerMove as EventListener);
      args.root.removeEventListener("pointerup", onStickPointerEnd as EventListener);
      args.root.removeEventListener("pointercancel", onStickPointerEnd as EventListener);
      args.root.removeEventListener("lostpointercapture", onStickPointerEnd as EventListener);
      args.root.removeEventListener("contextmenu", onContextMenu as EventListener);
      args.interactBtn.removeEventListener("pointerdown", onInteractPointerDown as EventListener);
      args.interactBtn.removeEventListener("pointerup", onInteractPointerEnd as EventListener);
      args.interactBtn.removeEventListener("pointercancel", onInteractPointerEnd as EventListener);
      args.interactBtn.removeEventListener("lostpointercapture", onInteractPointerEnd as EventListener);
      args.interactBtn.removeEventListener("contextmenu", onContextMenu as EventListener);
      releaseActivePointerCaptures();
      stickPointerId = null;
      interactPointerId = null;
      resetStick();
      resetInteract();
      args.root.hidden = true;
      args.root.style.display = "none";
      args.root.style.pointerEvents = "none";
    },
  };
}
