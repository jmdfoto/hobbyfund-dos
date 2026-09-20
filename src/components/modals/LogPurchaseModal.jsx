import { useState } from "react";
import Modal from "../Modal.jsx";
import { logPurchase } from "../../lib/ledger.js";

export default function LogPurchaseModal({ transactions, onConfirm, onClose }) {
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const result = logPurchase(transactions, { amount, note });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirm(result.transactions);
  }

  return (
    <Modal title="Log a Purchase" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>What did you buy?</span>
          <input
            type="text"
            placeholder="Booster pack"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
        </label>

        <label className="field">
          <span>Amount</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block">
          Log Purchase
        </button>
      </form>
    </Modal>
  );
}
