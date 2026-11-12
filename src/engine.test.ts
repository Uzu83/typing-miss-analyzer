import { describe, expect, it } from "vitest";
import { isAdjacent } from "./adjacency";
import {
  applyEvent,
  createState,
  findSimultaneous,
  SIMULTANEOUS_MS,
  type EngineState,
  type InputEvent,
  type Task,
} from "./engine";
import { LAYOUTS } from "./layouts";
import { kana, nn, sokuon, youon, type Mora } from "./romaji";
import { summarize } from "./summary";

function english(target: string): Task {
  return { lang: "en", id: "t", title: "t", target };
}

function japanese(morae: Mora[]): Task {
  return { lang: "ja", id: "t", title: "t", morae };
}

type Tap = { code: string; key?: string; down: number; up: number };

function play(task: Task, layout: "qwerty" | "colemak-dh" | "oonishi", keymapOn: boolean, taps: Tap[]): EngineState {
  let state = createState(task, layout, keymapOn);
  const events: InputEvent[] = [];
  for (const tap of taps) {
    const key = tap.key ?? LAYOUTS[layout].map[tap.code] ?? "";
    events.push({ type: "down", code: tap.code, key, time: tap.down });
    events.push({ type: "up", code: tap.code, key, time: tap.up });
  }
  events.sort((a, b) => a.time - b.time || (a.type === "down" ? -1 : 1));
  for (const event of events) state = applyEvent(state, event);
  return state;
}

function backspace(time: number): Tap {
  return { code: "Backspace", key: "Backspace", down: time, up: time + 20 };
}

describe("adjacency", () => {
  it("treats neighbors as adjacent and skips a key between them", () => {
    expect(isAdjacent("KeyF", "KeyD")).toBe(true);
    expect(isAdjacent("KeyA", "KeyQ")).toBe(true);
    expect(isAdjacent("KeyF", "KeyJ")).toBe(false);
    expect(isAdjacent("KeyA", "KeyA")).toBe(false);
  });
});

describe("simultaneous adjacent presses", () => {
  it("counts a correct key and a neighbor inside the threshold", () => {
    const state = play(english("f"), "qwerty", true, [
      { code: "KeyF", down: 0, up: 40 },
      { code: "KeyD", down: SIMULTANEOUS_MS, up: 50 },
    ]);
    expect(findSimultaneous(state.strokes)).toHaveLength(1);
    expect(findSimultaneous(state.strokes)[0]).toMatchObject({ correctKey: "f", extraKey: "d" });
  });

  it("ignores a neighbor just outside the threshold when the presses do not overlap", () => {
    const state = play(english("f"), "qwerty", true, [
      { code: "KeyF", down: 0, up: 20 },
      { code: "KeyD", down: SIMULTANEOUS_MS + 1, up: 60 },
    ]);
    expect(findSimultaneous(state.strokes)).toHaveLength(0);
  });

  it("counts overlapping holds even when the keydowns are farther apart", () => {
    const state = play(english("f"), "qwerty", true, [
      { code: "KeyF", down: 0, up: 100 },
      { code: "KeyD", down: 50, up: 80 },
    ]);
    expect(findSimultaneous(state.strokes)).toHaveLength(1);
  });

  it("does not count a wrong neighbor that was pressed alone", () => {
    const state = play(english("f"), "qwerty", true, [{ code: "KeyD", down: 0, up: 30 }]);
    expect(findSimultaneous(state.strokes)).toHaveLength(0);
  });

  it("does not count a fast correct roll of adjacent keys", () => {
    const state = play(english("as"), "qwerty", true, [
      { code: "KeyA", down: 0, up: 40 },
      { code: "KeyS", down: 15, up: 55 },
    ]);
    expect(state.done).toBe(true);
    expect(findSimultaneous(state.strokes)).toHaveLength(0);
  });

  it("does not count keys that are not physical neighbors", () => {
    const state = play(english("a"), "qwerty", true, [
      { code: "KeyA", down: 0, up: 40 },
      { code: "KeyL", down: 5, up: 30 },
    ]);
    expect(findSimultaneous(state.strokes)).toHaveLength(0);
  });
});

describe("remiss after backspace", () => {
  it("counts the next wrong character at the same position", () => {
    const state = play(english("hi"), "qwerty", true, [
      { code: "KeyH", down: 0, up: 20 },
      { code: "KeyX", down: 40, up: 60 },
      backspace(80),
      { code: "KeyY", down: 120, up: 140 },
    ]);
    const summary = summarize(state);
    expect(summary.remiss.count).toBe(1);
    expect(summary.remiss.examples[0]?.label).toContain("y");
    expect(state.findings[0]).toMatchObject({ type: "remiss", position: 1, typed: "y" });
  });

  it("does not count a correct character typed right after backspace", () => {
    const state = play(english("hi"), "qwerty", true, [
      { code: "KeyH", down: 0, up: 20 },
      { code: "KeyX", down: 40, up: 60 },
      backspace(80),
      { code: "KeyI", down: 120, up: 140 },
    ]);
    expect(summarize(state).remiss.count).toBe(0);
    expect(state.done).toBe(true);
  });
});

describe("romaji patterns", () => {
  it("counts ka typed as ak as an order swap", () => {
    const state = play(japanese([kana("か", "ka")]), "qwerty", true, [
      { code: "KeyA", down: 0, up: 20 },
      { code: "KeyK", down: 40, up: 60 },
    ]);
    expect(state.findings).toEqual([
      expect.objectContaining({ type: "swap", expected: "ka", typed: "ak" }),
    ]);
  });

  it("accepts shi and si for し", () => {
    const shi = play(japanese([kana("し", "shi", "si")]), "qwerty", true, [
      { code: "KeyS", down: 0, up: 20 },
      { code: "KeyH", down: 40, up: 60 },
      { code: "KeyI", down: 80, up: 100 },
    ]);
    const si = play(japanese([kana("し", "shi", "si")]), "qwerty", true, [
      { code: "KeyS", down: 0, up: 20 },
      { code: "KeyI", down: 40, up: 60 },
    ]);
    expect(shi.done).toBe(true);
    expect(si.done).toBe(true);
    expect(shi.findings).toHaveLength(0);
    expect(si.findings).toHaveLength(0);
  });

  it("counts a youon miss separately from a plain kana miss", () => {
    const state = play(japanese([youon("しゃ", "sha", "sya")]), "qwerty", true, [
      { code: "KeyS", down: 0, up: 20 },
      { code: "KeyA", down: 40, up: 60 },
    ]);
    expect(state.findings).toEqual([
      expect.objectContaining({ type: "youon", expected: "sha", typed: "sa" }),
    ]);
  });

  it("accepts sha and counts a single n before a vowel as an ん miss", () => {
    const ok = play(japanese([youon("しゃ", "sha", "sya"), kana("し", "shi", "si"), nn()]), "qwerty", true, [
      { code: "KeyS", down: 0, up: 10 },
      { code: "KeyH", down: 20, up: 30 },
      { code: "KeyA", down: 40, up: 50 },
      { code: "KeyS", down: 60, up: 70 },
      { code: "KeyI", down: 80, up: 90 },
      { code: "KeyN", down: 100, up: 110 },
    ]);
    expect(ok.done).toBe(true);
    const missed = play(japanese([kana("か", "ka"), nn(), kana("い", "i")]), "qwerty", true, [
      { code: "KeyK", down: 0, up: 20 },
      { code: "KeyA", down: 40, up: 60 },
      { code: "KeyN", down: 80, up: 100 },
      { code: "KeyI", down: 120, up: 140 },
    ]);
    expect(missed.findings).toEqual([
      expect.objectContaining({ type: "nn", expected: "nn", typed: "ni" }),
    ]);
  });

  it("accepts nn before a vowel and a single n before a consonant", () => {
    const vowel = play(japanese([kana("か", "ka"), nn(), kana("い", "i")]), "qwerty", true, [
      { code: "KeyK", down: 0, up: 10 },
      { code: "KeyA", down: 20, up: 30 },
      { code: "KeyN", down: 40, up: 50 },
      { code: "KeyN", down: 60, up: 70 },
      { code: "KeyI", down: 80, up: 90 },
    ]);
    const consonant = play(
      japanese([kana("し", "shi", "si"), nn(), kana("ぶ", "bu"), nn()]),
      "qwerty",
      true,
      [
        { code: "KeyS", down: 0, up: 10 },
        { code: "KeyH", down: 20, up: 30 },
        { code: "KeyI", down: 40, up: 50 },
        { code: "KeyN", down: 60, up: 70 },
        { code: "KeyB", down: 80, up: 90 },
        { code: "KeyU", down: 100, up: 110 },
        { code: "KeyN", down: 120, up: 130 },
      ],
    );
    expect(vowel.done).toBe(true);
    expect(consonant.done).toBe(true);
    expect(vowel.findings).toHaveLength(0);
    expect(consonant.findings).toHaveLength(0);
  });

  it("accepts a doubled consonant and xtu for っ", () => {
    const doubled = play(japanese([kana("き", "ki"), sokuon(), kana("て", "te")]), "qwerty", true, [
      { code: "KeyK", down: 0, up: 10 },
      { code: "KeyI", down: 20, up: 30 },
      { code: "KeyT", down: 40, up: 50 },
      { code: "KeyT", down: 60, up: 70 },
      { code: "KeyE", down: 80, up: 90 },
    ]);
    const special = play(japanese([kana("き", "ki"), sokuon(), kana("て", "te")]), "qwerty", true, [
      { code: "KeyK", down: 0, up: 10 },
      { code: "KeyI", down: 20, up: 30 },
      { code: "KeyX", down: 40, up: 50 },
      { code: "KeyT", down: 60, up: 70 },
      { code: "KeyU", down: 80, up: 90 },
      { code: "KeyT", down: 100, up: 110 },
      { code: "KeyE", down: 120, up: 130 },
    ]);
    expect(doubled.done).toBe(true);
    expect(special.done).toBe(true);
  });
});

describe("layout conversion", () => {
  const colemakTaps: Tap[] = [
    { code: "KeyK", key: "e", down: 0, up: 30 },
    { code: "KeyA", key: "a", down: 80, up: 110 },
  ];

  it("maps the same Colemak-DH physical keys with conversion on and off", () => {
    const on = play(english("ea"), "colemak-dh", true, colemakTaps);
    const off = play(english("ea"), "colemak-dh", false, colemakTaps);
    expect(on.done).toBe(true);
    expect(off.done).toBe(true);
    expect(on.strokes.map((stroke) => stroke.key)).toEqual(["e", "a"]);
    expect(off.strokes.map((stroke) => stroke.key)).toEqual(["e", "a"]);
    expect(summarize(on)).toMatchObject({ remiss: { count: 0 }, simultaneous: { count: 0 } });
    expect(summarize(off)).toEqual(summarize(on));
  });

  it("classifies a Colemak-DH remiss the same way with conversion on and off", () => {
    const taps: Tap[] = [
      { code: "KeyK", key: "e", down: 0, up: 20 },
      { code: "KeyS", key: "r", down: 100, up: 120 },
      backspace(160),
      { code: "KeyS", key: "r", down: 220, up: 240 },
    ];
    const on = summarize(play(english("ea"), "colemak-dh", true, taps));
    const off = summarize(play(english("ea"), "colemak-dh", false, taps));
    expect(on.remiss.count).toBe(1);
    expect(off).toEqual(on);
  });

  const oonishiTaps: Tap[] = [
    { code: "KeyD", key: "a", down: 0, up: 40 },
    { code: "KeyF", key: "o", down: 10, up: 30 },
  ];

  it("maps the same 大西配列 physical keys with conversion on and off", () => {
    const on = play(english("a"), "oonishi", true, oonishiTaps);
    const off = play(english("a"), "oonishi", false, oonishiTaps);
    expect(on.strokes.map((stroke) => stroke.key)).toEqual(["a", "o"]);
    expect(off.strokes.map((stroke) => stroke.key)).toEqual(["a", "o"]);
    expect(summarize(on).simultaneous.count).toBe(1);
    expect(summarize(off)).toEqual(summarize(on));
  });
});
