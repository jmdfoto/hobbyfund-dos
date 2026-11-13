import { formatMoney, formatPercentChange } from "../lib/format.js";

function InvestCardDetails({ balances, invest }) {
  // No brokerage connected (or it couldn't be reached): the original card.
  if (!invest?.connected) {
    return (
      <>
        <span className="balance-value balance-value-small">{formatMoney(balances.invest)}</span>
        <span className="balance-sub">
          You put in {formatMoney(balances.investContributed)}, matched{" "}
          {formatMoney(balances.investMatched)}
        </span>
        {invest?.brokerageError && <span className="balance-sub">{invest.brokerageError}</span>}
      </>
    );
  }

  const up = invest.gain >= 0;
  return (
    <>
      <span className="balance-value balance-value-small">{formatMoney(invest.value)}</span>
      <span className="balance-sub">
        You put in {formatMoney(invest.contributed)}, matched {formatMoney(invest.matched)}
      </span>
      {invest.deposited > 0 && (
        <span className={`balance-sub ${up ? "amount-credit" : "amount-debit"}`}>
          {up ? "Up" : "Down"} {formatMoney(Math.abs(invest.gain))}
          {invest.returnPct !== null && ` (${formatPercentChange(invest.returnPct)})`} from the market
        </span>
      )}
      {invest.pending > 0 && (
        <span className="balance-sub">{formatMoney(invest.pending)} waiting to be invested</span>
      )}
    </>
  );
}

export default function BalanceCards({ balances, invest }) {
  const totalReady = balances.spend + balances.save;

  return (
    <div className="balances">
      <p className="total-line">
        Ready to use (Spend + Save): <strong>{formatMoney(totalReady)}</strong>
      </p>

      <div className="balance-row">
        <div className="balance-card balance-spend">
          <span className="balance-label">Spend</span>
          <span className="balance-value">{formatMoney(balances.spend)}</span>
          <span className="balance-sub">Use anytime, no restrictions</span>
        </div>
        <div className="balance-card balance-save">
          <span className="balance-label">Save</span>
          <span className="balance-value">{formatMoney(balances.save)}</span>
          <span className="balance-sub">For later — movable back to Spend</span>
        </div>
      </div>

      <div className="balance-card balance-invest">
        <span className="balance-label">Invest</span>
        <InvestCardDetails balances={balances} invest={invest} />
      </div>
    </div>
  );
}
