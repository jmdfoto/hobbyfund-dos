// Pure portfolio math, shared by the Worker. Works in integer cents to avoid float drift.
//
// Three separate amounts, never added on top of each other:
//   allocated  = everything in the Invest bucket (contributions + parent match) — virtual
//   deposited  = real money the parent recorded moving into the brokerage account
//   pending    = allocated − deposited: set aside but not yet moved
// The brokerage value replaces `deposited` in totals; it is never added to `allocated`.
// Gains are measured against `deposited`, so adding money never shows up as a gain.

import { getBalances } from "./ledger.js";

const cents = (dollars) => Math.round(dollars * 100);
const dollars = (c) => c / 100;

// Paper accounts start with pretend cash and can't receive deposits, so the account's own
// cash is meaningless there; Connor's cash is what was deposited, less net trading, plus
// dividends. Live accounts hold only Connor's money, so their real cash is used.
function paperCashCents(depositedCents, activities) {
  let c = depositedCents;
  for (const a of activities) {
    if (a.kind === "fill") {
      const value = cents(a.qty * a.price);
      c += a.side === "sell" ? value : -value;
    } else if (a.kind === "dividend") {
      c += cents(a.amount);
    }
  }
  return c;
}

export function computePortfolio({ transactions, deposits, brokerage }) {
  const { investContributed, investMatched } = getBalances(transactions);
  const allocatedCents = cents(investContributed) + cents(investMatched);
  const depositedCents = deposits.reduce((sum, d) => sum + d.amountCents, 0);
  const pendingCents = Math.max(0, allocatedCents - depositedCents);

  const base = {
    contributed: investContributed,
    matched: investMatched,
    allocated: dollars(allocatedCents),
    deposited: dollars(depositedCents),
    pending: dollars(pendingCents),
  };
  if (!brokerage) return { connected: false, ...base };

  // Only stocks and ETFs count toward Connor's portfolio.
  const holdings = brokerage.positions
    .filter((p) => p.assetClass === "us_equity")
    .map((p) => ({
      symbol: p.symbol,
      qty: p.qty,
      price: p.currentPrice,
      value: p.marketValue,
      gain: p.unrealizedPl,
    }))
    .sort((a, b) => b.value - a.value);

  const positionsCents = holdings.reduce((sum, h) => sum + cents(h.value), 0);
  const cashCents =
    brokerage.mode === "paper"
      ? paperCashCents(depositedCents, brokerage.activities)
      : cents(brokerage.account.cash);
  const valueCents = positionsCents + cashCents;
  const gainCents = valueCents - depositedCents;

  return {
    connected: true,
    mode: brokerage.mode,
    ...base,
    cash: dollars(cashCents),
    value: dollars(valueCents),
    gain: dollars(gainCents),
    // Simple return: gain ÷ money actually put into the account.
    returnPct: depositedCents > 0 ? gainCents / depositedCents : null,
    holdings,
  };
}
