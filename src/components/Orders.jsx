import { useEffect, useState } from "react";
import { fetchOrders } from "../lib/api.js";
import { formatMoney, formatShares, formatDateTime } from "../lib/format.js";

const STATUS_LABELS = {
  pending_submit: "Sending…",
  submitted: "Waiting for the market",
  unknown: "Checking…",
  filled: "Done",
  canceled: "Canceled",
  expired: "Expired",
  rejected: "Not accepted",
  failed: "Didn't go through",
};

function orderAmount(o) {
  if (o.status === "filled" && o.filledAvgPrice) return formatMoney(o.filledQty * o.filledAvgPrice);
  if (o.amount != null) return formatMoney(o.amount);
  return `${formatShares(o.qty)} shares`;
}

// Recent buy/sell orders, visible to parent and child. Re-reads when refreshKey changes.
export default function Orders({ refreshKey }) {
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchOrders().then((r) => {
      if (!cancelled && r.ok) setOrders(r.orders);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!orders || orders.length === 0) return null;

  return (
    <section className="history">
      <h2>Orders</h2>
      <ul className="history-list">
        {orders.map((o) => (
          <li key={o.id} className="history-row">
            <div className="history-main">
              <span className="history-note">
                {o.side === "buy" ? "Buy" : "Sell"} {o.symbol}
              </span>
              <span className="history-meta">
                <span className="history-date">
                  {STATUS_LABELS[o.status] ?? o.status} · {formatDateTime(o.createdAt)}
                </span>
              </span>
            </div>
            <span className={`history-amount ${o.side === "buy" ? "amount-debit" : "amount-credit"}`}>
              {orderAmount(o)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
