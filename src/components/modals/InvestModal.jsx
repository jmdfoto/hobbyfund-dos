import { useState } from "react";
import Modal from "../Modal.jsx";
import { getBalances } from "../../lib/ledger.js";
import { formatMoney } from "../../lib/format.js";

const MATCH_OPTIONS = [
  { ratio: 0, label: "No match" },
  { ratio: 0.5, label: "50%" },
  { ratio: 1, label: "100%" },
];

export default function InvestModal({ transactions, matchRatio, onMatchChange, onConfirm, onClose }) {
  const [source, setSource] = useState("spend");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const balances = getBalances(transactions);
  const sourceBalance = source === "spend" ? balances.spend : balances.save;
  const amountNum = Number(amount) || 0;
  const matchPreview = amountNum > 0 ? amountNum * matchRatio : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const result = await onConfirm({ type: "invest", source, amount });
    setSubmitting(false);
    if (!result.ok) setError(result.error);
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

        <div className="field">
          <span>Parent match</span>
          <div className="direction-toggle">
            {MATCH_OPTIONS.map((o) => (
              <button
                key={o.ratio}
                type="button"
                className={`toggle-btn ${matchRatio === o.ratio ? "active" : ""}`}
                onClick={async () => {
                  setError("");
                  const r = await onMatchChange(o.ratio);
                  if (!r.ok) setError(r.error);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {amountNum > 0 && (
          <p className="hint-text match-preview">
            {matchPreview > 0
              ? `You put in ${formatMoney(amountNum)}, parent matches ${formatMoney(matchPreview)} → Invest grows by ${formatMoney(amountNum + matchPreview)}.`
              : `You put in ${formatMoney(amountNum)}, no parent match → Invest grows by ${formatMoney(amountNum)}.`}
          </p>
        )}

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          Invest
        </button>
      </form>
    </Modal>
  );
}
