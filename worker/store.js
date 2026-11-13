// D1 access for the ledger and brokerage deposits. The rules live in src/lib/ledger.js and run here unchanged;
// this module only loads state, and writes new entries + an audit row atomically.

export const CHILD_ID = "default";

export class ConflictError extends Error {}
export class DuplicateRequestError extends Error {}

function toCents(amount) {
  return Math.round(amount * 100);
}

export async function loadDeposits(env, familyId) {
  const { results } = await env.DB.prepare(
    `SELECT id, date, amount_cents, note FROM brokerage_deposits
     WHERE family_id = ? AND child_id = ? AND deleted_at IS NULL ORDER BY date, created_at`
  )
    .bind(familyId, CHILD_ID)
    .all();
  return results.map((r) => ({
    id: r.id,
    date: r.date,
    amountCents: r.amount_cents,
    note: r.note,
  }));
}

export async function loadState(env, familyId) {
  const settings = await env.DB.prepare(
    "SELECT kid_name, match_ratio, ledger_version FROM settings WHERE family_id = ? AND child_id = ?"
  )
    .bind(familyId, CHILD_ID)
    .first();
  if (!settings) throw new Error(`No settings row for family ${familyId}`);

  const { results } = await env.DB.prepare(
    `SELECT id, date, type, bucket, amount_cents, note FROM ledger_transactions
     WHERE family_id = ? AND child_id = ? AND deleted_at IS NULL ORDER BY seq`
  )
    .bind(familyId, CHILD_ID)
    .all();

  return {
    kidName: settings.kid_name,
    matchRatio: settings.match_ratio,
    version: settings.ledger_version,
    transactions: results.map((r) => ({
      id: r.id,
      date: r.date,
      type: r.type,
      bucket: r.bucket,
      amount: r.amount_cents / 100,
      note: r.note,
    })),
  };
}

// Every statement is guarded on the ledger version the caller validated against, and D1 runs a
// batch as one transaction. If another write landed in between, nothing is applied and we throw
// ConflictError so the caller can re-validate. A reused requestId violates audit_log's UNIQUE
// constraint, rolling the whole batch back.
export async function commitLedgerWrite(env, {
  familyId,
  version,
  actorEmail,
  action,
  requestId,
  details,
  newTransactions = [],
  newDeposits = [],
  softDeleteAll = false,
}) {
  const db = env.DB;
  const guard = "(SELECT ledger_version FROM settings WHERE family_id = ? AND child_id = ?) = ?";
  const guardArgs = [familyId, CHILD_ID, version];
  const now = new Date().toISOString();

  const statements = [
    db.prepare(
      `INSERT INTO audit_log (actor_email, action, request_id, details)
       SELECT ?, ?, ?, ? WHERE ${guard}`
    ).bind(actorEmail, action, requestId ?? null, JSON.stringify(details ?? null), ...guardArgs),
  ];

  if (softDeleteAll) {
    statements.push(
      db.prepare(
        `UPDATE ledger_transactions SET deleted_at = ?
         WHERE family_id = ? AND child_id = ? AND deleted_at IS NULL AND ${guard}`
      ).bind(now, familyId, CHILD_ID, ...guardArgs)
    );
  }

  for (const tx of newTransactions) {
    statements.push(
      db.prepare(
        `INSERT INTO ledger_transactions
           (id, family_id, child_id, seq, date, type, bucket, amount_cents, note, created_by)
         SELECT ?, ?, ?,
           (SELECT COALESCE(MAX(seq), 0) + 1 FROM ledger_transactions WHERE family_id = ? AND child_id = ?),
           ?, ?, ?, ?, ?, ?
         WHERE ${guard}`
      ).bind(
        tx.id,
        familyId,
        CHILD_ID,
        familyId,
        CHILD_ID,
        tx.date,
        tx.type,
        tx.bucket,
        toCents(tx.amount),
        tx.note ?? "",
        actorEmail,
        ...guardArgs
      )
    );
  }

  // Deposits share the ledger version guard: "pending" depends on both tables, so a deposit
  // is validated against the same snapshot of the ledger it's recorded with.
  for (const d of newDeposits) {
    statements.push(
      db.prepare(
        `INSERT INTO brokerage_deposits (id, family_id, child_id, date, amount_cents, note, created_by)
         SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`
      ).bind(d.id, familyId, CHILD_ID, d.date, d.amountCents, d.note ?? "", actorEmail, ...guardArgs)
    );
  }

  statements.push(
    db.prepare(
      `UPDATE settings SET ledger_version = ledger_version + 1
       WHERE family_id = ? AND child_id = ? AND ledger_version = ?`
    ).bind(...guardArgs)
  );

  let results;
  try {
    results = await db.batch(statements);
  } catch (err) {
    if (/UNIQUE constraint failed: audit_log\.request_id/.test(String(err?.message ?? err))) {
      throw new DuplicateRequestError();
    }
    throw err;
  }

  if (results[results.length - 1].meta.changes !== 1) throw new ConflictError();
}

export async function updateKidName(env, { familyId, actorEmail, kidName }) {
  await env.DB.batch([
    env.DB.prepare("UPDATE settings SET kid_name = ? WHERE family_id = ? AND child_id = ?").bind(
      kidName,
      familyId,
      CHILD_ID
    ),
    env.DB.prepare(
      "INSERT INTO audit_log (actor_email, action, details) VALUES (?, 'settings.kidName', ?)"
    ).bind(actorEmail, JSON.stringify({ kidName })),
  ]);
}
