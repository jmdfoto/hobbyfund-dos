import { useState } from "react";
import Modal from "../Modal.jsx";
import { moveMoney, getBalances } from "../../lib/ledger.js";
import { formatMoney } from "../../lib/format.js";

export default function MoveMoneyModal({ transactions, onConfirm, onClose }) {
  const [direction, setDirection] = useState("spend-to-save");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const balances = getBalances(transactions);
  const sourceLabel = direction === "spend-to-save" ? "Spend" : "Save";
  const destLabel = direction === "spend-to-save" ? "Save" : "Spend";
  const sourceBalance = direction === "spend-to-save" ? balances.spend : balances.save;

  function handleSubmit(e) {
    e.preventDefault();
    const result = moveMoney(transactions, { direction, amount });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirm(result.transactions);
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

        <button type="submit" className="btn btn-primary btn-block">
          Move Money
        </button>
      </form>
    </Modal>
  );
}
