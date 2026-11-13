import { formatMoney, formatSigned, formatShares, formatDateTime } from "../lib/format.js";

// What's actually in the investment account. Shown only once a brokerage is connected.
export default function Holdings({ invest, canRecordDeposit, onRecordDeposit, canTrade, onTrade }) {
  if (!invest?.connected) return null;

  return (
    <section className="history">
      <h2>Investments</h2>

      {invest.holdings.length === 0 ? (
        <p className="empty-state">
          {invest.deposited > 0
            ? "The money is in the account, waiting to buy its first investment."
            : "Nothing invested yet. Once money is in the account and buys something, it shows up here."}
        </p>
      ) : (
        <ul className="history-list">
          {invest.holdings.map((h) => (
            <li key={h.symbol} className="history-row">
              <div className="history-main">
                <span className="history-note">{h.symbol}</span>
                <span className="history-meta">
                  <span className="history-date">
                    {formatShares(h.qty)} shares at {formatMoney(h.price)}
                  </span>
                </span>
              </div>
              <div className="holding-amounts">
                <span className="history-amount">{formatMoney(h.value)}</span>
                <span className={`holding-gain ${h.gain < 0 ? "amount-debit" : "amount-credit"}`}>
                  {formatSigned(h.gain)}
                </span>
              </div>
            </li>
          ))}
          {invest.cash > 0 && (
            <li className="history-row">
              <div className="history-main">
                <span className="history-note">Cash</span>
                <span className="history-meta">
                  <span className="history-date">Ready to buy investments</span>
                </span>
              </div>
              <span className="history-amount">{formatMoney(invest.cash)}</span>
            </li>
          )}
        </ul>
      )}

      {invest.deposits.length > 0 && (
        <p className="hint-text">
          Money moved into the account so far: {formatMoney(invest.deposited)} (last on{" "}
          {formatDateTime(invest.deposits[invest.deposits.length - 1].date)})
        </p>
      )}

      {canTrade && invest.tradingEnabled && (invest.cash > 0 || invest.holdings.length > 0) && (
        <button type="button" className="btn btn-primary btn-block" onClick={onTrade}>
          Buy or sell
        </button>
      )}

      {canRecordDeposit && invest.pending > 0 && (
        <button type="button" className="reset-all-link" onClick={onRecordDeposit}>
          Record a deposit to the investment account
        </button>
      )}
    </section>
  );
}
