import { KEY_ROWS, LAYOUTS, type LayoutId } from "./layouts";

export function KeyboardChart({ layoutId }: { layoutId: LayoutId }) {
  const layout = LAYOUTS[layoutId];
  return (
    <figure className="board-wrap">
      <figcaption>{layout.name}のキー配置</figcaption>
      <div className="board">
        {KEY_ROWS.map((row) => (
          <div className="key-row" key={row[0]}>
            {row.map((code) => (
              <kbd key={code}>{layout.map[code] ?? ""}</kbd>
            ))}
          </div>
        ))}
      </div>
    </figure>
  );
}
