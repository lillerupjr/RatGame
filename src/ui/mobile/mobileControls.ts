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

export function createMobileControls(args: CreateMobileControlsArgs): MobileControlsController {
  let enabled = false;
  let stickPointerId: number | null = null;
  let interactPointerId: number | null = null;

  const resetStick = () => {
    args.stickBase.classList.remove("isActive");
    args.stickKnob.style.transform = "translate(-50%, -50%)";
    args.onMove(0, 0, false);
  };

  const resetInteract = () => {
    args.interactBtn.classList.remove("isPressed");
    args.onInteractDown(false);
  };

  const stickRadiusPx = () => {
    const baseRect = args.stickBase.getBoundingClientRect();
    const knobRect = args.stickKnob.getBoundingClientRect();
    const available = (Math.min(baseRect.width, baseRect.height) - Math.max(knobRect.width, knobRect.height)) * 0.5;
    return Math.max(1, available);
  };

  const updateStickFromPointer = (ev: PointerEvent) => {
    const baseRect = args.stickBase.getBoundingClientRect();
    const centerX = baseRect.left + baseRect.width * 0.5;
    const centerY = baseRect.top + baseRect.height * 0.5;
    const rawDx = ev.clientX - centerX;
    const rawDy = ev.clientY - centerY;
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
    if (stickPointerId !== null) return;
    stickPointerId = ev.pointerId;
    args.stickBase.classList.add("isActive");
    ev.preventDefault();
    safeSetPointerCapture(args.stickBase, ev.pointerId);
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
    safeReleasePointerCapture(args.stickBase, ev.pointerId);
    stickPointerId = null;
    resetStick();
  };

  const onInteractPointerDown = (ev: PointerEvent) => {
    if (!enabled) return;
    if (interactPointerId !== null) return;
    interactPointerId = ev.pointerId;
    ev.preventDefault();
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

  args.stickBase.addEventListener("pointerdown", onStickPointerDown as EventListener);
  args.stickBase.addEventListener("pointermove", onStickPointerMove as EventListener);
  args.stickBase.addEventListener("pointerup", onStickPointerEnd as EventListener);
  args.stickBase.addEventListener("pointercancel", onStickPointerEnd as EventListener);
  args.stickBase.addEventListener("lostpointercapture", onStickPointerEnd as EventListener);
  args.interactBtn.addEventListener("pointerdown", onInteractPointerDown as EventListener);
  args.interactBtn.addEventListener("pointerup", onInteractPointerEnd as EventListener);
  args.interactBtn.addEventListener("pointercancel", onInteractPointerEnd as EventListener);
  args.interactBtn.addEventListener("lostpointercapture", onInteractPointerEnd as EventListener);

  resetStick();
  resetInteract();
  args.root.hidden = true;

  return {
    setEnabled(nextEnabled: boolean): void {
      enabled = nextEnabled;
      args.root.hidden = !enabled;
      if (!enabled) {
        stickPointerId = null;
        interactPointerId = null;
        resetStick();
        resetInteract();
      }
    },
    destroy(): void {
      args.stickBase.removeEventListener("pointerdown", onStickPointerDown as EventListener);
      args.stickBase.removeEventListener("pointermove", onStickPointerMove as EventListener);
      args.stickBase.removeEventListener("pointerup", onStickPointerEnd as EventListener);
      args.stickBase.removeEventListener("pointercancel", onStickPointerEnd as EventListener);
      args.stickBase.removeEventListener("lostpointercapture", onStickPointerEnd as EventListener);
      args.interactBtn.removeEventListener("pointerdown", onInteractPointerDown as EventListener);
      args.interactBtn.removeEventListener("pointerup", onInteractPointerEnd as EventListener);
      args.interactBtn.removeEventListener("pointercancel", onInteractPointerEnd as EventListener);
      args.interactBtn.removeEventListener("lostpointercapture", onInteractPointerEnd as EventListener);
      stickPointerId = null;
      interactPointerId = null;
      resetStick();
      resetInteract();
      args.root.hidden = true;
    },
  };
}
