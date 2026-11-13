// Loads Connor's current portfolio (ledger + deposits + live brokerage data) and its history.
// Shared by GET /api/invest, GET /api/invest/history and the daily snapshot cron.

import { CHILD_ID, loadState, loadDeposits } from "./store.js";
import { getBrokerage } from "./brokerage/index.js";
import { computePortfolio } from "../src/lib/portfolio.js";
import { buildPerformanceSeries, nyDate } from "../src/lib/history.js";

const BROKERAGE_CACHE_MS = 30 * 1000;
const HISTORY_CACHE_MS = 5 * 60 * 1000;

// Per-isolate caches so page loads don't hammer the broker's rate limit.
let brokerageCache = null; // { mode, at, data }
let historyCache = null; // { mode, start, at, points }

export function clearBrokerageCache() {
  brokerageCache = null;
}

async function fetchBrokerage(provider) {
  if (
    brokerageCache &&
    brokerageCache.mode === provider.mode &&
    Date.now() - brokerageCache.at < BROKERAGE_CACHE_MS
  ) {
    return brokerageCache.data;
  }
  const [account, positions, activities] = await Promise.all([
    provider.getAccount(),
    provider.getPositions(),
    provider.getActivities(),
  ]);
  const data = { mode: provider.mode, account, positions, activities };
  brokerageCache = { mode: provider.mode, at: Date.now(), data };
  return data;
}

export async function loadPortfolio(env, familyId) {
  const [state, deposits] = await Promise.all([
    loadState(env, familyId),
    loadDeposits(env, familyId),
  ]);
  const provider = getBrokerage(env);
  let brokerage = null;
  let brokerageError = null;
  if (provider) {
    try {
      brokerage = await fetchBrokerage(provider);
    } catch (err) {
      console.error(err);
      brokerageError = "Couldn't reach the investment account right now.";
    }
  }
  const portfolio = computePortfolio({ transactions: state.transactions, deposits, brokerage });
  return { provider, deposits, portfolio, brokerageError };
}

async function loadSnapshots(env, familyId, mode) {
  const { results } = await env.DB.prepare(
    `SELECT date, value_cents, deposited_cents FROM portfolio_snapshots
     WHERE family_id = ? AND child_id = ? AND mode = ? ORDER BY date`
  )
    .bind(familyId, CHILD_ID, mode)
    .all();
  return results.map((r) => ({
    date: r.date,
    valueCents: r.value_cents,
    depositedCents: r.deposited_cents,
  }));
}

// The broker's own equity history is only Connor's in a live account, which holds nothing else.
// A paper account's history includes its pretend starting cash, so paper uses snapshots only.
async function loadBrokerHistory(provider, start) {
  if (provider.mode !== "live") return null;
  if (
    historyCache &&
    historyCache.mode === provider.mode &&
    historyCache.start === start &&
    Date.now() - historyCache.at < HISTORY_CACHE_MS
  ) {
    return historyCache.points;
  }
  try {
    const points = await provider.getPortfolioHistory({ start, timeframe: "1D" });
    historyCache = { mode: provider.mode, start, at: Date.now(), points };
    return points;
  } catch (err) {
    console.error(err);
    return null; // fall back to snapshots
  }
}

export async function loadHistory(env, familyId, range) {
  const { provider, deposits, portfolio } = await loadPortfolio(env, familyId);
  if (!portfolio.connected) return { connected: false };

  const firstDeposit = deposits[0]?.date ?? null;
  const [snapshots, brokerPoints] = await Promise.all([
    loadSnapshots(env, familyId, provider.mode),
    firstDeposit ? loadBrokerHistory(provider, nyDate(firstDeposit)) : null,
  ]);
  return {
    connected: true,
    range,
    ...buildPerformanceSeries({
      range,
      current: { value: portfolio.value, deposited: portfolio.deposited },
      deposits,
      brokerPoints,
      snapshots,
    }),
  };
}

// Daily cron: store today's closing value for every family, so the chart keeps its history
// even if the broker's history is unavailable. Re-running on the same day just overwrites.
export async function recordDailySnapshots(env, now = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(now);
  if (weekday === "Sat" || weekday === "Sun") return;

  const { results: families } = await env.DB.prepare(
    "SELECT DISTINCT family_id FROM settings WHERE child_id = ?"
  )
    .bind(CHILD_ID)
    .all();

  for (const { family_id: familyId } of families) {
    const { provider, portfolio } = await loadPortfolio(env, familyId);
    // Skip when disconnected or unreachable — a missing day is better than a wrong one.
    if (!portfolio.connected || portfolio.deposited <= 0) continue;
    await env.DB.prepare(
      `INSERT INTO portfolio_snapshots (family_id, child_id, mode, date, value_cents, deposited_cents)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (family_id, child_id, mode, date)
       DO UPDATE SET value_cents = excluded.value_cents, deposited_cents = excluded.deposited_cents`
    )
      .bind(
        familyId,
        CHILD_ID,
        provider.mode,
        nyDate(now),
        Math.round(portfolio.value * 100),
        Math.round(portfolio.deposited * 100)
      )
      .run();
  }
}
