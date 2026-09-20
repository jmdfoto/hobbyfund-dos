import { cumulativeSeries } from "../lib/ledger.js";
import { formatMoney, formatDate } from "../lib/format.js";

const WIDTH = 300;
const HEIGHT = 100;
const BAR_GAP = 4;

export default function SaveChart({ transactions }) {
  const series = cumulativeSeries(transactions, "save");

  if (series.length === 0) {
    return (
      <section className="chart-section">
        <h2>Save progress</h2>
        <p className="empty-state">Once you save some money, your progress will show up here.</p>
      </section>
    );
  }

  const maxValue = Math.max(...series.map((p) => p.value), 1);
  const barWidth = (WIDTH - BAR_GAP * (series.length - 1)) / series.length;

  return (
    <section className="chart-section">
      <h2>Save progress</h2>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        role="img"
        aria-label="Save balance over time"
      >
        {series.map((point, i) => {
          const barHeight = Math.max((point.value / maxValue) * (HEIGHT - 4), 1);
          const x = i * (barWidth + BAR_GAP);
          const y = HEIGHT - barHeight;
          return (
            <rect
              key={point.id}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="2"
              className="chart-bar-save"
            />
          );
        })}
      </svg>
      <div className="chart-footer">
        <span>{formatDate(series[0].date)}</span>
        <span className="chart-current">{formatMoney(series[series.length - 1].value)}</span>
        <span>{formatDate(series[series.length - 1].date)}</span>
      </div>
    </section>
  );
}
