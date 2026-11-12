type Pos = { x: number; y: number };

const positions = new Map<string, Pos>();

function addRow(y: number, x0: number, codes: string[]) {
  codes.forEach((code, index) => {
    positions.set(code, { x: x0 + index, y });
  });
}

// Approximate ANSI stagger, in key widths. Neighbors are about 1.0 apart.
addRow(0, 0, [
  "Backquote",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "Digit9",
  "Digit0",
  "Minus",
  "Equal",
]);
addRow(1, 0.4, [
  "KeyQ",
  "KeyW",
  "KeyE",
  "KeyR",
  "KeyT",
  "KeyY",
  "KeyU",
  "KeyI",
  "KeyO",
  "KeyP",
  "BracketLeft",
  "BracketRight",
  "Backslash",
]);
addRow(2, 0.6, [
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyF",
  "KeyG",
  "KeyH",
  "KeyJ",
  "KeyK",
  "KeyL",
  "Semicolon",
  "Quote",
]);
addRow(3, 0.9, [
  "KeyZ",
  "KeyX",
  "KeyC",
  "KeyV",
  "KeyB",
  "KeyN",
  "KeyM",
  "Comma",
  "Period",
  "Slash",
]);
positions.set("Space", { x: 5.5, y: 4 });

/** Orthogonal and near-diagonal neighbors. Two keys away are not adjacent. */
const ADJACENT_DISTANCE = 1.35;

export function isAdjacent(codeA: string, codeB: string): boolean {
  if (codeA === codeB) return false;
  const a = positions.get(codeA);
  const b = positions.get(codeB);
  if (!a || !b) return false;
  return Math.hypot(a.x - b.x, a.y - b.y) <= ADJACENT_DISTANCE;
}
