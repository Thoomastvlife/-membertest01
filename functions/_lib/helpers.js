import { parsePermissions } from "./access.js";
import { checkCouponForMember } from "./tiers.js";
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

// 後台的 <input type="datetime-local"> 送出的字串（例如 "2026-10-01T00:00"）沒有時區資訊，
// 店家肉眼輸入的其實是「台灣時間」。如果直接丟給 new Date() 解析，Cloudflare Workers
// 執行環境會把它當成 UTC 時間處理，存進資料庫的時間就會整整差 8 小時。
// 這裡明確補上 +08:00（台北時區）再轉換，並換算回 UTC 字串存進資料庫，
// 這樣 toTaipeiTime() 顯示時再 +8 小時換算回去，才會顯示出店家原本輸入的時間。
export function parseTaipeiDatetimeLocalToUtc(value) {
  if (!value || !String(value).trim()) return { value: null };
  const v = String(value).trim();
  const withOffset = /[Zz]|[+-]\d{2}:\d{2}$/.test(v) ? v : v + "+08:00";
  const d = new Date(withOffset);
  if (isNaN(d.getTime())) return { error: true };
  return { value: d.toISOString().replace("T", " ").slice(0, 19) };
}

export const PAYMENT_METHODS = new Set(["transfer", "store_barcode", "taiwan_pay"]);

// 超商條碼：可選超商、單筆上限、客人自付手續費
export const CVS_STORES = { seven: "7-11", family: "全家", hilife: "萊爾富" };
export const CVS_LIMIT = 10000;
export const CVS_FEE = 15;

// 儲值平台：訂單要儲值到哪個平台的帳號（純資訊記錄，不影響金流/付款方式）
export const PLATFORMS = new Set(["tiktok", "kuaishou", "xiaohongshu", "douyin"]);
export const PLATFORM_LABEL = { tiktok: "TikTok", kuaishou: "快手", xiaohongshu: "小紅書", douyin: "陸抖" };
// 需要強制填寫密碼的平台：快手／小紅書／陸抖不強制要密碼，僅 TikTok 需要
export const PLATFORMS_REQUIRE_PASSWORD = new Set(["tiktok"]);

// 推薦碼字母表：去掉容易混淆的 0/O、1/I/L
const REFERRAL_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateReferralCode(len = 6) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => REFERRAL_ALPHABET[b % REFERRAL_ALPHABET.length]).join("");
}

// 確保某位會員一定有推薦碼；若還沒有就產生一個並存回資料庫（相容舊資料的懶惰補值）
export async function ensureMemberReferralCode(env, member) {
  if (member.referral_code) return member.referral_code;
  for (let i = 0; i < 8; i++) {
    const code = generateReferralCode();
    try {
      await env.DB.prepare("UPDATE members SET referral_code=? WHERE id=?").bind(code, member.id).run();
      return code;
    } catch (err) {
      if (!String(err.message || "").includes("UNIQUE")) throw err;
      // 推薦碼恰好撞到別人，重新產生一個再試一次
    }
  }
  throw new Error("無法產生推薦碼，請稍後再試");
}

// ========================================================================
// 訂單編號（給人看的顯示用編號，固定格式 TW21 + 至少4碼流水號，例如 TW210007）
// 直接以資料庫的 orders.id（AUTOINCREMENT，刪除也不會重複使用）往前補 0 產生，
// 不需要另外的資料表欄位；超過 9999 筆之後會自然變成 5 碼、6 碼...不會截斷。
// ========================================================================

export function formatOrderNo(id) {
  return "TW21" + String(id).padStart(4, "0");
}

// 把使用者輸入的訂單編號（可能是完整的 TW210007，也可能只打數字部分）反解回資料庫 id。
// 找不到合理數字就回傳 null。
export function parseOrderNo(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  if (s.startsWith("TW")) s = s.slice(2);
  if (s.startsWith("21") && s.length > 4) s = s.slice(2);
  s = s.replace(/\D/g, "");
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function publicOrderView(o) {
  return {
    order_no: formatOrderNo(o.id),
    amount: o.amount,
    member_name_snapshot: o.member_name_snapshot,
    payment_method: o.payment_method,
    store_brand: o.store_brand || null,
    platform: o.platform || null,
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
    original_amount: o.original_amount ?? null,
    coupon_code: o.coupon_code || null,
    coupon_discount: o.coupon_discount ?? null,
    points_used: o.points_used || 0,
    points_discount: o.points_discount ?? null,
    terms_agreed: !!o.agreed_terms_at,   // 已經有「同意條款」紀錄（會員下單時勾過）→ 付款頁不用再勾
  };
}

// ========================================================================
// 優惠碼
// ========================================================================

// 檢查某個優惠碼是否可套用在給定金額上，並算出折抵金額（不會寫入資料庫、不會增加使用次數）。
// 回傳 { ok:true, coupon, discount, finalAmount } 或 { ok:false, error }
// opts.memberId 有帶（會員自助下單、會員頁試算）才會檢查「會員等級專屬優惠碼」；
// 後台建單／後台試算不帶 opts，店家永遠可以指定任何優惠碼。
export async function applyCouponToAmount(env, rawCode, amount, opts = {}) {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "請輸入優惠碼" };

  const coupon = await env.DB.prepare("SELECT * FROM coupons WHERE UPPER(code)=?").bind(code).first();
  if (!coupon) return { ok: false, error: "優惠碼不存在" };
  if (!coupon.is_active) return { ok: false, error: "此優惠碼已停用" };
  if (coupon.expires_at && new Date() > new Date(coupon.expires_at + "Z")) {
    return { ok: false, error: "此優惠碼已過期" };
  }
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    return { ok: false, error: "此優惠碼使用次數已達上限" };
  }
  if (coupon.min_order_amount && amount < coupon.min_order_amount) {
    return { ok: false, error: `訂單金額需滿 ${coupon.min_order_amount} 元才可使用此優惠碼` };
  }
  if (opts && Object.prototype.hasOwnProperty.call(opts, "memberId")) {
    const t = await checkCouponForMember(env, opts.memberId, coupon.code);
    if (!t.ok) return { ok: false, error: t.error };
  }

  let discount;
  if (coupon.discount_type === "fixed") {
    discount = Math.round(coupon.discount_amount || 0);
  } else {
    discount = Math.round((amount * (coupon.discount_percent || 0)) / 100);
    if (coupon.max_discount_amount != null) discount = Math.min(discount, Math.round(coupon.max_discount_amount));
  }
  discount = Math.max(0, Math.min(discount, amount));

  const finalAmount = amount - discount;
  return { ok: true, coupon, discount, finalAmount };
}

// 套用優惠碼成功後（訂單已建立）呼叫，把該優惠碼的已使用次數 +1。
export async function incrementCouponUsage(env, couponId) {
  await env.DB.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id=?").bind(couponId).run();
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

// 推播給後台裝置。need = 需要的權限（例如 "order_list"）：只推給管理員，以及有勾這項權限的員工；
// need 為 null 就推給所有已訂閱的裝置。單一裝置推播失敗（例如已解除訂閱）不應該影響主流程，
// 所以這裡整個函式吞掉錯誤，並順手清掉失效的訂閱（404/410）。
// 推播類型（員工可以各自開關）。key 會存進 admins.push_prefs。
export const PUSH_TYPES = {
  new_order: { label: "有新訂單", hint: "會員自助下單時" },
  need_verify: { label: "待核對付款", hint: "客人上傳轉帳證明／帳號末幾碼時" },
  need_barcode: { label: "待上傳條碼", hint: "客人選了超商條碼或台灣Pay 時" },
};

export function parsePushPrefs(raw) {
  let obj = {};
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch (e) {
    obj = {};
  }
  const out = {};
  for (const k of Object.keys(PUSH_TYPES)) out[k] = !(obj && obj[k] === false); // 沒設定 = 收
  return out;
}

export async function pushToAdmins(env, { title, body, url, tag, need, type }) {
  try {
    let rows;
    try {
      const r = await env.DB.prepare(
        `SELECT s.*, a.role AS admin_role, a.permissions AS admin_permissions, a.push_prefs AS admin_push_prefs
           FROM push_subscriptions s LEFT JOIN admins a ON a.id = s.admin_id`
      ).all();
      rows = r.results || [];
    } catch (e) {
      try {
        // 還沒執行 migrate_v27.sql（沒有 push_prefs）：不套用類型偏好，其餘照舊
        const r = await env.DB.prepare(
          `SELECT s.*, a.role AS admin_role, a.permissions AS admin_permissions
             FROM push_subscriptions s LEFT JOIN admins a ON a.id = s.admin_id`
        ).all();
        rows = r.results || [];
      } catch (e2) {
        // 資料庫還沒執行 migrate_v22.sql（admins 沒有 role 欄位）：維持舊行為，推給所有訂閱
        const r = await env.DB.prepare("SELECT * FROM push_subscriptions").all();
        rows = (r.results || []).map((x) => ({ ...x, admin_role: "owner" }));
      }
    }
    if (type && PUSH_TYPES[type]) {
      rows = rows.filter((sub) => parsePushPrefs(sub.admin_push_prefs)[type]);
    }
    if (need) {
      rows = rows.filter((sub) => {
        if (sub.admin_role === "owner") return true;
        const perms = parsePermissions(sub.admin_permissions);
        if (perms === null) return true; // 還沒設定過權限 = 維持升級前行為（全部功能）
        return perms.includes(need);
      });
    }
    if (!rows.length) return;

    const payload = JSON.stringify({ title, body, url: url || "/admin", tag });
    await Promise.all(
      rows.map(async (sub) => {
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
    // 推播整體出錯也不應該影響主流程
  }
}

// 有新訂單進來了（會員自助下單）
export async function notifyAdminsOfNewOrder(env, order) {
  await pushToAdmins(env, {
    title: "有新訂單",
    body: `${order.member_name_snapshot} 送出自助下單，金額 $${order.amount}`,
    url: "/admin",
    tag: "order-" + order.id,
    need: null,
    type: "new_order",
  });
}

// 客人上傳了轉帳證明／帳號末幾碼：有一筆「待核對付款」
export async function notifyAdminsOfPendingVerify(env, order) {
  await pushToAdmins(env, {
    title: "待核對付款",
    body: `${order.member_name_snapshot} 已上傳付款證明，$${order.amount}，請核對入帳`,
    url: "/admin",
    tag: "verify-" + order.id,
    need: "order_list",
    type: "need_verify",
  });
}

// 客人選了超商條碼／台灣Pay：有一筆「待上傳條碼」
export async function notifyAdminsOfPendingBarcode(env, order) {
  const label = order.payment_method === "taiwan_pay" ? "台灣Pay" : "超商條碼";
  await pushToAdmins(env, {
    title: "待上傳條碼",
    body: `${order.member_name_snapshot} 選了${label}，$${order.amount}，請上傳條碼`,
    url: "/admin",
    tag: "barcode-" + order.id,
    need: "order_list",
    type: "need_barcode",
  });
}

// ========================================================================
// 會員自助註冊只接受常見的大眾信箱（後台手動建立會員不受此限制）。
// 要增減網域直接改這個清單即可（前端註冊頁與後端驗證都會自動套用）。
// ========================================================================
export const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.tw",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
];

export function isAllowedEmailDomain(email) {
  const at = String(email || "").trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(String(email).trim().toLowerCase().slice(at + 1));
}

// ========================================================================
// 信箱驗證碼（自助註冊用）
// EMAIL_VERIFY_ENABLED 預設開啟；設成 "0" 可關閉（註冊頁就不會要求驗證碼）。
// 寄信使用 Resend（https://resend.com）：需要 secret RESEND_API_KEY 與 var EMAIL_FROM。
// ========================================================================
export function emailVerifyEnabled(env) {
  return String(env.EMAIL_VERIFY_ENABLED ?? "1") !== "0";
}

export function generateNumericCode(len = 6) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 10 ** len).padStart(len, "0");
}

export async function hashEmailCode(env, email, code) {
  return sha256Hex(`${env.ADMIN_SESSION_SECRET}|${email}|${code}`);
}

// from 可選填，不給的話預設用 EMAIL_FROM（會員驗證信那組寄件人）。
// 想讓某一類信件（例如訂單完成通知）用不同寄件人顯示，呼叫端傳 from 覆蓋即可。
export async function sendEmail(env, { to, subject, html, text, from }) {
  const sender = from || env.EMAIL_FROM;
  if (!env.RESEND_API_KEY || !sender) throw new Error("EMAIL_NOT_CONFIGURED");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: sender, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`EMAIL_SEND_FAILED:${res.status}:${detail.slice(0, 200)}`);
  }
}

// ========================================================================
// 後台操作紀錄（操作稽核用）
// ========================================================================

// 送進 detail 欄位前，過濾掉密碼、圖片等不該長期留存/不適合給其他管理員看到的欄位。
const LOG_HIDE_FIELDS = new Set([
  "password",
  "new_password",
  "platform_password",
  "delivery_note",
  "proof_image",
  "barcode_image",
  "image_base64",
]);

// 把 API 收到的 body 物件過濾成適合寫進操作紀錄的樣子：
// - 敏感欄位（密碼、圖片）只留「有無填寫」，不留內容本身
// - 過長的文字（例如備註貼了一大段）截斷，避免 detail 爆量
export function sanitizeForLog(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (LOG_HIDE_FIELDS.has(k)) {
      out[k] = v ? "(已填寫，內容不紀錄)" : v;
      continue;
    }
    if (typeof v === "string" && v.length > 300) {
      out[k] = v.slice(0, 300) + "…（已截斷）";
      continue;
    }
    out[k] = v;
  }
  return out;
}

// 操作紀錄要歸屬到哪張訂單：後台路由在「動手之前」先把訂單 id 查好放進來（以請求物件當 key），
// logAdminAction 寫紀錄時取用；也可以直接在呼叫時傳 orderId。
export const logOrderContext = new WeakMap();

// 還沒執行 migrate_v25.sql（admin_logs 沒有 order_id 欄位）時，自動退回舊的寫法，操作紀錄不會整個壞掉。
let adminLogsHasNoOrderIdColumn = false;

// ========================================================================
// 登入保護：連續失敗鎖定 + 兩步驟驗證（TOTP）
// ========================================================================

// 連續失敗幾次鎖定、鎖多久，可用環境變數調整（Pages 專案設定的一般變數即可，不用 Secret）
export function loginLockoutConfig(env) {
  return {
    maxAttempts: Math.max(3, parseInt(env.LOGIN_MAX_ATTEMPTS || "5", 10) || 5),
    lockoutMinutes: Math.max(1, parseInt(env.LOGIN_LOCKOUT_MINUTES || "15", 10) || 15),
  };
}

// 登入或驗證碼錯誤時呼叫：把失敗次數+1，達到門檻就鎖定一段時間。
// table 是固定字串（"admins" 或 "members"，程式內部決定，不是使用者輸入），可以直接接在 SQL 裡。
// 資料庫還沒跑 migrate_v28.sql（沒有這些欄位）時，直接略過，不影響原本登入流程。
export async function bumpFailedLogin(env, table, id, currentAttempts, maxAttempts, lockoutMinutes) {
  try {
    const attempts = (currentAttempts || 0) + 1;
    if (attempts >= maxAttempts) {
      await env.DB.prepare(
        `UPDATE ${table} SET failed_attempts=?, locked_until=datetime('now', ?) WHERE id=?`
      ).bind(attempts, `+${lockoutMinutes} minutes`, id).run();
    } else {
      await env.DB.prepare(`UPDATE ${table} SET failed_attempts=? WHERE id=?`).bind(attempts, id).run();
    }
  } catch (err) {
    if (!/no such column/i.test(String(err && err.message))) throw err;
    // 還沒跑 migrate_v28.sql：不鎖定，維持原本「只記錄」的行為
  }
}

// 登入成功時呼叫，清掉失敗次數與鎖定狀態（資料庫還沒升級就略過）
export async function clearFailedLogin(env, table, id) {
  try {
    await env.DB.prepare(`UPDATE ${table} SET failed_attempts=0, locked_until=NULL WHERE id=?`).bind(id).run();
  } catch (err) {
    if (!/no such column/i.test(String(err && err.message))) throw err;
  }
}

// ---- TOTP（RFC 6238）。不依賴任何套件，只用 Web Crypto，跟專案裡其他加解密的作法一致 ----
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes) {
  let bits = 0, value = 0, output = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(str) {
  const clean = String(str || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const bytes = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

// 產生一組新的 TOTP 密鑰（160 bits，base32 顯示，驗證器 App 都看得懂）
export function generateTotpSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

async function totpCodeAt(secretBase32, counter) {
  const keyBytes = base32Decode(secretBase32);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const sigBuf = await crypto.subtle.sign("HMAC", key, counterBuf);
  const sig = new Uint8Array(sigBuf);
  const offset = sig[sig.length - 1] & 0x0f;
  const code =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, "0");
}

// 驗證驗證器 App 顯示的 6 位數代碼。前後各容許 1 個時間窗（±30 秒），容忍手機時鐘誤差。
export async function verifyTotpCode(secretBase32, inputCode, window = 1) {
  if (!secretBase32 || !inputCode) return false;
  const code = String(inputCode).replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    const expected = await totpCodeAt(secretBase32, counter + i);
    if (expected === code) return true;
  }
  return false;
}

// 給驗證器 App 掃描用的 otpauth:// 連結（用來產生 QR code）
export function totpOtpauthUrl(secretBase32, accountLabel, issuer) {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  // algorithm/digits/period 都是驗證器 App 的預設值（SHA1、6 位、30 秒），不用寫進去，
  // 網址短一點 QR code 才不會因為資料太多而產生失敗（issuer 是中文時網址會被編碼成很長）
  const params = new URLSearchParams({ secret: secretBase32, issuer });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// 備援碼：手機不在身邊或弄丟時，可以用這組碼登入一次。產生明碼（只在啟用當下顯示一次），
// 呼叫端要自己用 hashPassword() 雜湊後存進 totp_backup_codes。
const BACKUP_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 不含容易看錯的 0/O/1/I
export function generateBackupCodes(count = 8, length = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let code = "";
    for (let j = 0; j < length; j++) code += BACKUP_CODE_CHARSET[bytes[j] % BACKUP_CODE_CHARSET.length];
    codes.push(code);
  }
  return codes;
}

// 檢查輸入的字串是不是其中一組備援碼；驗證通過就「用掉」（從清單移除，回傳剩下的清單讓呼叫端存回去）
export async function consumeBackupCode(storedHashesJson, inputCode) {
  let hashes;
  try {
    hashes = JSON.parse(storedHashesJson || "[]");
    if (!Array.isArray(hashes)) hashes = [];
  } catch {
    hashes = [];
  }
  const clean = String(inputCode || "").trim().toUpperCase().replace(/\s|-/g, "");
  if (!clean) return { ok: false, remaining: hashes };
  for (let i = 0; i < hashes.length; i++) {
    if (await verifyPassword(clean, hashes[i])) {
      hashes.splice(i, 1);
      return { ok: true, remaining: hashes };
    }
  }
  return { ok: false, remaining: hashes };
}

// 寫入一筆操作紀錄。寫入失敗只記錄到 console，不會讓原本的後台操作跟著失敗。
export async function logAdminAction(env, session, request, { action, summary, detail, orderId }) {
  try {
    const ip = (request && (request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For"))) || null;
    const base = [
      session && session.adminId != null ? session.adminId : null,
      (session && session.username) || "(未知帳號)",
      action,
      summary,
      detail !== undefined && detail !== null ? JSON.stringify(detail) : null,
      ip,
    ];
    let oid = orderId != null ? orderId : request ? logOrderContext.get(request) : null;
    oid = Number.isInteger(oid) && oid > 0 ? oid : null;
    if (!adminLogsHasNoOrderIdColumn) {
      try {
        await env.DB.prepare(
          "INSERT INTO admin_logs (admin_id, admin_username, action, summary, detail, ip, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(...base, oid)
          .run();
        return;
      } catch (err) {
        // SQLite 的 INSERT 缺欄位訊息是「has no column named」，SELECT 才是「no such column」，兩種都要認
        if (!/no such column|has no column named/i.test(String((err && err.message) || ""))) throw err;
        adminLogsHasNoOrderIdColumn = true;
      }
    }
    await env.DB.prepare(
      "INSERT INTO admin_logs (admin_id, admin_username, action, summary, detail, ip) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(...base)
      .run();
  } catch (err) {
    console.error("logAdminAction failed:", err);
  }
}
