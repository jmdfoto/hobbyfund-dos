export default function ActionBar({ onAction }) {
  return (
    <div className="action-bar">
      <button type="button" className="action-btn" onClick={() => onAction("allowance")}>
        <span className="action-icon" aria-hidden="true">+</span>
        Add Allowance
      </button>
      <button type="button" className="action-btn" onClick={() => onAction("purchase")}>
        <span className="action-icon" aria-hidden="true">🛒</span>
        Log a Purchase
      </button>
      <button type="button" className="action-btn" onClick={() => onAction("move")}>
        <span className="action-icon" aria-hidden="true">⇄</span>
        Move Money
      </button>
      <button type="button" className="action-btn" onClick={() => onAction("invest")}>
        <span className="action-icon" aria-hidden="true">📈</span>
        Invest
      </button>
    </div>
  );
}
