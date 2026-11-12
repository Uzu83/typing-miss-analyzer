import type { Task } from "./engine";
import { kana, nn, sokuon, youon } from "./romaji";

export const PROMPTS: Task[] = [
  {
    lang: "en",
    id: "en-pack",
    title: "英文 pack",
    target: "pack my box",
  },
  {
    lang: "en",
    id: "en-fox",
    title: "英文 fox",
    target: "the quick brown fox",
  },
  {
    lang: "ja",
    id: "ja-kashi",
    title: "かし",
    morae: [kana("か", "ka"), kana("し", "shi", "si")],
  },
  {
    lang: "ja",
    id: "ja-kan-i",
    title: "かんい",
    morae: [kana("か", "ka"), nn(), kana("い", "i")],
  },
  {
    lang: "ja",
    id: "ja-sha",
    title: "しゃしん",
    morae: [youon("しゃ", "sha", "sya"), kana("し", "shi", "si"), nn()],
  },
  {
    lang: "ja",
    id: "ja-kitte",
    title: "きって",
    morae: [kana("き", "ki"), sokuon(), kana("て", "te")],
  },
  {
    lang: "ja",
    id: "ja-kyou",
    title: "きょうはしゃしんをみる",
    morae: [
      youon("きょ", "kyo"),
      kana("う", "u"),
      kana("は", "ha"),
      youon("しゃ", "sha", "sya"),
      kana("し", "shi", "si"),
      nn(),
      kana("を", "wo"),
      kana("み", "mi"),
      kana("る", "ru"),
    ],
  },
];

export function promptsFor(lang: "en" | "ja"): Task[] {
  return PROMPTS.filter((prompt) => prompt.lang === lang);
}
