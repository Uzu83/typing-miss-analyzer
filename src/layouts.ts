export type LayoutId = "qwerty" | "colemak-dh" | "oonishi";

export type Layout = {
  id: LayoutId;
  name: string;
  /** Physical KeyboardEvent.code → character. */
  map: Record<string, string>;
};

/** ANSI letter block, left to right, top to bottom. */
export const KEY_ROWS: string[][] = [
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon"],
  ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"],
];

const shared: Record<string, string> = {
  Backquote: "`",
  Digit1: "1",
  Digit2: "2",
  Digit3: "3",
  Digit4: "4",
  Digit5: "5",
  Digit6: "6",
  Digit7: "7",
  Digit8: "8",
  Digit9: "9",
  Digit0: "0",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Quote: "'",
  Space: " ",
};

function layout(id: LayoutId, name: string, letters: Record<string, string>): Layout {
  return { id, name, map: { ...shared, ...letters } };
}

/** US QWERTY. */
const qwertyLetters: Record<string, string> = {
  KeyQ: "q",
  KeyW: "w",
  KeyE: "e",
  KeyR: "r",
  KeyT: "t",
  KeyY: "y",
  KeyU: "u",
  KeyI: "i",
  KeyO: "o",
  KeyP: "p",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
  KeyF: "f",
  KeyG: "g",
  KeyH: "h",
  KeyJ: "j",
  KeyK: "k",
  KeyL: "l",
  Semicolon: ";",
  KeyZ: "z",
  KeyX: "x",
  KeyC: "c",
  KeyV: "v",
  KeyB: "b",
  KeyN: "n",
  KeyM: "m",
  Comma: ",",
  Period: ".",
  Slash: "/",
};

/**
 * Colemak-DH on ANSI, from the public-domain ColemakMods xmodmap
 * colemak_dh_ansi_us: q w f p b j l u y ; / a r s t g m n e i o / x c d v z k h , . /
 */
const colemakDhLetters: Record<string, string> = {
  KeyQ: "q",
  KeyW: "w",
  KeyE: "f",
  KeyR: "p",
  KeyT: "b",
  KeyY: "j",
  KeyU: "l",
  KeyI: "u",
  KeyO: "y",
  KeyP: ";",
  KeyA: "a",
  KeyS: "r",
  KeyD: "s",
  KeyF: "t",
  KeyG: "g",
  KeyH: "m",
  KeyJ: "n",
  KeyK: "e",
  KeyL: "i",
  Semicolon: "o",
  KeyZ: "x",
  KeyX: "c",
  KeyC: "d",
  KeyV: "v",
  KeyB: "z",
  KeyN: "k",
  KeyM: "h",
  Comma: ",",
  Period: ".",
  Slash: "/",
};

/**
 * 大西配列 as published at o24.works/layout:
 * q l u , . f w r y p / e i a o - k t n s h / z x c v ; g d m j b
 */
const oonishiLetters: Record<string, string> = {
  KeyQ: "q",
  KeyW: "l",
  KeyE: "u",
  KeyR: ",",
  KeyT: ".",
  KeyY: "f",
  KeyU: "w",
  KeyI: "r",
  KeyO: "y",
  KeyP: "p",
  KeyA: "e",
  KeyS: "i",
  KeyD: "a",
  KeyF: "o",
  KeyG: "-",
  KeyH: "k",
  KeyJ: "t",
  KeyK: "n",
  KeyL: "s",
  Semicolon: "h",
  KeyZ: "z",
  KeyX: "x",
  KeyC: "c",
  KeyV: "v",
  KeyB: ";",
  KeyN: "g",
  KeyM: "d",
  Comma: "m",
  Period: "j",
  Slash: "b",
};

export const LAYOUTS: Record<LayoutId, Layout> = {
  qwerty: layout("qwerty", "QWERTY", qwertyLetters),
  "colemak-dh": layout("colemak-dh", "Colemak-DH", colemakDhLetters),
  oonishi: layout("oonishi", "大西配列", oonishiLetters),
};

export const LAYOUT_LIST: Layout[] = [
  LAYOUTS.qwerty,
  LAYOUTS["colemak-dh"],
  LAYOUTS.oonishi,
];

export function isLayoutId(value: string): value is LayoutId {
  return value === "qwerty" || value === "colemak-dh" || value === "oonishi";
}

/** Character produced by a physical key. Empty when the code is not in the layout. */
export function charFromCode(layoutId: LayoutId, code: string): string {
  return LAYOUTS[layoutId].map[code] ?? "";
}
