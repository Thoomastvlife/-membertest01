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

// 付款連結本身的「硬」失效時間：不論訂單狀態如何（即使還沒到 3 小時付款時效），
// 從建立起算超過這個時數之後，連結一律視為失效、無法再開啟／操作。
// 這跟 order.expires_at（3 小時付款時效，只影響能不能繼續付款）是兩件事，兩者互不影響、各自獨立判斷。
export function isLinkHardExpired(order, hours = 24) {
  const createdAt = new Date(order.created_at + "Z");
  return new Date() > addHours(createdAt, hours);
}

export async function getSettingsObj(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const obj = {};
  for (const r of results) obj[r.key] = r.value;
  return obj;
}

// ========================================================================
// Web Push 推播（RFC 8291 aes128gcm 內容加密 + RFC 8292 VAPID 身分驗證）
// 純用瀏覽器/Workers 內建的 Web Crypto API 實作，不依賴任何 npm 套件。
// VAPID 金鑰對只需要產生一次，產生後存進 D1 的 settings 表，之後重複使用。
// ========================================================================

function b64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(...arrs) {
  const len = arrs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

// 取得（或第一次使用時自動產生並存起來）後台推播用的 VAPID 金鑰對
export async function getOrCreateVapidKeys(env) {
  const settings = await getSettingsObj(env);
  if (settings.vapid_public_key && settings.vapid_private_jwk) {
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      JSON.parse(settings.vapid_private_jwk),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
    return { publicKeyB64: settings.vapid_public_key, privateKey };
  }

  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const jwkPriv = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const publicKeyB64 = bytesToB64url(rawPub);

  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('vapid_public_key', ?)")
    .bind(publicKeyB64)
    .run();
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('vapid_private_jwk', ?)")
    .bind(JSON.stringify(jwkPriv))
    .run();

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    jwkPriv,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  return { publicKeyB64, privateKey };
}

async function buildVapidAuthHeader(endpoint, privateKey, publicKeyB64, subject) {
  const aud = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject };
  const encHeader = bytesToB64url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${encHeader}.${encPayload}`;
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${bytesToB64url(new Uint8Array(sigBuf))}`;
  return `vapid t=${jwt}, k=${publicKeyB64}`;
}

async function encryptPushPayload(payloadText, p256dhB64, authB64) {
  const clientPub = b64urlToBytes(p256dhB64);
  const authSecret = b64urlToBytes(authB64);

  const serverKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));
  const clientPubKey = await crypto.subtle.importKey("raw", clientPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientPubKey }, serverKeyPair.privateKey, 256)
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authInfo = concatBytes(new TextEncoder().encode("WebPush: info\0"), clientPub, serverPubRaw);
  const prk = await hkdf(authSecret, sharedSecret, authInfo, 32);
  const cek = await hkdf(salt, prk, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  const padded = concatBytes(new TextEncoder().encode(payloadText), new Uint8Array([2]));
  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, padded));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const idlen = new Uint8Array([serverPubRaw.length]);

  return concatBytes(salt, rs, idlen, serverPubRaw, ciphertext);
}

async function sendWebPush(sub, payloadText, env) {
  const { publicKeyB64, privateKey } = await getOrCreateVapidKeys(env);
  const subject = env.VAPID_SUBJECT || "mailto:admin@example.com";
  const [authHeader, body] = await Promise.all([
    buildVapidAuthHeader(sub.endpoint, privateKey, publicKeyB64, subject),
    encryptPushPayload(payloadText, sub.p256dh, sub.auth),
  ]);
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: authHeader,
    },
    body,
  });
}

// 通知所有已訂閱推播的後台裝置：有新訂單進來了。單一裝置推播失敗（例如已解除訂閱）
// 不應該影響下單流程本身，所以這裡整個函式吞掉錯誤，並順手清掉失效的訂閱。
export async function notifyAdminsOfNewOrder(env, order) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM push_subscriptions").all();
    if (!results || !results.length) return;

    const payload = JSON.stringify({
      title: "有新訂單",
      body: `${order.member_name_snapshot} 送出自助下單，金額 $${order.amount}`,
      url: "/admin",
      tag: "order-" + order.id,
    });

    await Promise.all(
      results.map(async (sub) => {
        try {
          const res = await sendWebPush(sub, payload, env);
          if (res.status === 404 || res.status === 410) {
            await env.DB.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(sub.id).run();
          }
        } catch (e) {
          // 單一裝置推播失敗略過即可
        }
      })
    );
  } catch (e) {
    // 推播整體出錯也不應該影響下單本身
  }
}
