// Client for the Cloudflare Worker API (worker/index.js).
//
// The same build also runs on the old Netlify site, which has no API: there, /api/* falls through
// to index.html, so a non-JSON response means "no backend" and the app keeps using localStorage.

const SIGN_IN_EXPIRED = "Your sign-in expired. Reload the page to sign in again.";

function isJson(res) {
  return (res.headers.get("Content-Type") ?? "").includes("application/json");
}

// Resolves to one of:
//   { mode: "server", state }   signed in, backend available
//   { mode: "local" }           no backend (old Netlify site) — use localStorage
//   { mode: "signin" }          Access session missing/expired
//   { mode: "forbidden", error }
//   { mode: "error", error }
export async function connect() {
  let res;
  try {
    // manual: when the Access session has expired, Access answers with a redirect to its login
    // page, which a fetch can't follow; a top-level reload can.
    res = await fetch("/api/state", { redirect: "manual", headers: { Accept: "application/json" } });
  } catch {
    return { mode: "error", error: "Couldn't reach HobbyFund. Check your connection and try again." };
  }
  if (res.type === "opaqueredirect" || res.status === 401) return { mode: "signin" };
  if (!isJson(res)) return { mode: "local" };

  const body = await res.json();
  if (res.status === 403) return { mode: "forbidden", error: body.error };
  if (!res.ok || !body.ok) return { mode: "error", error: body.error ?? "Something went wrong." };
  return { mode: "server", state: body.state };
}

// Resolves to { ok: true, state } or { ok: false, error }. Never throws.
export async function send(method, path, payload) {
  let res;
  try {
    res = await fetch(path, {
      method,
      redirect: "manual",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: "Couldn't reach HobbyFund. Check your connection and try again." };
  }
  if (res.type === "opaqueredirect" || res.status === 401) return { ok: false, error: SIGN_IN_EXPIRED };
  if (!isJson(res)) return { ok: false, error: "Something went wrong." };
  const body = await res.json();
  if (!res.ok || !body.ok) return { ok: false, error: body.error ?? "Something went wrong." };
  return { ok: true, state: body.state };
}

// Resolves to { ok: true, invest } or { ok: false, error }. Never throws.
export async function fetchInvest() {
  let res;
  try {
    res = await fetch("/api/invest", { redirect: "manual", headers: { Accept: "application/json" } });
  } catch {
    return { ok: false, error: "Couldn't reach HobbyFund." };
  }
  if (res.type === "opaqueredirect" || !isJson(res)) return { ok: false, error: "Not available." };
  const body = await res.json();
  if (!res.ok || !body.ok) return { ok: false, error: body.error ?? "Something went wrong." };
  return { ok: true, invest: body.invest };
}

// Resolves to { ok: true, history } or { ok: false, error }. Never throws.
export async function fetchInvestHistory(range) {
  let res;
  try {
    res = await fetch(`/api/invest/history?range=${encodeURIComponent(range)}`, {
      redirect: "manual",
      headers: { Accept: "application/json" },
    });
  } catch {
    return { ok: false, error: "Couldn't reach HobbyFund." };
  }
  if (res.type === "opaqueredirect" || !isJson(res)) return { ok: false, error: "Not available." };
  const body = await res.json();
  if (!res.ok || !body.ok) return { ok: false, error: body.error ?? "Something went wrong." };
  return { ok: true, history: body.history };
}

// GET helper for read-only endpoints. Resolves to { ok: true, body } or { ok: false, error }.
async function getJson(path) {
  let res;
  try {
    res = await fetch(path, { redirect: "manual", headers: { Accept: "application/json" } });
  } catch {
    return { ok: false, error: "Couldn't reach HobbyFund." };
  }
  if (res.type === "opaqueredirect" || !isJson(res)) return { ok: false, error: "Not available." };
  const body = await res.json();
  if (!res.ok || !body.ok) return { ok: false, error: body.error ?? "Something went wrong." };
  return { ok: true, body };
}

export async function fetchQuote(symbol) {
  const r = await getJson(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
  return r.ok ? { ok: true, quote: r.body.quote } : r;
}

export async function fetchOrders() {
  const r = await getJson("/api/orders");
  return r.ok ? { ok: true, orders: r.body.orders } : r;
}

// Resolves to { ok: true, order } or { ok: false, error }. Never throws.
export async function placeOrder(payload) {
  let res;
  try {
    res = await fetch("/api/orders", {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      ok: false,
      error: "Couldn't reach HobbyFund. Check Orders before trying again — it may have gone through.",
    };
  }
  if (res.type === "opaqueredirect" || res.status === 401) return { ok: false, error: SIGN_IN_EXPIRED };
  if (!isJson(res)) return { ok: false, error: "Something went wrong." };
  const body = await res.json();
  if (!res.ok || !body.ok) return { ok: false, error: body.error ?? "Something went wrong." };
  return { ok: true, order: body.order };
}

export function newRequestId() {
  return crypto.randomUUID();
}

export function signOut() {
  window.location.href = "/cdn-cgi/access/logout";
}
