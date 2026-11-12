import { isLayoutId, type LayoutId } from "./layouts";
import type { Stroke } from "./engine";
import type { Summary } from "./summary";

const SETTINGS_KEY = "tma-settings";
const SESSIONS_KEY = "tma-sessions";
const SESSION_LIMIT = 20;

export type Settings = {
  layoutId: LayoutId;
  keymapOn: boolean;
  lang: "en" | "ja";
};

export type SavedSession = {
  at: number;
  promptId: string;
  layoutId: LayoutId;
  keymapOn: boolean;
  summary: Summary;
  strokes: Stroke[];
};

export const defaultSettings: Settings = {
  layoutId: "qwerty",
  keymapOn: true,
  lang: "ja",
};

function memory(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function loadSettings(): Settings {
  const raw = memory()?.getItem(SETTINGS_KEY);
  if (!raw) return { ...defaultSettings };
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      layoutId: parsed.layoutId && isLayoutId(parsed.layoutId) ? parsed.layoutId : defaultSettings.layoutId,
      keymapOn: typeof parsed.keymapOn === "boolean" ? parsed.keymapOn : defaultSettings.keymapOn,
      lang: parsed.lang === "en" || parsed.lang === "ja" ? parsed.lang : defaultSettings.lang,
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: Settings): void {
  memory()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSessions(): SavedSession[] {
  const raw = memory()?.getItem(SESSIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSession(session: SavedSession): SavedSession[] {
  const next = [...loadSessions(), session].slice(-SESSION_LIMIT);
  memory()?.setItem(SESSIONS_KEY, JSON.stringify(next));
  return next;
}
