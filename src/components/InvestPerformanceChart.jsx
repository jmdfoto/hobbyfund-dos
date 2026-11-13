import { useEffect, useRef, useState } from "react";
import { fetchInvestHistory } from "../lib/api.js";
import { formatMoney, formatDate } from "../lib/format.js";
import { RANGES } from "../lib/history.js";

const WIDTH = 300;
const HEIGHT = 120;
const PAD_Y = 6;
const RANGE_LABELS = { "1W": "1W", "1M": "1M", "3M": "3M", "1Y": "1Y", ALL: "All" };

// Market dates arrive as YYYY-MM-DD; read them as local noon so formatting never shifts a day.
const dayToIso = (day) => `${day}T12:00:00`;

function scaleFor(points) {
  const values = points.flatMap((p) => [p.value, p.deposited]);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  // Keep at least a few dollars of headroom so tiny moves don't look like cliffs.
  const pad = Math.max((hi - lo) * 0.1, 2);
  lo = Math.max(0, lo - pad);
  hi = hi + pad;
  const x = (i) => (points.length === 1 ? WIDTH / 2 : (i / (points.length - 1)) * WIDTH);
  const y = (v) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (HEIGHT - PAD_Y * 2);
  return { x, y };
}

function valuePath(points, { x, y }) {
  return points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
}

// Deposits change in steps, so draw "money put in" as a step line.
function depositedPath(points, { x, y }) {
  return points
    .map((p, i) =>
      i === 0 ? `M${x(0)},${y(p.deposited)}` : `H${x(i)} V${y(p.deposited)}`
    )
    .join(" ");
}

export default function InvestPerformanceChart({ refreshKey }) {
  const [range, setRange] = useState("1M");
  const [history, setHistory] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchInvestHistory(range).then((result) => {
      if (!cancelled) setHistory(result.ok ? result.history : { error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [range, refreshKey]);

  const points = history?.points ?? [];
  const scale = points.length ? scaleFor(points) : null;
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const last = points[points.length - 1];

  function handlePointerMove(e) {
    if (!points.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHoverIndex(Math.round(ratio * (points.length - 1)));
  }

  let body;
  if (!history) {
    body = <p className="empty-state">Loading…</p>;
  } else if (history.error) {
    body = <p className="empty-state">Couldn't load the chart right now.</p>;
  } else if (points.length === 0) {
    body = (
      <p className="empty-state">
        Once money is in the investment account, how it grows will show up here.
      </p>
    );
  } else {
    const up = history.marketGain >= 0;
    body = (
      <>
        <div className="perf-chart">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="chart-svg perf-chart-svg"
            role="img"
            aria-label={`Investment value over ${RANGE_LABELS[range]}: now ${formatMoney(last.value)}, with ${formatMoney(last.deposited)} put in`}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <path d={depositedPath(points, scale)} className="perf-line-deposited" />
            <path d={valuePath(points, scale)} className="perf-line-value" />
            {points.length === 1 && (
              <circle cx={scale.x(0)} cy={scale.y(last.value)} r="4" className="perf-dot" />
            )}
            {hovered && (
              <>
                <line
                  x1={scale.x(hoverIndex)}
                  x2={scale.x(hoverIndex)}
                  y1="0"
                  y2={HEIGHT}
                  className="perf-crosshair"
                />
                <circle
                  cx={scale.x(hoverIndex)}
                  cy={scale.y(hovered.value)}
                  r="4"
                  className="perf-dot"
                />
              </>
            )}
          </svg>
          {hovered && (
            <div
              className="perf-tooltip"
              style={{
                left: `${(scale.x(hoverIndex) / WIDTH) * 100}%`,
                transform: `translateX(${hoverIndex > points.length / 2 ? "-100%" : "0"})`,
              }}
            >
              <strong>{formatDate(dayToIso(hovered.date))}</strong>
              <span>Worth {formatMoney(hovered.value)}</span>
              <span>Put in {formatMoney(hovered.deposited)}</span>
            </div>
          )}
        </div>

        <div className="chart-legend">
          <span>
            <i className="legend-swatch legend-contributed" /> What it's worth
          </span>
          <span>
            <i className="legend-swatch legend-deposited" /> Money put in
          </span>
        </div>
        <div className="chart-footer">
          <span>{formatDate(dayToIso(points[0].date))}</span>
          <span className={`chart-current ${up ? "amount-credit" : "amount-debit"}`}>
            {up ? "Up" : "Down"} {formatMoney(Math.abs(history.marketGain))} from the market
          </span>
          <span>{formatDate(dayToIso(last.date))}</span>
        </div>

        <table className="sr-only">
          <caption>Investment value by day</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Worth</th>
              <th>Put in</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td>{formatMoney(p.value)}</td>
                <td>{formatMoney(p.deposited)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <section className="chart-section">
      <h2>Invest progress</h2>
      <div className="direction-toggle range-toggle" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={`toggle-btn ${range === r ? "active" : ""}`}
            aria-pressed={range === r}
            onClick={() => {
              setHoverIndex(null);
              setRange(r);
            }}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>
      {body}
    </section>
  );
}
