import { useEffect, useId, useRef, useState } from "react";
import { KeyboardChart } from "./keyboard";
import { applyEvent, createState, expectedGuide, type EngineState, type InputEvent, type Task } from "./engine";
import { kanaText } from "./romaji";
import { promptsFor } from "./prompts";
import { loadSessions, loadSettings, saveSession, saveSettings, type Settings } from "./storage";
import { percent, pointsDelta, summarize, type Summary } from "./summary";

type View = "setup" | "practice" | "result";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [view, setView] = useState<View>("setup");
  const [state, setState] = useState<EngineState | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [previous, setPrevious] = useState<Summary | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stateRef = useRef<EngineState | null>(null);
  const skippedFirstFocus = useRef(false);
  const layoutId = useId();
  const keymapId = useId();
  const keymapHintId = useId();
  const jaId = useId();
  const enId = useId();

  useEffect(() => {
    const titles: Record<View, string> = {
      setup: "課題を選ぶ | タイピング練習",
      practice: "練習 | タイピング練習",
      result: "結果 | タイピング練習",
    };
    document.title = titles[view];
  }, [view]);

  useEffect(() => {
    if (!skippedFirstFocus.current) {
      skippedFirstFocus.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (view !== "practice") return;
    const handle = (type: "down" | "up") => (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.key === "Tab") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const current = stateRef.current;
      if (!current) return;
      const input: InputEvent = {
        type,
        code: event.code,
        key: event.key,
        time: event.timeStamp,
        repeat: event.repeat,
      };
      const next = applyEvent(current, input);
      if (next === current && type === "down" && event.key !== "Backspace" && event.key.length !== 1 && event.code !== "Space") {
        return;
      }
      event.preventDefault();
      stateRef.current = next;
      setState(next);
      if (!current.done && next.done) finish(next);
    };
    const onDown = handle("down");
    const onUp = handle("up");
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [view]);

  function updateSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  function start(task: Task) {
    const created = createState(task, settings.layoutId, settings.keymapOn);
    stateRef.current = created;
    setState(created);
    setSummary(null);
    setPrevious(null);
    setView("practice");
  }

  function finish(doneState: EngineState) {
    const nextSummary = summarize(doneState);
    const prior = loadSessions().at(-1)?.summary ?? null;
    saveSession({
      at: Date.now(),
      promptId: doneState.task.id,
      layoutId: doneState.layoutId,
      keymapOn: doneState.keymapOn,
      summary: nextSummary,
      strokes: doneState.strokes,
    });
    setSummary(nextSummary);
    setPrevious(prior);
    setView("result");
  }

  function backToSetup() {
    stateRef.current = null;
    setState(null);
    setView("setup");
  }

  const title = view === "result" ? "結果" : view === "practice" ? "練習" : "タイピング練習";

  return (
    <div className="shell">
      <header>
        <h1 ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
        {view === "setup" ? (
          <p className="lede">同時押し、消した直後の打ち直し、ローマ字の型だけを数えます。記録はこのブラウザの中だけに残ります。</p>
        ) : null}
      </header>
      <main>
        {view === "setup" ? (
          <Setup
            settings={settings}
            layoutFieldId={layoutId}
            keymapId={keymapId}
            keymapHintId={keymapHintId}
            jaId={jaId}
            enId={enId}
            onChange={updateSettings}
            onStart={start}
          />
        ) : null}
        {view === "practice" && state ? <Practice state={state} onStop={backToSetup} /> : null}
        {view === "result" && summary ? (
          <Result summary={summary} previous={previous} onAgain={backToSetup} />
        ) : null}
      </main>
      <footer>TosaGiken（東佐技研）</footer>
    </div>
  );
}

function Setup({
  settings,
  layoutFieldId,
  keymapId,
  keymapHintId,
  jaId,
  enId,
  onChange,
  onStart,
}: {
  settings: Settings;
  layoutFieldId: string;
  keymapId: string;
  keymapHintId: string;
  jaId: string;
  enId: string;
  onChange: (settings: Settings) => void;
  onStart: (task: Task) => void;
}) {
  const prompts = promptsFor(settings.lang);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <fieldset>
        <legend>配列</legend>
        <div className="field">
          <label htmlFor={layoutFieldId}>使う配列</label>
          <select
            id={layoutFieldId}
            value={settings.layoutId}
            onChange={(event) => {
              const layoutId = event.target.value;
              if (layoutId === "qwerty" || layoutId === "colemak-dh" || layoutId === "oonishi") {
                onChange({ ...settings, layoutId });
              }
            }}
          >
            <option value="qwerty">QWERTY</option>
            <option value="colemak-dh">Colemak-DH</option>
            <option value="oonishi">大西配列</option>
          </select>
        </div>
        <div className="choice">
          <input
            id={keymapId}
            type="checkbox"
            checked={settings.keymapOn}
            aria-describedby={keymapHintId}
            onChange={(event) => onChange({ ...settings, keymapOn: event.target.checked })}
          />
          <label htmlFor={keymapId}>キーマップ変換</label>
        </div>
        <p id={keymapHintId} className="hint">
          オンのときは、OSがQWERTYのままでも物理キーを選んだ配列の文字として扱います。オフは、OS側で配列を変えている人向けです。
        </p>
      </fieldset>
      <fieldset>
        <legend>言語</legend>
        <div className="choice">
          <input
            id={jaId}
            type="radio"
            name="lang"
            checked={settings.lang === "ja"}
            onChange={() => onChange({ ...settings, lang: "ja" })}
          />
          <label htmlFor={jaId}>日本語</label>
        </div>
        <div className="choice">
          <input
            id={enId}
            type="radio"
            name="lang"
            checked={settings.lang === "en"}
            onChange={() => onChange({ ...settings, lang: "en" })}
          />
          <label htmlFor={enId}>英文</label>
        </div>
      </fieldset>
      <fieldset>
        <legend>課題</legend>
        <div className="prompt-list">
          {prompts.map((prompt) => (
            <button key={prompt.id} type="button" className="primary" onClick={() => onStart(prompt)}>
              {prompt.title}を始める
            </button>
          ))}
        </div>
      </fieldset>
    </form>
  );
}

function Practice({ state, onStop }: { state: EngineState; onStop: () => void }) {
  const guide = expectedGuide(state.task);
  return (
    <section>
      {state.task.lang === "en" ? (
        <EnglishTarget target={state.task.target} buffer={state.buffer} />
      ) : (
        <JapaneseTarget moraeText={kanaText(state.task.morae)} guide={guide} buffer={state.buffer} />
      )}
      <p className="progress">
        {state.buffer.length}打 / 見本 {guide.length}文字
      </p>
      <KeyboardChart layoutId={state.layoutId} />
      <div className="actions">
        <button type="button" onClick={onStop}>
          課題選択に戻る
        </button>
      </div>
    </section>
  );
}

function shown(char: string): string {
  return char === " " ? "␣" : char;
}

function EnglishTarget({ target, buffer }: { target: string; buffer: string }) {
  const length = Math.max(target.length, buffer.length);
  const marks = [];
  for (let index = 0; index < length; index += 1) {
    const expected = target[index];
    const typed = buffer[index];
    if (typed === undefined) marks.push({ text: shown(expected), className: "pending" });
    else if (typed === expected) marks.push({ text: shown(typed), className: "ok" });
    else marks.push({ text: shown(typed), className: "bad" });
  }
  return (
    <p className="target">
      {marks.map((mark, index) => (
        <span key={index} className={mark.className}>
          {mark.text}
        </span>
      ))}
    </p>
  );
}

function JapaneseTarget({
  moraeText,
  guide,
  buffer,
}: {
  moraeText: string;
  guide: string;
  buffer: string;
}) {
  return (
    <>
      <p className="kana">{moraeText}</p>
      <p className="guide">見本のローマ字: {guide}</p>
      <p className="typed">{buffer.length > 0 ? buffer : "ここに打った文字が出ます"}</p>
    </>
  );
}

function Result({
  summary,
  previous,
  onAgain,
}: {
  summary: Summary;
  previous: Summary | null;
  onAgain: () => void;
}) {
  return (
    <section>
      <p className="lede">打鍵 {summary.totalInputs} 回に対する割合です。</p>
      <div className="stats">
        <Stat
          title="隣接キーの同時押し"
          bucket={summary.simultaneous}
          previous={previous?.simultaneous.ratio}
        />
        <Stat title="消した直後の再ミス" bucket={summary.remiss} previous={previous?.remiss.ratio} />
        <article>
          <h2>ローマ字の型</h2>
          <p className="count">
            {summary.romaji.count}回（{percent(summary.romaji.ratio)}）
            {previous ? ` / 前回比 ${pointsDelta(summary.romaji.ratio, previous.romaji.ratio)}` : ""}
          </p>
          <p className="sub">入れ替え {summary.romaji.swap.count}回</p>
          <ExampleList examples={summary.romaji.swap.examples} />
          <p className="sub">拗音 {summary.romaji.youon.count}回</p>
          <ExampleList examples={summary.romaji.youon.examples} />
          <p className="sub">ん {summary.romaji.nn.count}回</p>
          <ExampleList examples={summary.romaji.nn.examples} />
        </article>
      </div>
      {previous ? null : <p className="hint">前回の記録はありません。</p>}
      <div className="actions">
        <button type="button" className="primary" onClick={onAgain}>
          もう一度選ぶ
        </button>
      </div>
    </section>
  );
}

function Stat({
  title,
  bucket,
  previous,
}: {
  title: string;
  bucket: Summary["remiss"];
  previous?: number;
}) {
  return (
    <article>
      <h2>{title}</h2>
      <p className="count">
        {bucket.count}回（{percent(bucket.ratio)}）
        {previous === undefined ? "" : ` / 前回比 ${pointsDelta(bucket.ratio, previous)}`}
      </p>
      <ExampleList examples={bucket.examples} />
    </article>
  );
}

function ExampleList({ examples }: { examples: Summary["remiss"]["examples"] }) {
  if (examples.length === 0) return <p className="hint">具体例はありません。</p>;
  return (
    <ul>
      {examples.map((example) => (
        <li key={example.label}>
          {example.label} × {example.count}
        </li>
      ))}
    </ul>
  );
}
