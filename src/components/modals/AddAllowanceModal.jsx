import { useState } from "react";
import Modal from "../Modal.jsx";
import { formatMoney } from "../../lib/format.js";

export default function AddAllowanceModal({ onConfirm, onClose }) {
  const [total, setTotal] = useState("50");
  const [spendAmount, setSpendAmount] = useState(25);
  const [error, setError] = useState("");

  const totalNum = Number(total) || 0;
  const saveAmount = Math.max(0, totalNum - spendAmount);

  function handleTotalChange(value) {
    setTotal(value);
    const t = Number(value) || 0;
    // Keep the split proportional-ish: default to an even split whenever total changes.
    setSpendAmount(Math.min(spendAmount, t) || t / 2);
  }

  function handleSliderChange(value) {
    const clamped = Math.min(Math.max(Number(value), 0), totalNum);
    setSpendAmount(clamped);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (totalNum <= 0) {
      setError("Enter an amount greater than $0.");
      return;
    }
    onConfirm({ spendAmount, saveAmount });
  }

  return (
    <Modal title="Add Allowance" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>Total amount</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={total}
            onChange={(e) => handleTotalChange(e.target.value)}
            autoFocus
          />
        </label>

        <div className="split-display">
          <div className="split-side">
            <span className="split-label">Spend</span>
            <span className="split-amount">{formatMoney(spendAmount)}</span>
          </div>
          <div className="split-side">
            <span className="split-label">Save</span>
            <span className="split-amount">{formatMoney(saveAmount)}</span>
          </div>
        </div>

        <input
          type="range"
          className="split-slider"
          min="0"
          max={totalNum || 0}
          step="0.01"
          value={Math.min(spendAmount, totalNum || 0)}
          onChange={(e) => handleSliderChange(e.target.value)}
          disabled={totalNum <= 0}
          aria-label="Split between Spend and Save"
        />

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block">
          Add {formatMoney(totalNum)}
        </button>
      </form>
    </Modal>
  );
}
