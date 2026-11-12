import { afterEach, describe, expect, it } from "vitest";
import type { Stroke } from "./engine";
import { loadSessions, loadSettings, saveSession, saveSettings } from "./storage";
import type { Summary } from "./summary";

const store = new Map<string, string>();

function installMemory() {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
}

const emptySummary: Summary = {
  totalInputs: 1,
  simultaneous: { count: 0, ratio: 0, examples: [] },
  remiss: { count: 0, ratio: 0, examples: [] },
  romaji: {
    count: 0,
    ratio: 0,
    examples: [],
    swap: { count: 0, ratio: 0, examples: [] },
    youon: { count: 0, ratio: 0, examples: [] },
    nn: { count: 0, ratio: 0, examples: [] },
  },
};

describe("local storage", () => {
  afterEach(() => {
    store.clear();
  });

  it("keeps settings and sessions in localStorage only", () => {
    installMemory();
    saveSettings({ layoutId: "oonishi", keymapOn: false, lang: "en" });
    expect(loadSettings()).toEqual({ layoutId: "oonishi", keymapOn: false, lang: "en" });
    const stroke: Stroke = {
      id: 1,
      code: "KeyA",
      key: "a",
      downTime: 0,
      upTime: 10,
      expected: "a",
      result: "correct",
    };
    saveSession({
      at: 1,
      promptId: "en-pack",
      layoutId: "qwerty",
      keymapOn: true,
      summary: emptySummary,
      strokes: [stroke],
    });
    expect(loadSessions()).toHaveLength(1);
    expect(loadSessions()[0]?.strokes[0]?.code).toBe("KeyA");
    const dumped = [...store.values()].join("\n");
    expect(dumped).not.toMatch(/https?:\/\//);
  });
});
