import { useState } from "react";
import Modal from "../Modal.jsx";
import { formatMoney } from "../../lib/format.js";

// Parent-only: records that real money was moved into the brokerage account. Nothing here moves
// money — it only tells the app that the parent already did.
export default function RecordDepositModal({ pending, onConfirm, onClose }) {
  const [amount, setAmount] = useState(pending.toFixed(2));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const result = await onConfirm({ amount, note });
    setSubmitting(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <Modal title="Record a Deposit" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <p className="hint-text">
          Only record this after you've actually moved real money into the investment account.
          This doesn't move any money by itself.
        </p>
        <p className="hint-text">Waiting to be invested: {formatMoney(pending)}</p>

        <label className="field">
          <span>Amount deposited</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            max={pending}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </label>

        <label className="field">
          <span>Note (optional)</span>
          <input
            type="text"
            placeholder="Bank transfer"
            maxLength={100}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          Record {formatMoney(Number(amount) || 0)} deposit
        </button>
      </form>
    </Modal>
  );
}
