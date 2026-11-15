// HobbyFund API. Static files are served by Workers assets; only /api/* reaches this code
// (see run_worker_first in wrangler.jsonc).

import { addAllowance, logPurchase, moveMoney, invest } from "../src/lib/ledger.js";
import { authenticate, loadUser } from "./auth.js";
import {
  loadState,
  loadDeposits,
  commitLedgerWrite,
  updateKidName,
  updateMatchRatio,
  ConflictError,
  DuplicateRequestError,
} from "./store.js";
import { transactionsFromCsv } from "./csvImport.js";
import { computePortfolio } from "../src/lib/portfolio.js";
import { RANGES } from "../src/lib/history.js";
import { loadPortfolio, loadHistory, recordDailySnapshots } from "./portfolio.js";
import { getBrokerage } from "./brokerage/index.js";
import { getQuote, placeOrder, listOrders, orderLimits, assertCanTrade, OrderError } from "./orders.js";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_NAME_LENGTH = 40;
const MATCH_RATIOS = [0, 0.5, 1];
const CONFLICT_RETRIES = 3;
const MAX_NOTE_LENGTH = 100;
function toCents(value) {
  const str = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return null;
  return Math.round(Number(str) * 100);
}

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
    const deposits = await loadDeposits(env, user.familyId);
    const plan = build(state, deposits);
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
        newDeposits: plan.newDeposits,
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

  if (route === "GET /api/invest") {
    const { provider, deposits, portfolio, brokerageError } = await loadPortfolio(env, user.familyId);
    let tradingEnabled = true;
    try {
      assertCanTrade(env, provider);
    } catch {
      tradingEnabled = false;
    }
    return json({
      ok: true,
      invest: {
        ...portfolio,
        brokerageError,
        tradingEnabled,
        limits: orderLimits(env),
        deposits: deposits.map((d) => ({
          id: d.id,
          date: d.date,
          amount: d.amountCents / 100,
          note: d.note,
        })),
      },
    });
  }

  if (route === "GET /api/invest/history") {
    const range = url.searchParams.get("range") ?? "1M";
    if (!RANGES.includes(range)) return error(400, "Unknown range.");
    return json({ ok: true, history: await loadHistory(env, user.familyId, range) });
  }

  if (route === "GET /api/orders") {
    return json({ ok: true, orders: await listOrders(env, user.familyId, getBrokerage(env)) });
  }

  if (route === "GET /api/quote") {
    if (user.role !== "parent") return error(403, "Only a parent can place orders.");
    try {
      const quote = await getQuote(env, user, getBrokerage(env), {
        symbol: url.searchParams.get("symbol"),
      });
      return json({ ok: true, quote });
    } catch (err) {
      if (err instanceof OrderError) return error(err.status, err.message);
      throw err;
    }
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

  if (route === "POST /api/deposits") {
    const body = await readJson(request);
    if (!body || !isValidRequestId(body.requestId)) return error(400, "Invalid request.");
    const amountCents = toCents(body.amount);
    if (!amountCents) return error(400, "Enter an amount greater than $0.");
    const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE_LENGTH) : "";
    return writeWithRetry(env, user, {
      action: "brokerage.deposit",
      requestId: body.requestId,
      build(state, deposits) {
        const { pending } = computePortfolio({ transactions: state.transactions, deposits, brokerage: null });
        const pendingCents = Math.round(pending * 100);
        if (amountCents > pendingCents) {
          return {
            ok: false,
            error: `Only $${(pendingCents / 100).toFixed(2)} is waiting to be invested.`,
          };
        }
        return {
          ok: true,
          newDeposits: [{ id: crypto.randomUUID(), date: new Date().toISOString(), amountCents, note }],
          details: { amountCents, note },
        };
      },
    });
  }

  if (route === "POST /api/orders") {
    const body = await readJson(request);
    if (!body) return error(400, "Invalid request.");
    try {
      return json({ ok: true, order: await placeOrder(env, user, getBrokerage(env), body) });
    } catch (err) {
      if (err instanceof OrderError) return error(err.status, err.message);
      throw err;
    }
  }

  if (route === "PUT /api/settings") {
    const body = await readJson(request);
    if (body?.matchRatio !== undefined) {
      const matchRatio = Number(body.matchRatio);
      if (!MATCH_RATIOS.includes(matchRatio)) return error(400, "Choose a match of 0%, 50% or 100%.");
      await updateMatchRatio(env, { familyId: user.familyId, actorEmail: user.email, matchRatio });
    } else {
      const kidName = typeof body?.kidName === "string" ? body.kidName.trim() : "";
      if (!kidName || kidName.length > MAX_NAME_LENGTH) return error(400, "Enter a name.");
      await updateKidName(env, { familyId: user.familyId, actorEmail: user.email, kidName });
    }
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
      build: (state, deposits) =>
        // Once real money has gone into the brokerage, wiping the ledger would make the
        // records disagree with the account, so reset is refused.
        deposits.length > 0
          ? { ok: false, error: "Reset is turned off once real money has been deposited." }
          : { ok: true, softDeleteAll: true, details: { clearedRows: state.transactions.length } },
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

  // Cron (see triggers in wrangler.jsonc): after the US market close, store each family's
  // portfolio value for the performance chart.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(recordDailySnapshots(env));
  },
};
