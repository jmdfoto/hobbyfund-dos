import { formatMoney } from "../lib/format.js";

export default function BalanceCards({ balances }) {
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
        <span className="balance-value balance-value-small">{formatMoney(balances.invest)}</span>
        <span className="balance-sub">
          You put in {formatMoney(balances.investContributed)}, matched{" "}
          {formatMoney(balances.investMatched)}
        </span>
      </div>
    </div>
  );
}
