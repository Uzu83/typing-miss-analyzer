export type MoraKind = "kana" | "youon" | "nn" | "sokuon";

export type Mora = {
  kind: MoraKind;
  kana: string;
  /** Accepted romaji spellings. Unused for っ and ん, which depend on the next mora. */
  accepted: string[];
};

export type RomajiErrorKind = "swap" | "youon" | "nn" | "other";

export type RomajiParse = {
  status: "empty" | "prefix" | "done" | "error";
  matchedMorae: number;
  /** Typed romaji that belongs to the current, not-yet-finished mora. */
  attempt: string;
  errorKind?: RomajiErrorKind;
  /** Canonical spelling of the current mora, when one is in progress or failed. */
  expected?: string;
};

export function kana(text: string, ...accepted: string[]): Mora {
  return { kind: "kana", kana: text, accepted };
}

export function youon(text: string, ...accepted: string[]): Mora {
  return { kind: "youon", kana: text, accepted };
}

export function nn(text = "ん"): Mora {
  return { kind: "nn", kana: text, accepted: ["n", "nn", "xn"] };
}

export function sokuon(): Mora {
  return { kind: "sokuon", kana: "っ", accepted: [] };
}

type Match = { type: "exact"; len: number } | { type: "prefix" } | { type: "none" };

function matchSpellings(input: string, accepted: string[]): Match {
  const sorted = [...accepted].sort((a, b) => b.length - a.length);
  for (const spelling of sorted) {
    if (spelling.length > 0 && input.startsWith(spelling)) {
      return { type: "exact", len: spelling.length };
    }
  }
  if (accepted.some((spelling) => spelling.startsWith(input) && input.length < spelling.length)) {
    return { type: "prefix" };
  }
  return { type: "none" };
}

function nextNeedsDoubleN(next: Mora, after?: Mora): boolean {
  if (next.kind === "nn") return true;
  const spellings = spellingsOf(next, after);
  return spellings.some((spelling) => spelling[0] !== undefined && "aiueoyn".includes(spelling[0]));
}

function spellingsOf(mora: Mora, next?: Mora): string[] {
  if (mora.kind === "sokuon") return sokuonSpellings(next);
  if (mora.kind === "nn") return ["nn", "xn", "n"];
  return mora.accepted;
}

/** Single-consonant doubling plus xtu/ltu. The single consonant is not a static prefix. */
function sokuonSpellings(next?: Mora): string[] {
  const specials = ["xtu", "ltu", "xtsu", "ltsu"];
  if (!next) return specials;
  const consonants = new Set<string>();
  for (const spelling of spellingsOf(next, undefined)) {
    const head = spelling[0];
    if (head && !"aiueo".includes(head)) consonants.add(head);
  }
  return [...specials, ...consonants];
}

function matchSokuon(input: string, next?: Mora): Match {
  const specials = ["xtu", "ltu", "xtsu", "ltsu"];
  const special = matchSpellings(input, specials);
  if (special.type === "exact") return special;
  if (!next) return special;

  for (const spelling of spellingsOf(next, undefined)) {
    const head = spelling[0];
    if (!head || "aiueo".includes(head)) continue;
    const doubled = head + spelling;
    if (input.startsWith(doubled)) return { type: "exact", len: 1 };
    if (doubled.startsWith(input) && input.length < doubled.length) return { type: "prefix" };
  }
  return special.type === "prefix" ? special : { type: "none" };
}

function matchNn(input: string, next: Mora | undefined, after: Mora | undefined): Match {
  if (input.length === 0) return { type: "prefix" };
  if (input.startsWith("nn") || input.startsWith("xn")) return { type: "exact", len: 2 };
  if (input[0] === "x") return input.length === 1 ? { type: "prefix" } : { type: "none" };
  if (input[0] !== "n") return { type: "none" };
  if (!next) return input.length === 1 ? { type: "exact", len: 1 } : { type: "none" };
  if (nextNeedsDoubleN(next, after)) {
    return input.length === 1 ? { type: "prefix" } : { type: "none" };
  }
  if (input.length === 1) return { type: "prefix" };
  const rest = matchMora(input.slice(1), next, after);
  if (rest.type === "exact" || rest.type === "prefix") return { type: "exact", len: 1 };
  return { type: "none" };
}

function matchMora(input: string, mora: Mora, next?: Mora, after?: Mora): Match {
  if (mora.kind === "sokuon") return matchSokuon(input, next);
  if (mora.kind === "nn") return matchNn(input, next, after);
  if (input.length === 0) return { type: "prefix" };
  return matchSpellings(input, mora.accepted);
}

export function canonicalSpelling(mora: Mora, next?: Mora): string {
  if (mora.kind === "nn") {
    if (next && nextNeedsDoubleN(next, undefined)) return "nn";
    return "n";
  }
  if (mora.kind === "sokuon") {
    const doubled = sokuonSpellings(next).find((spelling) => spelling.length === 1);
    return doubled ?? "xtu";
  }
  return mora.accepted[0] ?? "";
}

function classify(mora: Mora, attempt: string): RomajiErrorKind {
  if (mora.kind === "nn") return "nn";
  if (mora.kind === "youon") return "youon";
  if (mora.kind === "kana") {
    const reversed = mora.accepted
      .filter((spelling) => spelling.length === 2)
      .map((spelling) => spelling[1] + spelling[0]);
    if (reversed.includes(attempt)) return "swap";
  }
  return "other";
}

export function parseRomaji(input: string, morae: Mora[]): RomajiParse {
  let pos = 0;
  for (let index = 0; index < morae.length; index += 1) {
    const mora = morae[index];
    const next = morae[index + 1];
    const after = morae[index + 2];
    const rest = input.slice(pos);
    const matched = matchMora(rest, mora, next, after);
    if (matched.type === "exact") {
      pos += matched.len;
      continue;
    }
    const expected = canonicalSpelling(mora, next);
    if (matched.type === "prefix") {
      return {
        status: input.length === 0 ? "empty" : "prefix",
        matchedMorae: index,
        attempt: rest,
        expected,
      };
    }
    return {
      status: "error",
      matchedMorae: index,
      attempt: rest,
      errorKind: classify(mora, rest),
      expected,
    };
  }
  if (pos < input.length) {
    return {
      status: "error",
      matchedMorae: morae.length,
      attempt: input.slice(pos),
      errorKind: "other",
      expected: "",
    };
  }
  return { status: "done", matchedMorae: morae.length, attempt: "" };
}

export function canonicalText(morae: Mora[]): string {
  return morae.map((mora, index) => canonicalSpelling(mora, morae[index + 1])).join("");
}

export function kanaText(morae: Mora[]): string {
  return morae.map((mora) => mora.kana).join("");
}
