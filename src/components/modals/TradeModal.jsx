import { useState } from "react";
import Modal from "../Modal.jsx";
import { fetchQuote } from "../../lib/api.js";
import { formatMoney, formatShares, formatDateTime } from "../../lib/format.js";

// Low-cost index funds offered as one-tap picks; any stock or ETF can still be typed in.
const SUGGESTIONS = ["VTI", "VOO", "VXUS", "QQQ"];

function resultMessage(order) {
  if (order.status === "filled") {
    const verb = order.side === "buy" ? "Bought" : "Sold";
    return `${verb} ${formatShares(order.filledQty)} shares of ${order.symbol} at ${formatMoney(order.filledAvgPrice)}.`;
  }
  if (order.status === "rejected" || order.status === "failed") {
    return `The order didn't go through: ${order.error ?? "no reason given"}.`;
  }
  if (order.status === "unknown") {
    return "The order was sent, but the answer got lost. Check Orders in a minute — it won't be sent twice.";
  }
  return "Order sent. It will finish when the market fills it — check Orders for the result.";
}

// Parent only. Step 1: what to trade. Step 2: review with a live price. Step 3: the result.
export default function TradeModal({ holdings, limits, onConfirm, onClose }) {
  const [side, setSide] = useState("buy");
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [sellAll, setSellAll] = useState(false);
  const [quote, setQuote] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const amountNum = Number(amount) || 0;
  const picks = side === "buy" ? SUGGESTIONS : holdings.map((h) => h.symbol);

  async function handleReview(e) {
    e.preventDefault();
    setError("");
    if (!symbol.trim()) {
      setError("Choose what to buy or sell.");
      return;
    }
    if (!(side === "sell" && sellAll) && amountNum < 1) {
      setError("Enter at least $1.00.");
      return;
    }
    setBusy(true);
    const r = await fetchQuote(symbol.trim());
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setQuote(r.quote);
  }

  async function handlePlace() {
    setBusy(true);
    setError("");
    const r = await onConfirm({
      side,
      symbol: quote.symbol,
      amount: side === "sell" && sellAll ? null : amountNum.toFixed(2),
      sellAll: side === "sell" && sellAll,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setResult(r.order);
  }

  if (result) {
    return (
      <Modal title="Order" onClose={onClose}>
        <div className="form">
          <p>{resultMessage(result)}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  if (quote) {
    const tradeValue = side === "sell" && sellAll ? quote.holding?.value ?? 0 : amountNum;
    const shares = quote.price > 0 ? tradeValue / quote.price : 0;
    const cashAfter = side === "buy" ? quote.availableCash - tradeValue : quote.availableCash + tradeValue;
    return (
      <Modal title="Review order" onClose={onClose}>
        <div className="form">
          <p className="review-headline">
            {side === "buy" ? "Buy" : "Sell"}{" "}
            {side === "sell" && sellAll ? "all" : formatMoney(tradeValue)} of {quote.symbol}
          </p>
          <p className="hint-text">{quote.name}</p>
          <dl className="review-list">
            <dt>Price now</dt>
            <dd>{formatMoney(quote.price)} per share</dd>
            <dt>About</dt>
            <dd>{formatShares(shares)} shares</dd>
            <dt>Cash available</dt>
            <dd>{formatMoney(quote.availableCash)}</dd>
            <dt>Cash after</dt>
            <dd>about {formatMoney(Math.max(0, cashAfter))}</dd>
          </dl>
          {!quote.marketOpen && (
            <p className="hint-text">
              The market is closed. This order will be filled when it opens
              {quote.nextOpen ? ` (${formatDateTime(quote.nextOpen)})` : ""}, at that price.
            </p>
          )}
          {error && <p className="error-text">{error}</p>}
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handlePlace}
            disabled={busy}
          >
            {busy ? "Placing…" : "Place order"}
          </button>
          <button
            type="button"
            className="reset-all-link"
            onClick={() => setQuote(null)}
            disabled={busy}
          >
            Back
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Buy or Sell" onClose={onClose}>
      <form onSubmit={handleReview} className="form">
        <div className="direction-toggle">
          <button
            type="button"
            className={`toggle-btn ${side === "buy" ? "active" : ""}`}
            onClick={() => {
              setSide("buy");
              setSellAll(false);
            }}
          >
            Buy
          </button>
          <button
            type="button"
            className={`toggle-btn ${side === "sell" ? "active" : ""}`}
            onClick={() => setSide("sell")}
            disabled={holdings.length === 0}
          >
            Sell
          </button>
        </div>

        {picks.length > 0 && (
          <div className="symbol-picks">
            {picks.map((s) => (
              <button
                key={s}
                type="button"
                className={`toggle-btn ${symbol.toUpperCase() === s ? "active" : ""}`}
                onClick={() => setSymbol(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span>{side === "buy" ? "Stock or ETF symbol" : "What to sell"}</span>
          <input
            type="text"
            placeholder="VTI"
            autoCapitalize="characters"
            autoComplete="off"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
        </label>

        {side === "sell" && (
          <label className="checkbox-field">
            <input type="checkbox" checked={sellAll} onChange={(e) => setSellAll(e.target.checked)} />
            <span>Sell all of it</span>
          </label>
        )}

        {!(side === "sell" && sellAll) && (
          <label className="field">
            <span>Amount in dollars</span>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              placeholder="5.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        )}

        {side === "buy" && (
          <p className="hint-text">
            Up to {formatMoney(limits.perOrderCents / 100)} per purchase and{" "}
            {formatMoney(limits.dailyBuyCents / 100)} per day.
          </p>
        )}
        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Checking price…" : "Review"}
        </button>
      </form>
    </Modal>
  );
}
