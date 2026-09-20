import { investSeries } from "../lib/ledger.js";
import { formatMoney, formatDate } from "../lib/format.js";

const WIDTH = 300;
const HEIGHT = 100;
const BAR_GAP = 4;

export default function InvestChart({ transactions }) {
  const series = investSeries(transactions);

  if (series.length === 0) {
    return (
      <section className="chart-section">
        <h2>Invest progress</h2>
        <p className="empty-state">Once you invest some money, your progress will show up here.</p>
      </section>
    );
  }

  const maxValue = Math.max(...series.map((p) => p.total), 1);
  const barWidth = (WIDTH - BAR_GAP * (series.length - 1)) / series.length;
  const last = series[series.length - 1];

  return (
    <section className="chart-section">
      <h2>Invest progress</h2>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        role="img"
        aria-label="Invest balance over time, contribution vs match"
      >
        {series.map((point, i) => {
          const contributedHeight = Math.max((point.contributed / maxValue) * (HEIGHT - 4), point.contributed > 0 ? 1 : 0);
          const matchedHeight = Math.max((point.matched / maxValue) * (HEIGHT - 4), point.matched > 0 ? 1 : 0);
          const x = i * (barWidth + BAR_GAP);
          const contributedY = HEIGHT - contributedHeight;
          const matchedY = contributedY - matchedHeight;
          return (
            <g key={point.id}>
              <rect
                x={x}
                y={contributedY}
                width={barWidth}
                height={contributedHeight}
                className="chart-bar-invest-contributed"
              />
              <rect
                x={x}
                y={matchedY}
                width={barWidth}
                height={matchedHeight}
                className="chart-bar-invest-matched"
              />
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        <span><i className="legend-swatch legend-contributed" /> You put in</span>
        <span><i className="legend-swatch legend-matched" /> Matched</span>
      </div>
      <div className="chart-footer">
        <span>{formatDate(series[0].date)}</span>
        <span className="chart-current">{formatMoney(last.total)}</span>
        <span>{formatDate(last.date)}</span>
      </div>
    </section>
  );
}
