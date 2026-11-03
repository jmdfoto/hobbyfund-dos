import { useState } from "react";
import Modal from "../Modal.jsx";

export default function LogPurchaseModal({ onConfirm, onClose }) {
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const result = await onConfirm({ type: "purchase", amount, note });
    setSubmitting(false);
    if (!result.ok) setError(result.error);
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

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          Log Purchase
        </button>
      </form>
    </Modal>
  );
}
