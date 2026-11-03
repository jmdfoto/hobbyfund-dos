// HobbyFund API. Static files are served by Workers assets; only /api/* reaches this code
// (see run_worker_first in wrangler.jsonc).

import { addAllowance, logPurchase, moveMoney, invest } from "../src/lib/ledger.js";
import { authenticate, loadUser } from "./auth.js";
import {
  loadState,
  commitLedgerWrite,
  updateKidName,
  ConflictError,
  DuplicateRequestError,
} from "./store.js";
import { transactionsFromCsv } from "./csvImport.js";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_NAME_LENGTH = 40;
const CONFLICT_RETRIES = 3;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function error(status, message) {
  return json({ ok: false, error: message }, status);
}

function publicState(state, user) {
  return {
    kidName: state.kidName,
    matchRatio: state.matchRatio,
    transactions: state.transactions,
    role: user.role,
  };
}

async function readJson(request) {
  // Requiring a JSON content type means a cross-site HTML form can't trigger writes.
  if (!(request.headers.get("Content-Type") ?? "").startsWith("application/json")) return null;
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > MAX_BODY_BYTES) return null;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isValidRequestId(id) {
  return typeof id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(id);
}

// Runs the same pure ledger rules the browser uses, against the server's current ledger.
function applyAction(transactions, action, matchRatio) {
  switch (action?.type) {
    case "allowance":
      return addAllowance(transactions, {
        spendAmount: action.spendAmount,
        saveAmount: action.saveAmount,
      });
    case "purchase":
      return logPurchase(transactions, { amount: action.amount, note: action.note });
    case "move":
      if (action.direction !== "spend-to-save" && action.direction !== "save-to-spend") {
        return { ok: false, error: "Choose a direction." };
      }
      return moveMoney(transactions, { direction: action.direction, amount: action.amount });
    case "invest":
      // matchRatio comes from settings, never from the client.
      return invest(transactions, { source: action.source, amount: action.amount, matchRatio });
    default:
      return { ok: false, error: "Unknown action." };
  }
}

// Validates against the latest ledger and commits; on a concurrent write, re-reads and retries.
// `build(state)` returns { ok, error } or { ok: true, newTransactions, softDeleteAll, details }.
async function writeWithRetry(env, user, { action, requestId, build }) {
  for (let attempt = 0; attempt < CONFLICT_RETRIES; attempt++) {
    const state = await loadState(env, user.familyId);
    const plan = build(state);
    if (!plan.ok) return error(400, plan.error);
    try {
      await commitLedgerWrite(env, {
        familyId: user.familyId,
        version: state.version,
        actorEmail: user.email,
        action,
        requestId,
        details: plan.details,
        newTransactions: plan.newTransactions,
        softDeleteAll: plan.softDeleteAll,
      });
      const fresh = await loadState(env, user.familyId);
      return json({ ok: true, state: publicState(fresh, user) });
    } catch (err) {
      if (err instanceof DuplicateRequestError) {
        // Already applied (double-submit or retry) — report the current state as success.
        const fresh = await loadState(env, user.familyId);
        return json({ ok: true, duplicate: true, state: publicState(fresh, user) });
      }
      if (!(err instanceof ConflictError)) throw err;
    }
  }
  return error(409, "Someone else changed the ledger at the same time. Please try again.");
}

async function handleApi(request, env, url) {
  const email = await authenticate(request, env);
  if (!email) return error(401, "Not signed in.");
  const user = await loadUser(env, email);
  if (!user) return error(403, "This account hasn't been given access to HobbyFund.");

  const route = `${request.method} ${url.pathname}`;

  if (route === "GET /api/me") {
    return json({ ok: true, email: user.email, role: user.role });
  }

  if (route === "GET /api/state") {
    const state = await loadState(env, user.familyId);
    return json({ ok: true, state: publicState(state, user) });
  }

  if (request.method !== "GET" && user.role !== "parent") {
    return error(403, "Only a parent can make changes.");
  }

  if (route === "POST /api/actions") {
    const body = await readJson(request);
    if (!body || !isValidRequestId(body.requestId)) return error(400, "Invalid request.");
    const { action } = body;
    return writeWithRetry(env, user, {
      action: `ledger.${action?.type ?? "unknown"}`,
      requestId: body.requestId,
      build(state) {
        const result = applyAction(state.transactions, action, state.matchRatio);
        if (!result.ok) return result;
        return {
          ok: true,
          newTransactions: result.transactions.slice(state.transactions.length),
          details: { action },
        };
      },
    });
  }

  if (route === "PUT /api/settings") {
    const body = await readJson(request);
    const kidName = typeof body?.kidName === "string" ? body.kidName.trim() : "";
    if (!kidName || kidName.length > MAX_NAME_LENGTH) return error(400, "Enter a name.");
    await updateKidName(env, { familyId: user.familyId, actorEmail: user.email, kidName });
    const state = await loadState(env, user.familyId);
    return json({ ok: true, state: publicState(state, user) });
  }

  if (route === "POST /api/import") {
    const body = await readJson(request);
    if (!body || !isValidRequestId(body.requestId) || typeof body.csv !== "string") {
      return error(400, "Invalid request.");
    }
    const parsed = transactionsFromCsv(body.csv);
    if (!parsed.ok) return error(400, parsed.error);
    return writeWithRetry(env, user, {
      action: "ledger.import",
      requestId: body.requestId,
      build(state) {
        // Import only into an empty ledger, so it can never merge or double up.
        if (state.transactions.length > 0) {
          return { ok: false, error: "Import only works on an empty ledger." };
        }
        return {
          ok: true,
          newTransactions: parsed.transactions,
          details: { rows: parsed.transactions.length },
        };
      },
    });
  }

  if (route === "POST /api/reset") {
    const body = await readJson(request);
    if (!body || !isValidRequestId(body.requestId)) return error(400, "Invalid request.");
    return writeWithRetry(env, user, {
      action: "ledger.reset",
      requestId: body.requestId,
      // Soft delete: rows stay in the database (and the audit log) but drop out of the ledger.
      build: (state) => ({
        ok: true,
        softDeleteAll: true,
        details: { clearedRows: state.transactions.length },
      }),
    });
  }

  return error(404, "Not found.");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, env, url);
    } catch (err) {
      console.error(err);
      return error(500, "Something went wrong on the server.");
    }
  },
};
