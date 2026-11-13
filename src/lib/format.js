export function formatMoney(amount) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function formatSigned(amount) {
  const sign = amount < 0 ? "-" : "+";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// 0.0312 -> "+3.1%"
export function formatPercentChange(ratio) {
  const sign = ratio < 0 ? "-" : "+";
  return `${sign}${Math.abs(ratio * 100).toFixed(1)}%`;
}

// Fractional shares: show up to 4 decimals, trimmed ("0.0123", "2").
export function formatShares(qty) {
  return Number(qty.toFixed(4)).toString();
}
