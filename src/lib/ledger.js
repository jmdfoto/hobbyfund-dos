// Pure ledger engine. No side effects, no storage access.
// Balances are always derived from the transaction list — never stored independently.

export const DEFAULT_MATCH_RATIO = 1.0;

export function createInitialState() {
  return {
    kidName: "Collector",
    matchRatio: DEFAULT_MATCH_RATIO,
    transactions: [],
  };
}

function makeId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function makeTx({ type, bucket, amount, note, date }) {
  return {
    id: makeId(),
    date: date ?? new Date().toISOString(),
    type,
    bucket,
    amount: round2(amount),
    note,
  };
}

// --- Balance derivation ---

function sumBucket(transactions, bucket) {
  return round2(
    transactions
      .filter((tx) => tx.bucket === bucket)
      .reduce((total, tx) => total + tx.amount, 0)
  );
}

export function getBalances(transactions) {
  const spend = sumBucket(transactions, "spend");
  const save = sumBucket(transactions, "save");
  const invest = sumBucket(transactions, "invest");
  const investContributed = round2(
    transactions
      .filter((tx) => tx.bucket === "invest" && tx.type === "invest")
      .reduce((total, tx) => total + tx.amount, 0)
  );
  const investMatched = round2(
    transactions
      .filter((tx) => tx.bucket === "invest" && tx.type === "match")
      .reduce((total, tx) => total + tx.amount, 0)
  );
  return { spend, save, invest, investContributed, investMatched };
}

// --- Actions ---
// Each action validates against current transactions and returns either
// { ok: true, transactions: newFullList } or { ok: false, error: string }.

export function addAllowance(transactions, { spendAmount, saveAmount }) {
  const spend = round2(Number(spendAmount) || 0);
  const save = round2(Number(saveAmount) || 0);

  if (spend <= 0 && save <= 0) {
    return { ok: false, error: "Enter an amount greater than $0." };
  }

  const date = new Date().toISOString();
  const newTxs = [];
  if (spend > 0) {
    newTxs.push(
      makeTx({ type: "allowance", bucket: "spend", amount: spend, note: "Allowance", date })
    );
  }
  if (save > 0) {
    newTxs.push(
      makeTx({ type: "allowance", bucket: "save", amount: save, note: "Allowance", date })
    );
  }

  return { ok: true, transactions: [...transactions, ...newTxs] };
}

export function logPurchase(transactions, { amount, note }) {
  const amt = round2(Number(amount) || 0);
  const trimmedNote = (note ?? "").trim();

  if (amt <= 0) {
    return { ok: false, error: "Enter an amount greater than $0." };
  }
  if (!trimmedNote) {
    return { ok: false, error: "Enter a description for this purchase." };
  }

  const { spend } = getBalances(transactions);
  if (amt > spend) {
    return {
      ok: false,
      error: `Not enough in Spend — $${spend.toFixed(2)} available.`,
    };
  }

  const tx = makeTx({ type: "purchase", bucket: "spend", amount: -amt, note: trimmedNote });
  return { ok: true, transactions: [...transactions, tx] };
}

export function moveMoney(transactions, { direction, amount }) {
  const amt = round2(Number(amount) || 0);
  if (amt <= 0) {
    return { ok: false, error: "Enter an amount greater than $0." };
  }

  const source = direction === "spend-to-save" ? "spend" : "save";
  const destination = direction === "spend-to-save" ? "save" : "spend";
  const balances = getBalances(transactions);
  const sourceBalance = balances[source];

  if (amt > sourceBalance) {
    const label = source === "spend" ? "Spend" : "Save";
    return {
      ok: false,
      error: `Not enough in ${label} — $${sourceBalance.toFixed(2)} available.`,
    };
  }

  const date = new Date().toISOString();
  const destLabel = destination === "save" ? "Save" : "Spend";
  const srcLabel = source === "save" ? "Save" : "Spend";
  const debit = makeTx({
    type: "transfer",
    bucket: source,
    amount: -amt,
    note: `Moved to ${destLabel}`,
    date,
  });
  const credit = makeTx({
    type: "transfer",
    bucket: destination,
    amount: amt,
    note: `Moved from ${srcLabel}`,
    date,
  });

  return { ok: true, transactions: [...transactions, debit, credit] };
}

export function invest(transactions, { source, amount, matchRatio }) {
  const amt = round2(Number(amount) || 0);
  if (amt <= 0) {
    return { ok: false, error: "Enter an amount greater than $0." };
  }
  if (source !== "spend" && source !== "save") {
    return { ok: false, error: "Choose Spend or Save as the source." };
  }

  const balances = getBalances(transactions);
  const sourceBalance = balances[source];
  if (amt > sourceBalance) {
    const label = source === "spend" ? "Spend" : "Save";
    return {
      ok: false,
      error: `Not enough in ${label} — $${sourceBalance.toFixed(2)} available.`,
    };
  }

  const ratio = Number(matchRatio ?? DEFAULT_MATCH_RATIO);
  const matchAmount = round2(amt * ratio);
  const srcLabel = source === "spend" ? "Spend" : "Save";
  const date = new Date().toISOString();

  const debit = makeTx({
    type: "transfer",
    bucket: source,
    amount: -amt,
    note: "Moved to Invest",
    date,
  });
  const contribution = makeTx({
    type: "invest",
    bucket: "invest",
    amount: amt,
    note: `Invested from ${srcLabel}`,
    date,
  });
  const match = makeTx({
    type: "match",
    bucket: "invest",
    amount: matchAmount,
    note: `Parent match (${ratio}:1)`,
    date,
  });

  return { ok: true, transactions: [...transactions, debit, contribution, match] };
}

// --- Chart helpers ---

// Running cumulative sum of a bucket's transactions in date order.
// Returns [{ date, value }] — one point per transaction, oldest first.
export function cumulativeSeries(transactions, bucket) {
  const sorted = transactions
    .filter((tx) => tx.bucket === bucket)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let running = 0;
  return sorted.map((tx) => {
    running = round2(running + tx.amount);
    return { date: tx.date, value: running, id: tx.id };
  });
}

// Running cumulative contribution vs match for the invest bucket.
export function investSeries(transactions) {
  const sorted = transactions
    .filter((tx) => tx.bucket === "invest")
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let contributed = 0;
  let matched = 0;
  return sorted.map((tx) => {
    if (tx.type === "invest") contributed = round2(contributed + tx.amount);
    if (tx.type === "match") matched = round2(matched + tx.amount);
    return { date: tx.date, contributed, matched, total: round2(contributed + matched), id: tx.id };
  });
}
