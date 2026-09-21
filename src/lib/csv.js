function escapeCsvField(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function transactionsToCsv(transactions) {
  const header = ["Date", "Type", "Bucket", "Amount", "Note"];
  // Most recent first, matching what's shown on screen.
  const rows = transactions
    .slice()
    .reverse()
    .map((tx) => [tx.date, tx.type, tx.bucket, tx.amount.toFixed(2), tx.note]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\n");
}

export function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
