import { useState } from "react";
import Modal from "../Modal.jsx";
import { getBalances } from "../../lib/ledger.js";
import { formatMoney } from "../../lib/format.js";

export default function MoveMoneyModal({ transactions, onConfirm, onClose }) {
  const [direction, setDirection] = useState("spend-to-save");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const balances = getBalances(transactions);
  const sourceLabel = direction === "spend-to-save" ? "Spend" : "Save";
  const destLabel = direction === "spend-to-save" ? "Save" : "Spend";
  const sourceBalance = direction === "spend-to-save" ? balances.spend : balances.save;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const result = await onConfirm({ type: "move", direction, amount });
    setSubmitting(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <Modal title="Move Money" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <div className="direction-toggle">
          <button
            type="button"
            className={`toggle-btn ${direction === "spend-to-save" ? "active" : ""}`}
            onClick={() => setDirection("spend-to-save")}
          >
            Spend → Save
          </button>
          <button
            type="button"
            className={`toggle-btn ${direction === "save-to-spend" ? "active" : ""}`}
            onClick={() => setDirection("save-to-spend")}
          >
            Save → Spend
          </button>
        </div>

        <p className="hint-text">
          {sourceLabel} available: {formatMoney(sourceBalance)}
        </p>

        <label className="field">
          <span>
            Amount to move ({sourceLabel} → {destLabel})
          </span>
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

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          Move Money
        </button>
      </form>
    </Modal>
  );
}
