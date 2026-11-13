// Alpaca Trading API provider. Translates Alpaca's responses into the normalized shapes
// documented in ./index.js, so nothing outside this file depends on Alpaca's field names.

import { nyDate } from "../../src/lib/history.js";

const BASE_URLS = {
  paper: "https://paper-api.alpaca.markets",
  live: "https://api.alpaca.markets",
};

const DATA_URL = "https://data.alpaca.markets";
const MAX_ACTIVITY_PAGES = 10;
const ORDER_TIMEOUT_MS = 15 * 1000;

// Broker answered with an error status: the request definitely did or didn't happen as the
// status says. Anything else (network failure, timeout) means the outcome is unknown.
export class BrokerHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function createAlpacaProvider({ mode, keyId, secretKey }) {
  const baseUrl = BASE_URLS[mode];
  if (!baseUrl) throw new Error(`Unknown Alpaca mode: ${mode}`);

  async function request(url, { method = "GET", body, timeoutMs } = {}) {
    const res = await fetch(url, {
      method,
      headers: {
        "APCA-API-KEY-ID": keyId,
        "APCA-API-SECRET-KEY": secretKey,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = text.slice(0, 300);
      try {
        message = JSON.parse(text).message ?? message;
      } catch {
        // not JSON
      }
      throw new BrokerHttpError(res.status, message);
    }
    return res.json();
  }

  const get = (path) => request(`${baseUrl}${path}`);

  function normalizeOrder(o) {
    return {
      id: o.id,
      clientOrderId: o.client_order_id,
      symbol: o.symbol,
      side: o.side,
      status: o.status,
      notional: o.notional == null ? null : num(o.notional),
      qty: o.qty == null ? null : num(o.qty),
      filledQty: num(o.filled_qty),
      filledAvgPrice: o.filled_avg_price == null ? null : num(o.filled_avg_price),
      submittedAt: o.submitted_at,
      filledAt: o.filled_at,
    };
  }

  return {
    name: "alpaca",
    mode,

    async getAccount() {
      const a = await get("/v2/account");
      return {
        status: a.status,
        currency: a.currency,
        cash: num(a.cash),
        equity: num(a.equity),
        buyingPower: num(a.buying_power),
      };
    },

    async getPositions() {
      const positions = await get("/v2/positions");
      return positions.map((p) => ({
        symbol: p.symbol,
        assetClass: p.asset_class,
        qty: num(p.qty),
        currentPrice: num(p.current_price),
        marketValue: num(p.market_value),
        costBasis: num(p.cost_basis),
        unrealizedPl: num(p.unrealized_pl),
      }));
    },

    // Trade fills and dividends, oldest first.
    async getActivities() {
      const all = [];
      let pageToken = null;
      for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
        const params = new URLSearchParams({
          activity_types: "FILL,DIV",
          direction: "asc",
          page_size: "100",
        });
        if (pageToken) params.set("page_token", pageToken);
        const batch = await get(`/v2/account/activities?${params}`);
        if (!Array.isArray(batch) || batch.length === 0) break;
        all.push(...batch);
        if (batch.length < 100) break;
        pageToken = batch[batch.length - 1].id;
      }
      return all.map((a) =>
        a.activity_type === "FILL"
          ? {
              kind: "fill",
              id: a.id,
              date: a.transaction_time,
              symbol: a.symbol,
              side: a.side === "sell" || a.side === "sell_short" ? "sell" : "buy",
              qty: num(a.qty),
              price: num(a.price),
            }
          : {
              kind: "dividend",
              id: a.id,
              date: a.date,
              symbol: a.symbol,
              amount: num(a.net_amount),
            }
      );
    },

    async getOrders({ limit = 50 } = {}) {
      const orders = await get(`/v2/orders?status=all&direction=desc&limit=${limit}&nested=false`);
      return orders.map(normalizeOrder);
    },

    // Returns null when the broker has no order with this id (it never arrived).
    async getOrderByClientId(clientOrderId) {
      try {
        const params = new URLSearchParams({ client_order_id: clientOrderId });
        return normalizeOrder(await get(`/v2/orders:by_client_order_id?${params}`));
      } catch (err) {
        if (err instanceof BrokerHttpError && err.status === 404) return null;
        throw err;
      }
    },

    async getAsset(symbol) {
      try {
        const a = await get(`/v2/assets/${encodeURIComponent(symbol)}`);
        return {
          symbol: a.symbol,
          name: a.name,
          assetClass: a.class,
          tradable: Boolean(a.tradable) && a.status === "active",
          fractionable: Boolean(a.fractionable),
        };
      } catch (err) {
        if (err instanceof BrokerHttpError && (err.status === 404 || err.status === 422)) return null;
        throw err;
      }
    },

    async getLatestPrice(symbol) {
      const t = await request(
        `${DATA_URL}/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=iex`
      );
      return num(t.trade?.p);
    },

    async getClock() {
      const c = await get("/v2/clock");
      return { isOpen: Boolean(c.is_open), nextOpen: c.next_open };
    },

    // Daily account equity from `start` (YYYY-MM-DD) to now, for the performance chart.
    async getPortfolioHistory({ start, timeframe = "1D" }) {
      const params = new URLSearchParams({ timeframe, start: `${start}T00:00:00Z` });
      const h = await get(`/v2/account/portfolio/history?${params}`);
      // Daily bars are stamped at the start of the day; shifting to midday before taking the
      // New York date gives the right market day whether that's New York or UTC midnight.
      return (h.timestamp ?? []).map((t, i) => ({
        day: nyDate((t + 12 * 60 * 60) * 1000),
        equity: num(h.equity?.[i]),
      }));
    },

    // Market order for a dollar amount (`notional`) or a share quantity (`qty`, for selling
    // a whole holding). Fractional orders must be day orders. Throws BrokerHttpError when the
    // broker refuses; any other error means the outcome is unknown.
    async submitOrder({ symbol, side, notional, qty, clientOrderId }) {
      const body = {
        symbol,
        side,
        type: "market",
        time_in_force: "day",
        client_order_id: clientOrderId,
        ...(notional != null ? { notional: notional.toFixed(2) } : { qty: String(qty) }),
      };
      return normalizeOrder(
        await request(`${baseUrl}/v2/orders`, { method: "POST", body, timeoutMs: ORDER_TIMEOUT_MS })
      );
    },
  };
}
