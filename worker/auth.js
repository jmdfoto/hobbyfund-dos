// Identifies the caller. In production every request has already passed Cloudflare Access,
// which attaches a signed JWT; we verify it ourselves rather than trusting that Access is
// configured correctly. Fails closed: any problem means "not authenticated".

const CERT_TTL_MS = 60 * 60 * 1000;
const certCache = new Map(); // teamDomain -> { keys, fetchedAt }

function base64UrlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeJsonPart(part) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

async function getSigningKeys(teamDomain, forceRefresh) {
  const cached = certCache.get(teamDomain);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CERT_TTL_MS) return cached.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs fetch failed: ${res.status}`);
  const { keys } = await res.json();
  certCache.set(teamDomain, { keys, fetchedAt: Date.now() });
  return keys;
}

async function verifyAccessJwt(token, { teamDomain, audience }) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJsonPart(headerPart);
  const payload = decodeJsonPart(payloadPart);
  if (header.alg !== "RS256") return null;

  // Refetch once on an unknown key id, since Access rotates its signing keys.
  let jwk = (await getSigningKeys(teamDomain, false)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await getSigningKeys(teamDomain, true)).find((k) => k.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`)
  );
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) return null;
  if (payload.iss !== `https://${teamDomain}`) return null;
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now + 60) return null;
  if (typeof payload.email !== "string" || !payload.email) return null;

  return payload.email;
}

function isLocalRequest(request) {
  const { hostname } = new URL(request.url);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

// Returns the caller's email, or null.
export async function authenticate(request, env) {
  // Local development only: .dev.vars sets DEV_AUTH_EMAIL. Honored only on localhost and only
  // while Access isn't configured, so it can't apply in production even if the var leaks there.
  if (env.DEV_AUTH_EMAIL && !env.ACCESS_AUD && isLocalRequest(request)) return env.DEV_AUTH_EMAIL;

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;
  try {
    return await verifyAccessJwt(token, {
      teamDomain: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
    });
  } catch {
    return null;
  }
}

// Looks up the caller's role. Access decides who may log in; this table decides what they can do.
export async function loadUser(env, email) {
  const row = await env.DB.prepare("SELECT email, family_id, role FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (!row) return null;
  return { email: row.email, familyId: row.family_id, role: row.role };
}
