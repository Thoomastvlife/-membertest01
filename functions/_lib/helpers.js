// 共用工具函式。放在 _lib 資料夾（開頭底線）Cloudflare Pages 不會把它當成路由。

export function jsonRes(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export function htmlRes(str, status = 200) {
  return new Response(str, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export function randomToken(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password) {
  const salt = randomToken(16);
  const hash = await sha256Hex(salt + password);
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const check = await sha256Hex(salt + password);
  return check === hash;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(payloadObj, secret) {
  const payload = btoa(JSON.stringify(payloadObj));
  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sig = Array.from(new Uint8Array(sigBuf), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${payload}.${sig}`;
}

export async function verifySession(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expectedSig = Array.from(new Uint8Array(sigBuf), (b) => b.toString(16).padStart(2, "0")).join("");
  if (expectedSig !== sig) return null;
  try {
    const obj = JSON.parse(atob(payload));
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

export function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCookieHeader(name, value, maxAgeSeconds) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearCookieHeader(name) {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function requireAdmin(request, env) {
  const token = getCookie(request, "admin_session");
  const session = await verifySession(token, env.ADMIN_SESSION_SECRET);
  if (!session || !session.adminId) return null;
  return session;
}

export async function requireMember(request, env) {
  const token = getCookie(request, "member_session");
  const session = await verifySession(token, env.ADMIN_SESSION_SECRET);
  if (!session || !session.memberId) return null;
  return session;
}

export function nowIso() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600 * 1000);
}

export const PAYMENT_METHODS = new Set(["transfer", "store_barcode", "taiwan_pay"]);

export function publicOrderView(o) {
  return {
    amount: o.amount,
    member_name_snapshot: o.member_name_snapshot,
    payment_method: o.payment_method,
    status: o.status,
    bank_name: o.bank_name,
    bank_account_number: o.bank_account_number,
    bank_account_holder: o.bank_account_holder,
    barcode_image: o.status === "ready_to_pay" ? o.barcode_image : null,
    expires_at: o.expires_at,
    created_at: o.created_at,
    proof_last_digits: o.proof_last_digits || null,
    proof_uploaded_at: o.proof_uploaded_at || null,
    has_proof_image: !!o.proof_image,
  };
}

export const PROOF_ELIGIBLE_METHODS = new Set(["transfer", "store_barcode"]);

export async function expireIfNeeded(db, order) {
  if (["paid", "cancelled", "expired"].includes(order.status)) return order;
  if (new Date(order.expires_at + "Z") < new Date()) {
    await db.prepare("UPDATE orders SET status='expired' WHERE id=?").bind(order.id).run();
    order.status = "expired";
  }
  return order;
}

export async function getSettingsObj(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const obj = {};
  for (const r of results) obj[r.key] = r.value;
  return obj;
}
