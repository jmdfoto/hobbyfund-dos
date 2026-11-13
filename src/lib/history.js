// Builds the Invest performance chart series. Pure: no network, no storage.
//
// Each point carries two numbers on the same dollar scale:
//   value     — what the portfolio was worth that day
//   deposited — real money moved in by then (a step line on the chart)
// The gap between them is market gain/loss, so a deposit raises both lines together and never
// shows up as a gain.

export const RANGES = ["1W", "1M", "3M", "1Y", "ALL"];

const cents = (dollars) => Math.round(dollars * 100);

// Market dates are New York dates (YYYY-MM-DD).
export function nyDate(isoOrDate) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoOrDate));
}

function rangeStartDate(range, now) {
  const d = new Date(now);
  if (range === "1W") d.setUTCDate(d.getUTCDate() - 7);
  else if (range === "1M") d.setUTCMonth(d.getUTCMonth() - 1);
  else if (range === "3M") d.setUTCMonth(d.getUTCMonth() - 3);
  else if (range === "1Y") d.setUTCFullYear(d.getUTCFullYear() - 1);
  else return null; // ALL
  return nyDate(d);
}

// deposits: [{ date (ISO), amountCents }] oldest first → cents deposited by end of `day`.
function depositedBy(deposits, day) {
  return deposits.reduce((sum, d) => (nyDate(d.date) <= day ? sum + d.amountCents : sum), 0);
}

export function buildPerformanceSeries({
  range,
  now = new Date(),
  current, // { value, deposited } in dollars — today's live numbers
  deposits,
  brokerPoints, // [{ day (YYYY-MM-DD), equity }] — live accounts only; null/[] when unavailable
  snapshots, // [{ date (YYYY-MM-DD), valueCents, depositedCents }]
}) {
  if (!RANGES.includes(range)) throw new Error(`Unknown range ${range}`);
  if (deposits.length === 0) return { points: [], marketGain: 0, source: "none" };

  const firstDay = nyDate(deposits[0].date);
  const today = nyDate(now);

  // Prefer the broker's own daily history; fall back to our stored daily snapshots.
  const useBroker = Array.isArray(brokerPoints) && brokerPoints.length > 0;
  const byDay = new Map();
  if (useBroker) {
    for (const p of brokerPoints) {
      const day = p.day;
      byDay.set(day, { valueCents: cents(p.equity), depositedCents: depositedBy(deposits, day) });
    }
  } else {
    for (const s of snapshots) {
      byDay.set(s.date, { valueCents: s.valueCents, depositedCents: s.depositedCents });
    }
  }
  // Today always reflects the live numbers.
  byDay.set(today, { valueCents: cents(current.value), depositedCents: cents(current.deposited) });

  const all = [...byDay.entries()]
    .filter(([day]) => day >= firstDay && day <= today)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, v]) => ({ date: day, ...v }));

  const start = rangeStartDate(range, now);
  const inRange = start ? all.filter((p) => p.date >= start) : all;
  // Gain is measured from the last point before the range (or from zero, before any money).
  const before = start ? all.filter((p) => p.date < start) : [];
  const baseline = before.length ? before[before.length - 1] : { valueCents: 0, depositedCents: 0 };
  const end = inRange[inRange.length - 1] ?? baseline;
  const marketGainCents =
    end.valueCents - baseline.valueCents - (end.depositedCents - baseline.depositedCents);

  return {
    points: inRange.map((p) => ({
      date: p.date,
      value: p.valueCents / 100,
      deposited: p.depositedCents / 100,
    })),
    marketGain: marketGainCents / 100,
    source: useBroker ? "broker" : "snapshots",
  };
}
