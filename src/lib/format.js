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
