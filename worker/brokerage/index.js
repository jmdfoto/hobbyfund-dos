// Brokerage abstraction. The rest of the app talks to a provider through these methods only,
// so adding another broker means writing one more provider file, not changing callers.
//
//   getAccount()      → { status, currency, cash, equity, buyingPower }
//   getPositions()    → [{ symbol, assetClass, qty, currentPrice, marketValue, costBasis, unrealizedPl }]
//   getActivities()   → oldest first: { kind: "fill", id, date, symbol, side, qty, price }
//                                   | { kind: "dividend", id, date, symbol, amount }
//   getOrders()       → [{ id, clientOrderId, symbol, side, status, notional, qty, ... }]
//   getPortfolioHistory({ start, timeframe }) → [{ day, equity }]  (YYYY-MM-DD market days)
//   getOrderByClientId(id) → order | null
//   getAsset(symbol)  → { symbol, name, assetClass, tradable, fractionable } | null
//   getLatestPrice(symbol) → number
//   getClock()        → { isOpen, nextOpen }
//   submitOrder({ symbol, side, notional | qty, clientOrderId }) → order
//
// Which account to use is chosen by BROKERAGE_MODE ("paper" | "live"); each mode has its own
// keys, stored as Worker secrets (never in wrangler.jsonc or the browser bundle).

import { createAlpacaProvider } from "./alpaca.js";

// Thrown when the broker answers with an error status (the request was refused). Any other
// error from a provider means the outcome is unknown.
export { BrokerHttpError } from "./alpaca.js";

export function getBrokerage(env) {
  const mode = env.BROKERAGE_MODE;
  if (mode === "paper" && env.ALPACA_PAPER_KEY_ID && env.ALPACA_PAPER_SECRET_KEY) {
    return createAlpacaProvider({
      mode,
      keyId: env.ALPACA_PAPER_KEY_ID,
      secretKey: env.ALPACA_PAPER_SECRET_KEY,
    });
  }
  if (mode === "live" && env.ALPACA_LIVE_KEY_ID && env.ALPACA_LIVE_SECRET_KEY) {
    return createAlpacaProvider({
      mode,
      keyId: env.ALPACA_LIVE_KEY_ID,
      secretKey: env.ALPACA_LIVE_SECRET_KEY,
    });
  }
  return null;
}
