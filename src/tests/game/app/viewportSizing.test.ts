import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { installStandaloneViewportFix } from "../../../game/app/viewportSizing";
import { isStandalonePwa } from "../../../game/app/pwa";

vi.mock("../../../game/app/pwa", () => ({
  isStandalonePwa: vi.fn(),
}));

type Listener = EventListenerOrEventListenerObject;

type EventTargetStub = {
  addEventListener: (type: string, listener: Listener) => void;
  removeEventListener: (type: string, listener: Listener) => void;
  dispatchEvent: (event: { type: string }) => boolean;
};

type StyleStub = {
  setProperty: (name: string, value: string) => void;
  removeProperty: (name: string) => void;
  getPropertyValue: (name: string) => string;
};

type ClassListStub = {
  add: (...tokens: string[]) => void;
  remove: (...tokens: string[]) => void;
  contains: (token: string) => boolean;
};

type VisualViewportStub = EventTargetStub & {
  width: number;
  height: number;
  emit: (type: string) => void;
};

type DocumentStub = EventTargetStub & {
  documentElement: {
    style: StyleStub;
    classList: ClassListStub;
  };
  visibilityState: DocumentVisibilityState;
};

type WindowStub = EventTargetStub & {
  navigator: {
    userAgent: string;
    platform: string;
    maxTouchPoints: number;
  };
  innerWidth: number;
  innerHeight: number;
  visualViewport?: VisualViewportStub;
  requestAnimationFrame: (cb: FrameRequestCallback) => number;
  cancelAnimationFrame: (id: number) => void;
};

const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15";

const mockedIsStandalonePwa = vi.mocked(isStandalonePwa);
const previousWindow = (globalThis as any).window;
const previousDocument = (globalThis as any).document;

function createEventTargetStub(): EventTargetStub {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener: (type, listener) => {
      const set = listeners.get(type) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type, listener) => {
      const set = listeners.get(type);
      if (!set) return;
      set.delete(listener);
    },
    dispatchEvent: (event) => {
      const set = listeners.get(event.type);
      if (!set) return true;
      for (const listener of set) {
        if (typeof listener === "function") {
          listener(event as Event);
        } else {
          listener.handleEvent(event as Event);
        }
      }
      return true;
    },
  };
}

function createStyleStub(): StyleStub {
  const props = new Map<string, string>();
  return {
    setProperty: (name, value) => {
      props.set(name, value);
    },
    removeProperty: (name) => {
      props.delete(name);
    },
    getPropertyValue: (name) => props.get(name) ?? "",
  };
}

function createClassListStub(): ClassListStub {
  const tokens = new Set<string>();
  return {
    add: (...next) => {
      for (let i = 0; i < next.length; i++) tokens.add(next[i]);
    },
    remove: (...next) => {
      for (let i = 0; i < next.length; i++) tokens.delete(next[i]);
    },
    contains: (token) => tokens.has(token),
  };
}

function createVisualViewportStub(width: number, height: number): VisualViewportStub {
  const target = createEventTargetStub();
  return {
    ...target,
    width,
    height,
    emit: (type) => {
      target.dispatchEvent({ type });
    },
  };
}

function createDocumentStub(style: StyleStub, classList: ClassListStub): DocumentStub {
  const target = createEventTargetStub();
  return {
    ...target,
    documentElement: {
      style,
      classList,
    },
    visibilityState: "visible",
  };
}

function createWindowStub(visualViewport?: VisualViewportStub): WindowStub {
  const target = createEventTargetStub();
  return {
    ...target,
    navigator: {
      userAgent: IOS_UA,
      platform: "iPhone",
      maxTouchPoints: 5,
    },
    innerWidth: 390,
    innerHeight: 844,
    visualViewport,
    requestAnimationFrame: (cb) => {
      cb(0);
      return 1;
    },
    cancelAnimationFrame: () => {},
  };
}

describe("installStandaloneViewportFix", () => {
  let style: StyleStub;
  let classList: ClassListStub;
  let documentStub: DocumentStub;
  let windowStub: WindowStub;

  beforeEach(() => {
    mockedIsStandalonePwa.mockReset();
    mockedIsStandalonePwa.mockReturnValue(true);

    style = createStyleStub();
    classList = createClassListStub();
    documentStub = createDocumentStub(style, classList);
    windowStub = createWindowStub();

    (globalThis as any).window = windowStub;
    (globalThis as any).document = documentStub;
  });

  afterEach(() => {
    if (previousWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = previousWindow;
    }
    if (previousDocument === undefined) {
      delete (globalThis as any).document;
    } else {
      (globalThis as any).document = previousDocument;
    }
  });

  test("applies only when standalone and iOS", () => {
    mockedIsStandalonePwa.mockReturnValue(false);
    const cleanupNotStandalone = installStandaloneViewportFix();
    expect(classList.contains("ios-standalone-fix")).toBe(false);
    cleanupNotStandalone();

    mockedIsStandalonePwa.mockReturnValue(true);
    windowStub.navigator.userAgent = DESKTOP_UA;
    windowStub.navigator.platform = "MacIntel";
    windowStub.navigator.maxTouchPoints = 0;
    const cleanupNotIos = installStandaloneViewportFix();
    expect(classList.contains("ios-standalone-fix")).toBe(false);
    cleanupNotIos();
  });

  test("uses visualViewport dimensions when available", () => {
    const viewport = createVisualViewportStub(321, 654);
    windowStub.visualViewport = viewport;
    (globalThis as any).window = windowStub;

    const cleanup = installStandaloneViewportFix();

    expect(classList.contains("ios-standalone-fix")).toBe(true);
    expect(style.getPropertyValue("--app-vw")).toBe("321px");
    expect(style.getPropertyValue("--app-vh")).toBe("654px");

    cleanup();
  });

  test("falls back to inner dimensions without visualViewport", () => {
    windowStub.visualViewport = undefined;
    windowStub.innerWidth = 412;
    windowStub.innerHeight = 915;
    (globalThis as any).window = windowStub;

    const cleanup = installStandaloneViewportFix();

    expect(style.getPropertyValue("--app-vw")).toBe("412px");
    expect(style.getPropertyValue("--app-vh")).toBe("915px");

    cleanup();
  });

  test("updates dimensions on resize/orientation/pageshow/visibility and visualViewport events", () => {
    const viewport = createVisualViewportStub(300, 500);
    windowStub.visualViewport = viewport;
    (globalThis as any).window = windowStub;
    const cleanup = installStandaloneViewportFix();

    viewport.width = 320;
    viewport.height = 520;
    windowStub.dispatchEvent({ type: "resize" });
    expect(style.getPropertyValue("--app-vw")).toBe("320px");
    expect(style.getPropertyValue("--app-vh")).toBe("520px");

    viewport.width = 330;
    viewport.height = 530;
    windowStub.dispatchEvent({ type: "orientationchange" });
    expect(style.getPropertyValue("--app-vw")).toBe("330px");
    expect(style.getPropertyValue("--app-vh")).toBe("530px");

    viewport.width = 340;
    viewport.height = 540;
    windowStub.dispatchEvent({ type: "pageshow" });
    expect(style.getPropertyValue("--app-vw")).toBe("340px");
    expect(style.getPropertyValue("--app-vh")).toBe("540px");

    viewport.width = 350;
    viewport.height = 550;
    viewport.emit("resize");
    expect(style.getPropertyValue("--app-vw")).toBe("350px");
    expect(style.getPropertyValue("--app-vh")).toBe("550px");

    viewport.width = 360;
    viewport.height = 560;
    viewport.emit("scroll");
    expect(style.getPropertyValue("--app-vw")).toBe("360px");
    expect(style.getPropertyValue("--app-vh")).toBe("560px");

    documentStub.visibilityState = "hidden";
    viewport.width = 370;
    viewport.height = 570;
    documentStub.dispatchEvent({ type: "visibilitychange" });
    expect(style.getPropertyValue("--app-vw")).toBe("360px");
    expect(style.getPropertyValue("--app-vh")).toBe("560px");

    documentStub.visibilityState = "visible";
    documentStub.dispatchEvent({ type: "visibilitychange" });
    expect(style.getPropertyValue("--app-vw")).toBe("370px");
    expect(style.getPropertyValue("--app-vh")).toBe("570px");

    cleanup();
  });

  test("cleanup removes listeners and styles", () => {
    const viewport = createVisualViewportStub(320, 510);
    windowStub.visualViewport = viewport;
    (globalThis as any).window = windowStub;
    const cleanup = installStandaloneViewportFix();

    cleanup();
    expect(classList.contains("ios-standalone-fix")).toBe(false);
    expect(style.getPropertyValue("--app-vw")).toBe("");
    expect(style.getPropertyValue("--app-vh")).toBe("");

    viewport.width = 420;
    viewport.height = 620;
    windowStub.dispatchEvent({ type: "resize" });
    viewport.emit("resize");

    expect(style.getPropertyValue("--app-vw")).toBe("");
    expect(style.getPropertyValue("--app-vh")).toBe("");
  });
});
