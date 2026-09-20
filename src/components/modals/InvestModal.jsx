import { useState } from "react";
import Modal from "../Modal.jsx";
import { invest, getBalances } from "../../lib/ledger.js";
import { formatMoney } from "../../lib/format.js";

export default function InvestModal({ transactions, matchRatio, onConfirm, onClose }) {
  const [source, setSource] = useState("spend");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const balances = getBalances(transactions);
  const sourceBalance = source === "spend" ? balances.spend : balances.save;
  const amountNum = Number(amount) || 0;
  const matchPreview = amountNum > 0 ? amountNum * matchRatio : 0;

  function handleSubmit(e) {
    e.preventDefault();
    const result = invest(transactions, { source, amount, matchRatio });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirm(result.transactions);
  }

  return (
    <Modal title="Invest" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <p className="hint-text">
          Once money moves to Invest, it can't come back to Spend or Save — this is a one-way move.
        </p>

        <div className="direction-toggle">
          <button
            type="button"
            className={`toggle-btn ${source === "spend" ? "active" : ""}`}
            onClick={() => setSource("spend")}
          >
            From Spend
          </button>
          <button
            type="button"
            className={`toggle-btn ${source === "save" ? "active" : ""}`}
            onClick={() => setSource("save")}
          >
            From Save
          </button>
        </div>

        <p className="hint-text">
          {source === "spend" ? "Spend" : "Save"} available: {formatMoney(sourceBalance)}
        </p>

        <label className="field">
          <span>Amount to invest</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </label>

        {amountNum > 0 && (
          <p className="hint-text match-preview">
            You put in {formatMoney(amountNum)}, parent matches {formatMoney(matchPreview)} → Invest
            grows by {formatMoney(amountNum + matchPreview)}.
          </p>
        )}

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block">
          Invest
        </button>
      </form>
    </Modal>
  );
}
