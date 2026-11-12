import {
  findSimultaneous,
  type EngineState,
  type RemissFinding,
  type RomajiFinding,
  type SimultaneousFinding,
} from "./engine";

export type Example = {
  label: string;
  count: number;
};

export type Bucket = {
  count: number;
  ratio: number;
  examples: Example[];
};

export type Summary = {
  totalInputs: number;
  simultaneous: Bucket;
  remiss: Bucket;
  romaji: Bucket & {
    swap: Bucket;
    youon: Bucket;
    nn: Bucket;
  };
};

function ratio(count: number, total: number): number {
  if (total <= 0) return 0;
  return count / total;
}

function examplesOf(labels: string[]): Example[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 5);
}

function bucket(labels: string[], total: number): Bucket {
  return {
    count: labels.length,
    ratio: ratio(labels.length, total),
    examples: examplesOf(labels),
  };
}

function simultaneousLabel(finding: SimultaneousFinding): string {
  return `「${finding.correctKey}」と隣の「${finding.extraKey}」`;
}

function remissLabel(finding: RemissFinding): string {
  return `${finding.position + 1}文字目で「${finding.typed}」（正しくは「${finding.expected}」）`;
}

function romajiLabel(finding: RomajiFinding): string {
  return `「${finding.expected}」を「${finding.typed}」`;
}

export function summarize(state: EngineState): Summary {
  const simultaneous = findSimultaneous(state.strokes);
  const totalInputs = state.strokes.filter((stroke) => {
    return stroke.result === "correct" || stroke.result === "incorrect";
  }).length;
  const remiss = state.findings.filter((finding): finding is RemissFinding => finding.type === "remiss");
  const swaps = state.findings.filter((finding): finding is RomajiFinding => finding.type === "swap");
  const youon = state.findings.filter((finding): finding is RomajiFinding => finding.type === "youon");
  const nn = state.findings.filter((finding): finding is RomajiFinding => finding.type === "nn");
  const romajiLabels = [...swaps, ...youon, ...nn].map(romajiLabel);
  return {
    totalInputs,
    simultaneous: bucket(simultaneous.map(simultaneousLabel), totalInputs),
    remiss: bucket(remiss.map(remissLabel), totalInputs),
    romaji: {
      ...bucket(romajiLabels, totalInputs),
      swap: bucket(swaps.map(romajiLabel), totalInputs),
      youon: bucket(youon.map(romajiLabel), totalInputs),
      nn: bucket(nn.map(romajiLabel), totalInputs),
    },
  };
}

export function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function pointsDelta(current: number, previous: number): string {
  const points = (current - previous) * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(1)}pt`;
}
