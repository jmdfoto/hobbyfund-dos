// Parent-placed orders: validation, limits, duplicate protection and broker sync.
//
// Order of operations for every order:
//   1. validate (symbol, asset, amount, cash, holding, limits)
//   2. INSERT the order row as pending_submit — guarded in SQL on the daily limit, available
//      cash and "no other order in flight", so concurrent requests can't both pass
//   3. send to the broker with that row's client_order_id
//   4. record the broker's answer; if the answer is lost, mark it unknown and let sync resolve
//      it by client_order_id — never resend blindly.

import { CHILD_ID } from "./store.js";
import { BrokerHttpError } from "./brokerage/index.js";
import { loadPortfolio, clearBrokerageCache } from "./portfolio.js";
import { nyDate } from "../src/lib/history.js";

const MIN_ORDER_CENTS = 100; // broker minimum for dollar orders
const IN_FLIGHT_STALE_MS = 2 * 60 * 1000;
const OPEN_STATUSES = ["pending_submit", "submitted", "unknown"];
// Orders that never spent money don't count toward the daily limit.
const NOT_SPENT_STATUSES = ["rejected", "failed", "canceled", "expired"];
const SYMBOL_RE = /^[A-Z][A-Z.]{0,9}$/;

export class OrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function orderLimits(env) {
  return {
    perOrderCents: Number(env.ORDER_MAX_CENTS ?? 5000),
    dailyBuyCents: Number(env.DAILY_BUY_MAX_CENTS ?? 10000),
  };
}

export function assertCanTrade(env, provider) {
  if (!provider) throw new OrderError(409, "No investment account is connected.");
  if (provider.mode === "live" && env.LIVE_ORDERS_ENABLED !== "true") {
    throw new OrderError(403, "Trading in the real account is switched off.");
  }
}

function cleanSymbol(raw) {
  const symbol = String(raw ?? "").trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) throw new OrderError(400, "Enter a stock or ETF symbol, like VTI.");
  return symbol;
}

async function tradableAsset(provider, symbol) {
  const asset = await provider.getAsset(symbol);
  if (!asset) throw new OrderError(400, `Couldn't find ${symbol}.`);
  if (asset.assetClass !== "us_equity") throw new OrderError(400, "Only stocks and ETFs can be bought.");
  if (!asset.tradable) throw new OrderError(400, `${symbol} can't be traded right now.`);
  if (!asset.fractionable) {
    throw new OrderError(400, `${symbol} can't be bought in dollar amounts. Try another one.`);
  }
  return asset;
}

async function openBuyCents(env, familyId, mode) {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(notional_cents), 0) AS cents FROM order_requests
     WHERE family_id = ? AND child_id = ? AND mode = ? AND side = 'buy'
       AND status IN (${OPEN_STATUSES.map(() => "?").join(",")})`
  )
    .bind(familyId, CHILD_ID, mode, ...OPEN_STATUSES)
    .first();
  return row.cents;
}

// Everything the confirmation screen shows. Parent only.
export async function getQuote(env, user, provider, { symbol: rawSymbol }) {
  assertCanTrade(env, provider);
  const symbol = cleanSymbol(rawSymbol);
  const asset = await tradableAsset(provider, symbol);
  const [price, clock, { portfolio }, openCents] = await Promise.all([
    provider.getLatestPrice(symbol),
    provider.getClock(),
    loadPortfolio(env, user.familyId),
    openBuyCents(env, user.familyId, provider.mode),
  ]);
  const holding = portfolio.holdings?.find((h) => h.symbol === symbol) ?? null;
  return {
    symbol,
    name: asset.name,
    price,
    marketOpen: clock.isOpen,
    nextOpen: clock.nextOpen,
    availableCash: Math.max(0, Math.round(portfolio.cash * 100) - openCents) / 100,
    holding: holding ? { qty: holding.qty, value: holding.value } : null,
    limits: orderLimits(env),
  };
}

function toCents(value) {
  const str = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return null;
  return Math.round(Number(str) * 100);
}

function statusFromBroker(brokerStatus) {
  if (["filled", "canceled", "expired", "rejected"].includes(brokerStatus)) return brokerStatus;
  return "submitted";
}

async function recordBrokerOrder(env, id, order) {
  await env.DB.prepare(
    `UPDATE order_requests SET status = ?, broker_order_id = ?, broker_status = ?, filled_qty = ?,
       filled_avg_price = ?, error = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  )
    .bind(
      statusFromBroker(order.status),
      order.id,
      order.status,
      String(order.filledQty ?? 0),
      order.filledAvgPrice == null ? null : String(order.filledAvgPrice),
      id
    )
    .run();
}

async function setStatus(env, id, status, errorMessage = null) {
  await env.DB.prepare(
    `UPDATE order_requests SET status = ?, error = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  )
    .bind(status, errorMessage, id)
    .run();
}

async function audit(env, actorEmail, action, details) {
  await env.DB.prepare("INSERT INTO audit_log (actor_email, action, details) VALUES (?, ?, ?)")
    .bind(actorEmail, action, JSON.stringify(details))
    .run();
}

async function loadOrderRow(env, where, ...args) {
  return env.DB.prepare(`SELECT * FROM order_requests WHERE ${where}`)
    .bind(...args)
    .first();
}

export function publicOrder(row) {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    amount: row.notional_cents == null ? null : row.notional_cents / 100,
    qty: row.qty == null ? null : Number(row.qty),
    status: row.status,
    filledQty: row.filled_qty == null ? 0 : Number(row.filled_qty),
    filledAvgPrice: row.filled_avg_price == null ? null : Number(row.filled_avg_price),
    error: row.error,
    createdAt: row.created_at,
  };
}

export async function placeOrder(env, user, provider, body) {
  assertCanTrade(env, provider);
  const requestId = body?.requestId;
  if (typeof requestId !== "string" || !/^[A-Za-z0-9-]{8,48}$/.test(requestId)) {
    throw new OrderError(400, "Invalid request.");
  }
  // A repeat of an order already recorded returns that order — it is never placed twice.
  const existing = await loadOrderRow(env, "client_order_id = ?", requestId);
  if (existing) return publicOrder(existing);

  const side = body.side === "sell" ? "sell" : body.side === "buy" ? "buy" : null;
  if (!side) throw new OrderError(400, "Choose buy or sell.");
  const symbol = cleanSymbol(body.symbol);
  await tradableAsset(provider, symbol);

  const limits = orderLimits(env);
  clearBrokerageCache(); // validate against fresh cash and holdings
  const { portfolio } = await loadPortfolio(env, user.familyId);
  if (!portfolio.connected) throw new OrderError(503, "Couldn't reach the investment account.");
  const cashCents = Math.round(portfolio.cash * 100);

  let notionalCents = null;
  let qty = null;
  if (side === "sell" && body.sellAll === true) {
    const holding = portfolio.holdings.find((h) => h.symbol === symbol);
    if (!holding) throw new OrderError(400, `Connor doesn't own any ${symbol}.`);
    qty = String(holding.qty);
  } else {
    notionalCents = toCents(body.amount);
    if (!notionalCents || notionalCents < MIN_ORDER_CENTS) {
      throw new OrderError(400, "Enter at least $1.00.");
    }
    if (side === "buy" && notionalCents > limits.perOrderCents) {
      throw new OrderError(400, `The most for one purchase is $${(limits.perOrderCents / 100).toFixed(2)}.`);
    }
    if (side === "sell") {
      const holding = portfolio.holdings.find((h) => h.symbol === symbol);
      if (!holding) throw new OrderError(400, `Connor doesn't own any ${symbol}.`);
      if (notionalCents > Math.round(holding.value * 100)) {
        throw new OrderError(400, `Connor's ${symbol} is worth $${holding.value.toFixed(2)}.`);
      }
    }
  }

  const marketDate = nyDate(new Date());
  if (side === "buy") {
    // Friendly up-front checks; the guarded INSERT below re-checks atomically.
    const openCents = await openBuyCents(env, user.familyId, provider.mode);
    if (notionalCents > cashCents - openCents) {
      throw new OrderError(
        400,
        `Only $${(Math.max(0, cashCents - openCents) / 100).toFixed(2)} of cash is available to buy with.`
      );
    }
    const spent = await env.DB.prepare(
      `SELECT COALESCE(SUM(notional_cents), 0) AS cents FROM order_requests
       WHERE family_id = ? AND child_id = ? AND mode = ? AND side = 'buy' AND market_date = ?
         AND status NOT IN (${NOT_SPENT_STATUSES.map(() => "?").join(",")})`
    )
      .bind(user.familyId, CHILD_ID, provider.mode, marketDate, ...NOT_SPENT_STATUSES)
      .first();
    if (spent.cents + notionalCents > limits.dailyBuyCents) {
      throw new OrderError(
        400,
        `That would pass today's $${(limits.dailyBuyCents / 100).toFixed(2)} limit ($${(spent.cents / 100).toFixed(2)} bought so far).`
      );
    }
  }

  // Insert, guarded in one statement so the checks and the write can't be split by another
  // request: no other order in flight, and (for buys) under the daily limit and within cash.
  const id = crypto.randomUUID();
  const staleBefore = new Date(Date.now() - IN_FLIGHT_STALE_MS).toISOString();
  const buyGuards =
    side === "buy"
      ? `AND (SELECT COALESCE(SUM(notional_cents), 0) FROM order_requests
              WHERE family_id = ?1 AND child_id = ?2 AND mode = ?3 AND side = 'buy' AND market_date = ?4
                AND status NOT IN (${NOT_SPENT_STATUSES.map((s) => `'${s}'`).join(",")})) + ?5 <= ?6
         AND (SELECT COALESCE(SUM(notional_cents), 0) FROM order_requests
              WHERE family_id = ?1 AND child_id = ?2 AND mode = ?3 AND side = 'buy'
                AND status IN (${OPEN_STATUSES.map((s) => `'${s}'`).join(",")})) + ?5 <= ?7`
      : "";
  let result;
  try {
    result = await env.DB.prepare(
      `INSERT INTO order_requests (id, family_id, child_id, mode, client_order_id, symbol, side,
         notional_cents, qty, status, market_date, requested_by)
       SELECT ?8, ?1, ?2, ?3, ?9, ?10, ?11, ?12, ?13, 'pending_submit', ?4, ?14
       WHERE NOT EXISTS (SELECT 1 FROM order_requests
                         WHERE family_id = ?1 AND child_id = ?2 AND status = 'pending_submit'
                           AND created_at > ?15)
       ${buyGuards}`
    )
      .bind(
        user.familyId, // ?1
        CHILD_ID, // ?2
        provider.mode, // ?3
        marketDate, // ?4
        notionalCents ?? 0, // ?5
        limits.dailyBuyCents, // ?6
        cashCents, // ?7
        id, // ?8
        requestId, // ?9
        symbol, // ?10
        side, // ?11
        notionalCents, // ?12
        qty, // ?13
        user.email, // ?14
        staleBefore // ?15
      )
      .run();
  } catch (err) {
    if (/UNIQUE constraint failed: order_requests\.client_order_id/.test(String(err?.message ?? err))) {
      return publicOrder(await loadOrderRow(env, "client_order_id = ?", requestId));
    }
    throw err;
  }
  if (result.meta.changes !== 1) {
    // Another order landed between the checks above and this insert.
    throw new OrderError(409, "Another order is being placed right now. Try again in a moment.");
  }
  await audit(env, user.email, "order.request", {
    id, clientOrderId: requestId, mode: provider.mode, symbol, side, notionalCents, qty,
  });

  try {
    const order = await provider.submitOrder({
      symbol,
      side,
      notional: notionalCents == null ? null : notionalCents / 100,
      qty,
      clientOrderId: requestId,
    });
    await recordBrokerOrder(env, id, order);
    await audit(env, user.email, "order.submitted", { id, brokerOrderId: order.id, status: order.status });
  } catch (err) {
    if (err instanceof BrokerHttpError) {
      // Broker refused: nothing was placed.
      await setStatus(env, id, "rejected", err.message);
      await audit(env, user.email, "order.rejected", { id, status: err.status, message: err.message });
    } else {
      // Outcome unknown (network/timeout): ask the broker by our id rather than resending.
      const found = await provider.getOrderByClientId(requestId).catch(() => null);
      if (found) {
        await recordBrokerOrder(env, id, found);
        await audit(env, user.email, "order.submitted", { id, brokerOrderId: found.id, recovered: true });
      } else {
        await setStatus(env, id, "unknown", "Waiting to confirm with the investment account.");
        await audit(env, user.email, "order.unknown", { id, message: String(err?.message ?? err) });
      }
    }
  }
  clearBrokerageCache();
  return publicOrder(await loadOrderRow(env, "id = ?", id));
}

// Refreshes orders that aren't final yet from the broker, then lists recent orders.
export async function listOrders(env, familyId, provider) {
  if (!provider) return [];
  const { results: open } = await env.DB.prepare(
    `SELECT * FROM order_requests WHERE family_id = ? AND child_id = ? AND mode = ?
       AND status IN (${OPEN_STATUSES.map(() => "?").join(",")})`
  )
    .bind(familyId, CHILD_ID, provider.mode, ...OPEN_STATUSES)
    .all();

  let changed = false;
  for (const row of open) {
    try {
      const found = await provider.getOrderByClientId(row.client_order_id);
      if (found) {
        await recordBrokerOrder(env, row.id, found);
        changed = true;
      } else if (Date.parse(row.created_at) < Date.now() - IN_FLIGHT_STALE_MS) {
        // The broker never received it.
        await setStatus(env, row.id, "failed", "This order didn't reach the investment account.");
        changed = true;
      }
    } catch (err) {
      console.error(err);
    }
  }
  if (changed) clearBrokerageCache();

  const { results } = await env.DB.prepare(
    `SELECT * FROM order_requests WHERE family_id = ? AND child_id = ? AND mode = ?
     ORDER BY created_at DESC LIMIT 20`
  )
    .bind(familyId, CHILD_ID, provider.mode)
    .all();
  return results.map(publicOrder);
}
