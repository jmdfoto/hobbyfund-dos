// Parses the file produced by the app's "Export CSV" button (src/lib/csv.js) back into
// ledger transactions. Used once, to move the ledger off the old localStorage-only site.

import { getBalances } from "../src/lib/ledger.js";

const MAX_ROWS = 20000;
const EXPECTED_HEADER = ["Date", "Type", "Bucket", "Amount", "Note"];
const TYPES = new Set(["allowance", "purchase", "transfer", "invest", "match"]);
const BUCKETS = new Set(["spend", "save", "invest"]);

// RFC 4180-style: quoted fields may contain commas, newlines and doubled quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

// Returns { ok: true, transactions } (oldest first) or { ok: false, error }.
export function transactionsFromCsv(text) {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length === 0) return { ok: false, error: "The file is empty." };

  const header = rows[0].map((h) => h.trim());
  if (header.join(",") !== EXPECTED_HEADER.join(",")) {
    return { ok: false, error: "This doesn't look like a HobbyFund CSV export (unexpected header)." };
  }
  const dataRows = rows.slice(1);
  if (dataRows.length === 0) return { ok: false, error: "The file has no transactions." };
  if (dataRows.length > MAX_ROWS) return { ok: false, error: "The file has too many rows." };

  const transactions = [];
  for (let i = 0; i < dataRows.length; i++) {
    const line = i + 2;
    const [date, type, bucket, amountStr, note = ""] = dataRows[i];
    if (dataRows[i].length !== 5) return { ok: false, error: `Row ${line}: expected 5 columns.` };
    if (Number.isNaN(Date.parse(date))) return { ok: false, error: `Row ${line}: invalid date.` };
    if (!TYPES.has(type)) return { ok: false, error: `Row ${line}: unknown type "${type}".` };
    if (!BUCKETS.has(bucket)) return { ok: false, error: `Row ${line}: unknown bucket "${bucket}".` };
    if (!/^-?\d+(\.\d{1,2})?$/.test(amountStr)) {
      return { ok: false, error: `Row ${line}: invalid amount "${amountStr}".` };
    }
    const amount = Number(amountStr);
    if (bucket === "invest" && amount < 0) {
      return { ok: false, error: `Row ${line}: Invest can't have a negative amount.` };
    }
    transactions.push({
      id: crypto.randomUUID(),
      date: new Date(date).toISOString(),
      type,
      bucket,
      amount,
      note,
    });
  }

  // The export lists newest first; reversing restores the original ledger order exactly,
  // including entries that share a timestamp (an invest's transfer/invest/match triple).
  transactions.reverse();

  const balances = getBalances(transactions);
  if (balances.spend < 0 || balances.save < 0) {
    return { ok: false, error: "The file's balances don't add up (Spend or Save would be negative)." };
  }

  return { ok: true, transactions };
}
