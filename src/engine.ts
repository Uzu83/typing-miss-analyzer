import { isAdjacent } from "./adjacency";
import { charFromCode, type LayoutId } from "./layouts";
import {
  canonicalSpelling,
  parseRomaji,
  type Mora,
  type RomajiErrorKind,
} from "./romaji";

/** Initial gap, in milliseconds, that still counts as one overlapping press. */
export const SIMULTANEOUS_MS = 30;

export type EnglishTask = {
  lang: "en";
  id: string;
  title: string;
  target: string;
};

export type JapaneseTask = {
  lang: "ja";
  id: string;
  title: string;
  morae: Mora[];
};

export type Task = EnglishTask | JapaneseTask;

export type StrokeResult = "correct" | "incorrect" | "backspace" | "ignored";

export type Stroke = {
  id: number;
  code: string;
  /** Character after layout mapping. Empty for Backspace. */
  key: string;
  downTime: number;
  upTime: number | null;
  expected: string | null;
  result: StrokeResult;
};

export type RemissFinding = {
  type: "remiss";
  position: number;
  expected: string;
  typed: string;
};

export type RomajiFinding = {
  type: Exclude<RomajiErrorKind, "other">;
  expected: string;
  typed: string;
};

export type SimultaneousFinding = {
  type: "simultaneous";
  correctKey: string;
  extraKey: string;
  correctCode: string;
  extraCode: string;
};

export type Finding = RemissFinding | RomajiFinding | SimultaneousFinding;

export type InputEvent = {
  type: "down" | "up";
  code: string;
  /** KeyboardEvent.key. Used only when keymap conversion is off. */
  key: string;
  time: number;
  repeat?: boolean;
};

export type EngineState = {
  task: Task;
  layoutId: LayoutId;
  keymapOn: boolean;
  buffer: string;
  strokes: Stroke[];
  findings: Array<RemissFinding | RomajiFinding>;
  afterBackspace: boolean;
  romajiNoted: boolean;
  swapNoted: boolean;
  nextId: number;
  done: boolean;
};

export function createState(task: Task, layoutId: LayoutId, keymapOn: boolean): EngineState {
  return {
    task,
    layoutId,
    keymapOn,
    buffer: "",
    strokes: [],
    findings: [],
    afterBackspace: false,
    romajiNoted: false,
    swapNoted: false,
    nextId: 1,
    done: false,
  };
}

export function producedChar(
  event: { code: string; key: string },
  layoutId: LayoutId,
  keymapOn: boolean,
): string {
  if (event.code === "Space" || event.key === " ") return " ";
  if (keymapOn) return charFromCode(layoutId, event.code);
  if (event.key.length === 1) return event.key.toLowerCase();
  return "";
}

function isDone(task: Task, buffer: string): boolean {
  if (task.lang === "en") return buffer === task.target;
  return parseRomaji(buffer, task.morae).status === "done";
}

function continues(task: Task, buffer: string): boolean {
  if (task.lang === "en") return task.target.startsWith(buffer);
  const status = parseRomaji(buffer, task.morae).status;
  return status === "empty" || status === "prefix" || status === "done";
}

function expectedLabel(task: Task, buffer: string): string | null {
  if (task.lang === "en") return task.target[buffer.length] ?? null;
  const parsed = parseRomaji(buffer, task.morae);
  if (parsed.status === "done") return null;
  return parsed.expected ?? null;
}

function positionOf(task: Task, buffer: string): number {
  if (task.lang === "en") return buffer.length;
  return parseRomaji(buffer, task.morae).matchedMorae;
}

function lastCharStroke(state: EngineState): Stroke | undefined {
  return [...state.strokes].reverse().find((stroke) => stroke.result === "correct" || stroke.result === "incorrect");
}

function isChord(previous: Stroke, code: string, time: number): boolean {
  if (!previous.key || !isAdjacent(previous.code, code)) return false;
  const close = Math.abs(previous.downTime - time) <= SIMULTANEOUS_MS;
  const stillHeld = previous.upTime === null || previous.upTime > time;
  return close || stillHeld;
}

export function applyEvent(state: EngineState, event: InputEvent): EngineState {
  if (event.type === "up") {
    const index = [...state.strokes].reverse().findIndex((stroke) => {
      return stroke.code === event.code && stroke.upTime === null;
    });
    if (index === -1) return state;
    const fromEnd = state.strokes.length - 1 - index;
    const strokes = state.strokes.map((stroke, strokeIndex) => {
      return strokeIndex === fromEnd ? { ...stroke, upTime: event.time } : stroke;
    });
    return { ...state, strokes };
  }

  if (event.repeat) return state;
  if (event.code === "Backspace" || event.key === "Backspace") {
    if (state.done) return state;
    return applyBackspace(state, event);
  }

  const key = producedChar(event, state.layoutId, state.keymapOn);
  if (!key) return state;

  const previous = lastCharStroke(state);
  const stillThere = previous !== undefined && previous.key.length > 0 && state.buffer.endsWith(previous.key);

  if (state.done) {
    if (previous && previous.result === "correct" && isChord(previous, event.code, event.time)) {
      return commitChar(state, event, key, false);
    }
    return state;
  }

  if (stillThere && previous && previous.result === "incorrect") {
    const restored = state.buffer.slice(0, -previous.key.length);
    if (isChord(previous, event.code, event.time) && continues(state.task, restored + key)) {
      return commitChar({ ...state, buffer: restored }, event, key, true);
    }
  }

  const wouldBeCorrect = continues(state.task, state.buffer + key);
  if (!wouldBeCorrect && stillThere && previous && previous.result === "correct" && isChord(previous, event.code, event.time)) {
    return commitChar(state, event, key, false);
  }

  return commitChar(state, event, key, true);
}

function commitChar(state: EngineState, event: InputEvent, key: string, insert: boolean): EngineState {
  const expected = expectedLabel(state.task, state.buffer);
  const nextBuffer = insert ? state.buffer + key : state.buffer;
  const correct = insert && continues(state.task, nextBuffer);
  const findings = [...state.findings];
  let romajiNoted = state.romajiNoted;
  let swapNoted = state.swapNoted;

  if (insert && state.afterBackspace && !correct) {
    findings.push({
      type: "remiss",
      position: positionOf(state.task, state.buffer),
      expected: expected ?? "",
      typed: key,
    });
  }

  if (insert && !correct && state.task.lang === "ja") {
    const parsed = parseRomaji(nextBuffer, state.task.morae);
    if ((parsed.errorKind === "youon" || parsed.errorKind === "nn") && !romajiNoted) {
      findings.push({
        type: parsed.errorKind,
        expected: parsed.expected ?? "",
        typed: parsed.attempt,
      });
      romajiNoted = true;
    }
    if (parsed.errorKind === "swap" && !swapNoted) {
      findings.push({
        type: "swap",
        expected: parsed.expected ?? "",
        typed: parsed.attempt,
      });
      swapNoted = true;
    }
  }

  const stroke: Stroke = {
    id: state.nextId,
    code: event.code,
    key,
    downTime: event.time,
    upTime: null,
    expected,
    result: correct ? "correct" : "incorrect",
  };

  return {
    ...state,
    buffer: nextBuffer,
    strokes: [...state.strokes, stroke],
    findings,
    afterBackspace: insert ? false : state.afterBackspace,
    romajiNoted: insert ? romajiNoted : state.romajiNoted,
    swapNoted: insert ? swapNoted : state.swapNoted,
    nextId: state.nextId + 1,
    done: state.done || (insert && isDone(state.task, nextBuffer)),
  };
}

function applyBackspace(state: EngineState, event: InputEvent): EngineState {
  const deleted = state.buffer.length > 0;
  const buffer = deleted ? state.buffer.slice(0, -1) : state.buffer;
  const stillError =
    state.task.lang === "ja" && deleted && parseRomaji(buffer, state.task.morae).status === "error";
  const stroke: Stroke = {
    id: state.nextId,
    code: "Backspace",
    key: "",
    downTime: event.time,
    upTime: null,
    expected: null,
    result: "backspace",
  };
  return {
    ...state,
    buffer,
    strokes: [...state.strokes, stroke],
    afterBackspace: deleted,
    romajiNoted: stillError ? state.romajiNoted : false,
    swapNoted: stillError ? state.swapNoted : false,
    nextId: state.nextId + 1,
  };
}

function overlaps(a: Stroke, b: Stroke): boolean {
  const aUp = a.upTime ?? Number.POSITIVE_INFINITY;
  const bUp = b.upTime ?? Number.POSITIVE_INFINITY;
  return a.downTime < bUp && b.downTime < aUp;
}

/**
 * A correct key and a physically neighboring incorrect key, pressed within
 * SIMULTANEOUS_MS or while the other key is still held.
 * A fast correct roll is not counted: the neighbor must be an incorrect key.
 */
export function findSimultaneous(strokes: Stroke[], threshold = SIMULTANEOUS_MS): SimultaneousFinding[] {
  const findings: SimultaneousFinding[] = [];
  const used = new Set<number>();
  for (const correct of strokes) {
    if (correct.result !== "correct" || !correct.key) continue;
    for (const other of strokes) {
      if (other.id === correct.id || used.has(other.id)) continue;
      if (other.result !== "incorrect" || !other.key) continue;
      if (!isAdjacent(correct.code, other.code)) continue;
      const close = Math.abs(correct.downTime - other.downTime) <= threshold;
      if (!close && !overlaps(correct, other)) continue;
      used.add(other.id);
      findings.push({
        type: "simultaneous",
        correctKey: correct.key,
        extraKey: other.key,
        correctCode: correct.code,
        extraCode: other.code,
      });
    }
  }
  return findings;
}

export function expectedGuide(task: Task): string {
  if (task.lang === "en") return task.target;
  return task.morae.map((mora, index) => canonicalSpelling(mora, task.morae[index + 1])).join("");
}
