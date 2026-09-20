import { formatSigned, formatDateTime } from "../lib/format.js";

const BUCKET_LABELS = { spend: "Spend", save: "Save", invest: "Invest" };

export default function History({ transactions }) {
  // transactions are stored oldest -> newest; show most recent first.
  const ordered = transactions.slice().reverse();

  if (ordered.length === 0) {
    return (
      <section className="history">
        <h2>History</h2>
        <p className="empty-state">No transactions yet — add your first allowance to get started.</p>
      </section>
    );
  }

  return (
    <section className="history">
      <h2>History</h2>
      <ul className="history-list">
        {ordered.map((tx) => (
          <li key={tx.id} className="history-row">
            <div className="history-main">
              <span className="history-note">
                {tx.note}
                {tx.type === "match" && <span className="badge-matched">matched</span>}
              </span>
              <span className="history-meta">
                <span className={`bucket-tag bucket-tag-${tx.bucket}`}>
                  {BUCKET_LABELS[tx.bucket]}
                </span>
                <span className="history-date">{formatDateTime(tx.date)}</span>
              </span>
            </div>
            <span className={`history-amount ${tx.amount < 0 ? "amount-debit" : "amount-credit"}`}>
              {formatSigned(tx.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
