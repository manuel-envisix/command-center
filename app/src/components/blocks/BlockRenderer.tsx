import { marked } from "marked";
import { ImageLightbox } from "../ImageLightbox";
import type { Block } from "../../types/message";

function statusClass(status?: string) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (["ok", "success", "green"].includes(s)) return "ok";
  if (["running", "active", "pending", "in_progress"].includes(s)) return "running";
  if (["error", "failure", "failed", "red"].includes(s)) return "error";
  return "";
}

function SimpleChart({
  chartType,
  labels,
  series,
  title,
}: Extract<Block, { type: "chart" }>) {
  const width = 520;
  const height = 220;
  const pad = 28;
  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(1, ...allValues);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = labels.length > 1 ? innerW / (labels.length - 1) : innerW;

  return (
    <div className="block">
      {title && <h3>{title}</h3>}
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img">
        {series.map((s, si) => {
          const color = si === 0 ? "#5b9dff" : "#3ecf8e";
          if (chartType === "line") {
            const points = s.values
              .map((v, i) => {
                const x = pad + i * step;
                const y = pad + innerH - (v / max) * innerH;
                return `${x},${y}`;
              })
              .join(" ");
            return (
              <polyline
                key={si}
                fill="none"
                stroke={color}
                strokeWidth="2"
                points={points}
              />
            );
          }
          return s.values.map((v, i) => {
            const barW = innerW / s.values.length - 8;
            const x = pad + i * (innerW / s.values.length) + 4;
            const h = (v / max) * innerH;
            const y = pad + innerH - h;
            return <rect key={`${si}-${i}`} x={x} y={y} width={barW} height={h} fill={color} />;
          });
        })}
      </svg>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 12 }}>
        {labels.map((l) => (
          <span key={l} style={{ color: "var(--muted)" }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

export function BlockRenderer({
  block,
  highlighted,
}: {
  block: Block | { type: "unknown"; raw: unknown };
  highlighted?: boolean;
}) {
  const cls = `block${highlighted ? " highlight" : ""}`;

  if (block.type === "unknown") {
    return (
      <div className={`${cls} unknown-block`}>
        <strong>Unbekannter Block</strong>
        <pre>{JSON.stringify(block.raw, null, 2)}</pre>
      </div>
    );
  }

  switch (block.type) {
    case "markdown":
      return (
        <div className={cls} dangerouslySetInnerHTML={{ __html: marked.parse(block.content) as string }} />
      );
    case "card":
      return (
        <div className={cls}>
          <div className={`card-status ${statusClass(block.status)}`}>{block.status ?? "Info"}</div>
          <h3>{block.title}</h3>
          {block.body && <p>{block.body}</p>}
          {block.links?.map((l) => (
            <div key={l.href}>
              <a href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
            </div>
          ))}
        </div>
      );
    case "cards":
      return (
        <div className={cls}>
          <div className="cards-grid">
            {block.items.map((item) => (
              <div key={item.title} className="block" style={{ margin: 0 }}>
                <div className={`card-status ${statusClass(item.status)}`}>{item.status ?? "—"}</div>
                <h3>{item.title}</h3>
                {item.body && <p>{item.body}</p>}
                {item.links?.map((l) => (
                  <div key={l.href}>
                    <a href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    case "table": {
      const rows = block.rows.map((row) =>
        Array.isArray(row) ? row : block.columns.map((c) => String((row as Record<string, string>)[c] ?? "")),
      );
      return (
        <div className={cls}>
          {block.title && <h3>{block.title}</h3>}
          <table className="data-table">
            <thead>
              <tr>{block.columns.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "list":
      return (
        <div className={cls}>
          {block.title && <h3>{block.title}</h3>}
          <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      );
    case "checklist":
      return (
        <div className={cls}>
          {block.title && <h3>{block.title}</h3>}
          <ul>
            {block.items.map((item) => (
              <li key={item.label}>
                <input type="checkbox" readOnly checked={Boolean(item.checked)} /> {item.label}
              </li>
            ))}
          </ul>
        </div>
      );
    case "keyValue":
      return (
        <div className={cls}>
          {block.title && <h3>{block.title}</h3>}
          <dl className="kv-grid">
            {Object.entries(block.entries).flatMap(([k, v]) => [
              <dt key={`${k}-k`}>{k}</dt>,
              <dd key={`${k}-v`}>{String(v)}</dd>,
            ])}
          </dl>
        </div>
      );
    case "chart":
      return <SimpleChart {...block} />;
    case "image":
      return (
        <div className={cls}>
          <ImageLightbox src={block.url} alt={block.alt} className="dashboard-image-thumb" />
          {block.caption && <p style={{ color: "var(--muted)" }}>{block.caption}</p>}
        </div>
      );
    case "linkList":
      return (
        <div className={cls}>
          {block.title && <h3>{block.title}</h3>}
          <ul>
            {block.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
              </li>
            ))}
          </ul>
        </div>
      );
    case "html":
      return (
        <div className={cls}>
          {block.title && <h3>{block.title}</h3>}
          <iframe
            className="html-frame"
            sandbox=""
            srcDoc={block.content}
            title={block.title ?? "HTML-Inhalt"}
          />
        </div>
      );
    default:
      return (
        <div className={`${cls} unknown-block`}>
          <pre>{JSON.stringify(block, null, 2)}</pre>
        </div>
      );
  }
}
