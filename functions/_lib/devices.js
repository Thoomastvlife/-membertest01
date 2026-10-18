// 後台「新裝置登入通知」與「登出所有裝置」
//
// 怎麼判斷新裝置：登入成功後，檢查瀏覽器有沒有帶這個帳號認得的「裝置 cookie」（admin_device，長期有效、HttpOnly）。
//   - 沒有，或有但這個帳號沒看過 → 新裝置：記下來，並寄信到這個帳號的信箱。
//   - 有而且看過 → 舊裝置：只更新最後登入時間，不寄信。
// 資料庫只存裝置代碼的 SHA-256，不存原值。換瀏覽器、清除 cookie、無痕視窗都會被當成新裝置（和多數服務的做法一樣）。
//
// 怎麼登出所有裝置：登入憑證是無狀態的簽章字串，沒辦法逐一收回，所以每個帳號有一個 session_version（見 migrate_v31.sql）。
//   登入時把版本號寫進憑證，每個後台請求都和資料庫比對；按「登出所有裝置」就把版本號 +1，舊憑證全部失效。
//
// 這個檔案的任何一步出錯，都不應該讓登入失敗：呼叫端要用 try/catch 包起來。

import {
  jsonRes as json,
  randomToken,
  sha256Hex,
  getCookie,
  setCookieHeader,
  clearCookieHeader,
  signSession,
  verifySession,
  sendEmail,
  logAdminAction,
} from "./helpers.js";

export const DEVICE_COOKIE = "admin_device";
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 3600;
const MAX_DEVICES_PER_ADMIN = 20;
const REVOKE_LINK_DAYS = 7;
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIGRATE_MSG = "資料庫還沒升級，請先執行 migrate_v31.sql";

const esc = (v) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---- 小工具 ----

// 把 User-Agent 變成人看得懂的「瀏覽器 · 系統」
export function describeDevice(ua) {
  const s = String(ua || "");
  if (!s) return "未知裝置";
  let browser = "瀏覽器";
  if (/Edg(e|A|iOS)?\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/SamsungBrowser/.test(s)) browser = "Samsung Internet";
  else if (/Firefox\/|FxiOS/.test(s)) browser = "Firefox";
  else if (/Chrome\/|CriOS/.test(s)) browser = "Chrome";
  else if (/Safari\//.test(s)) browser = "Safari";
  let os = "";
  if (/Windows/.test(s)) os = "Windows";
  else if (/iPad/.test(s)) os = "iPadOS";
  else if (/iPhone|iPod/.test(s)) os = "iOS";
  else if (/Android/.test(s)) os = "Android";
  else if (/CrOS/.test(s)) os = "ChromeOS";
  else if (/Mac OS X|Macintosh/.test(s)) os = "macOS";
  else if (/Linux/.test(s)) os = "Linux";
  return os ? `${browser} · ${os}` : browser;
}

function locationText(city, country) {
  return [city, country].filter(Boolean).join(", ");
}

export function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!domain) return "";
  const head = name.slice(0, Math.min(2, name.length));
  return `${head}${"*".repeat(Math.max(1, name.length - head.length))}@${domain}`;
}

function taipeiNow() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 16) + "（台灣時間）";
}

function clientInfo(request) {
  const cf = request.cf || {};
  return {
    ua: String(request.headers.get("User-Agent") || "").slice(0, 300),
    ip: String(request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "").slice(0, 64),
    country: String(cf.country || request.headers.get("CF-IPCountry") || "").slice(0, 8),
    city: String(cf.city || "").slice(0, 60),
  };
}

async function currentDeviceHash(request) {
  const token = getCookie(request, DEVICE_COOKIE);
  return token && /^[0-9a-f]{48}$/.test(token) ? sha256Hex(token) : null;
}

// ---- 登入版本號（登出所有裝置）----

// 回傳新的版本號。soft = true 時，資料庫還沒升級就回傳 null（用在重設密碼這種「順便做」的場合）
export async function bumpSessionVersion(env, adminId, { soft = false } = {}) {
  try {
    await env.DB.prepare("UPDATE admins SET session_version = COALESCE(session_version, 0) + 1 WHERE id=?").bind(adminId).run();
    const row = await env.DB.prepare("SELECT session_version FROM admins WHERE id=?").bind(adminId).first();
    return row ? Number(row.session_version) || 0 : null;
  } catch (e) {
    if (/no such column/i.test(String((e && e.message) || ""))) {
      if (soft) return null;
      throw new Error("NEED_MIGRATE_V31");
    }
    throw e;
  }
}

function migrateOr500(e) {
  if (e && e.message === "NEED_MIGRATE_V31") return json({ error: MIGRATE_MSG }, 400);
  throw e;
}

// ---- 登入時：記錄裝置，判斷是不是新的 ----
// 回傳 { isNew, cookie, device, ip, location }；資料表還沒建立（沒跑 migrate_v31.sql）時回傳 { unavailable: true }
export async function trackLoginDevice(env, request, admin) {
  const existing = getCookie(request, DEVICE_COOKIE);
  const token = existing && /^[0-9a-f]{48}$/.test(existing) ? existing : randomToken(24);
  const hash = await sha256Hex(token);
  const { ua, ip, country, city } = clientInfo(request);
  const cookie = setCookieHeader(DEVICE_COOKIE, token, DEVICE_COOKIE_MAX_AGE);
  const out = { cookie, device: describeDevice(ua), ip, location: locationText(city, country) };

  try {
    const row = await env.DB.prepare("SELECT id FROM admin_devices WHERE admin_id=? AND device_hash=?").bind(admin.id, hash).first();
    if (row) {
      await env.DB.prepare("UPDATE admin_devices SET last_seen=datetime('now'), user_agent=?, ip=?, country=?, city=? WHERE id=?")
        .bind(ua, ip, country, city, row.id)
        .run();
      return { ...out, isNew: false };
    }
    await env.DB.prepare("INSERT INTO admin_devices (admin_id, device_hash, user_agent, ip, country, city) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(admin.id, hash, ua, ip, country, city)
      .run();
    // 每個帳號只留最近 20 台，避免一直長大
    await env.DB.prepare(
      "DELETE FROM admin_devices WHERE admin_id=? AND id NOT IN (SELECT id FROM admin_devices WHERE admin_id=? ORDER BY last_seen DESC, id DESC LIMIT ?)"
    )
      .bind(admin.id, admin.id, MAX_DEVICES_PER_ADMIN)
      .run();
    return { ...out, isNew: true };
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || ""))) return { ...out, isNew: false, unavailable: true };
    throw e;
  }
}

// ---- 新裝置通知信 ----
function buildMail({ username, when, device, location, ip, link, days }) {
  const row = (k, v) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#777;white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:6px 0;">${esc(v || "—")}</td></tr>`;
  const html = `<div style="font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;max-width:520px;margin:0 auto;color:#222;line-height:1.7;">
  <h2 style="margin:0 0 8px;color:#3D2314;">新裝置登入通知</h2>
  <p style="margin:0 0 12px;">你的後台帳號「<b>${esc(username)}</b>」剛剛在一台沒用過的裝置上登入：</p>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:14px;">
    ${row("時間", when)}${row("裝置", device)}${row("大約位置", location || "無法判斷")}${row("IP", ip)}
  </table>
  <p style="margin:0 0 14px;"><b>如果是你本人，不需要做任何事。</b></p>
  <div style="background:#FFF4F3;border:1px solid #F0C4C0;border-radius:10px;padding:14px 16px;">
    <p style="margin:0 0 10px;"><b>如果不是你：</b></p>
    <p style="margin:0 0 12px;"><a href="${esc(link)}" style="display:inline-block;background:#B8433A;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">立即登出所有裝置</a></p>
    <p style="margin:0;font-size:13px;color:#555;">登出後，請馬上登入後台修改密碼，並啟用「兩步驟驗證」。這個按鈕 ${days} 天內有效，而且只能使用一次。</p>
  </div>
  <p style="margin:16px 0 0;font-size:12px;color:#999;">這是系統自動寄出的安全通知。每個瀏覽器第一次登入才會通知；換瀏覽器、清除瀏覽器資料或使用無痕視窗，也會被當成新裝置。</p>
</div>`;
  const text = [
    "新裝置登入通知",
    "",
    `你的後台帳號「${username}」剛剛在一台沒用過的裝置上登入：`,
    `時間：${when}`,
    `裝置：${device || "—"}`,
    `大約位置：${location || "無法判斷"}`,
    `IP：${ip || "—"}`,
    "",
    "如果是你本人，不需要做任何事。",
    "如果不是你，請馬上用這個連結登出所有裝置（" + days + " 天內有效、只能使用一次）：",
    link,
    "登出後請立即登入後台修改密碼，並啟用兩步驟驗證。",
  ].join("\n");
  return { html, text };
}

// 回傳 { sent, reason }；reason：no_email | not_configured | send_failed | ok
export async function sendNewDeviceMail(env, request, admin, info) {
  const to = String(admin.email || "").trim();
  if (!to || !MAIL_RE.test(to)) return { sent: false, reason: "no_email" };
  const token = await signSession(
    { k: "revoke", adminId: admin.id, sv: Number(admin.session_version) || 0, exp: Date.now() + REVOKE_LINK_DAYS * 24 * 3600 * 1000 },
    env.ADMIN_SESSION_SECRET
  );
  const link = `${new URL(request.url).origin}/admin/revoke#t=${encodeURIComponent(token)}`; // 放在 # 後面，不會出現在伺服器紀錄裡
  const { html, text } = buildMail({
    username: admin.username,
    when: taipeiNow(),
    device: info.device,
    location: info.location,
    ip: info.ip,
    link,
    days: REVOKE_LINK_DAYS,
  });
  try {
    await sendEmail(env, {
      to,
      from: env.EMAIL_FROM_SECURITY || env.EMAIL_FROM,
      subject: "【安全通知】你的後台帳號在新裝置登入",
      html,
      text,
    });
    return { sent: true, reason: "ok" };
  } catch (e) {
    console.error("sendNewDeviceMail failed:", e);
    return { sent: false, reason: String((e && e.message) || "").startsWith("EMAIL_NOT_CONFIGURED") ? "not_configured" : "send_failed" };
  }
}

// 寄通知信 + 寫操作紀錄。自己吞掉所有錯誤，不會影響登入。
export async function notifyNewDevice(env, request, admin, info) {
  try {
    const r = await sendNewDeviceMail(env, request, admin, info);
    const tail =
      r.reason === "ok" ? `，已寄通知信到 ${maskEmail(admin.email)}`
      : r.reason === "no_email" ? "；這個帳號沒有設定信箱，沒有寄通知信"
      : r.reason === "not_configured" ? "；寄信服務還沒設定好，沒有寄通知信"
      : "；通知信寄送失敗";
    await logAdminAction(env, { adminId: admin.id, username: admin.username }, request, {
      action: "auth.new_device",
      summary: `偵測到新裝置登入：${info.device}${info.location ? "（" + info.location + "）" : ""}${tail}`,
      detail: { device: info.device, ip: info.ip, location: info.location, mail: r.reason },
    });
  } catch (e) {
    console.error("notifyNewDevice failed:", e);
  }
}

// ---- 登出所有裝置 ----

// 自己登出：keep_current = true 保留目前這台（換發新憑證），否則連這台也登出
export async function handleLogoutAllSelf(request, env, session) {
  const body = await request.json().catch(() => ({}));
  let v;
  try {
    v = await bumpSessionVersion(env, session.adminId);
  } catch (e) {
    return migrateOr500(e);
  }
  if (body && body.keep_current) {
    const ttlHours = parseInt(env.SESSION_TTL_HOURS || "12", 10);
    const fresh = await signSession(
      { adminId: session.adminId, username: session.username, sv: v, exp: Date.now() + ttlHours * 3600 * 1000 },
      env.ADMIN_SESSION_SECRET
    );
    return json({ ok: true, kept: true }, 200, { "Set-Cookie": setCookieHeader("admin_session", fresh, ttlHours * 3600) });
  }
  return json({ ok: true, kept: false }, 200, { "Set-Cookie": clearCookieHeader("admin_session") });
}

// 管理員替別的帳號登出所有裝置（例如員工離職、懷疑帳號外洩）
export async function handleLogoutAllStaff(id, env) {
  const target = await env.DB.prepare("SELECT id, username FROM admins WHERE id=?").bind(id).first();
  if (!target) return json({ error: "找不到這個帳號" }, 404);
  try {
    await bumpSessionVersion(env, target.id);
  } catch (e) {
    return migrateOr500(e);
  }
  return json({ ok: true, username: target.username });
}

// 刪除帳號時順便清掉裝置紀錄（沒升級資料庫就略過）
export async function deleteDevicesOf(env, adminId) {
  try {
    await env.DB.prepare("DELETE FROM admin_devices WHERE admin_id=?").bind(adminId).run();
  } catch (e) {
    if (!/no such table/i.test(String((e && e.message) || ""))) throw e;
  }
}

// ---- 信裡的「立即登出所有裝置」連結（不需要登入）----
export async function handleRevokeByLink(request, env) {
  const body = await request.json().catch(() => ({}));
  const tok = await verifySession(String(body.t || ""), env.ADMIN_SESSION_SECRET);
  if (!tok || tok.k !== "revoke" || !tok.adminId) {
    return json({ error: "這個連結無效或已經過期（有效期限 " + REVOKE_LINK_DAYS + " 天）。請直接登入後台，按右上角 🔐「帳號安全」→「登出所有裝置」" }, 400);
  }
  let row;
  try {
    row = await env.DB.prepare("SELECT id, username, session_version FROM admins WHERE id=?").bind(tok.adminId).first();
  } catch (e) {
    if (/no such column/i.test(String((e && e.message) || ""))) return json({ error: MIGRATE_MSG }, 400);
    throw e;
  }
  if (!row) return json({ error: "找不到這個帳號" }, 404);
  if ((Number(row.session_version) || 0) !== (Number(tok.sv) || 0)) {
    return json({ error: "這個連結已經使用過或已失效（可能已經登出過所有裝置，或密碼已重設）。如果還是擔心，請直接登入後台修改密碼" }, 400);
  }
  await bumpSessionVersion(env, row.id);
  await logAdminAction(env, { adminId: row.id, username: row.username }, request, {
    action: "auth.logout_all",
    summary: "透過新裝置登入通知信裡的連結，登出了所有裝置",
  });
  return json({ ok: true });
}

export function revokePageHtml() {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<meta name="referrer" content="no-referrer" />
<title>登出所有裝置</title>
<style>
  :root{--bg:#EEF0F6;--card:#fff;--line:#E2E4ED;--ink:#181B2E;--muted:#767B8C;--danger:#B8433A;--ok:#1E7A56;}
  @media (prefers-color-scheme: dark){:root{--bg:#0F1117;--card:#181B26;--line:#2A2E3D;--ink:#E8EAF2;--muted:#9096AA;--danger:#E5857C;--ok:#5FC79A;}}
  *{box-sizing:border-box;}
  body{margin:0;font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;background:var(--bg);color:var(--ink);}
  .card{max-width:400px;margin:10vh auto 0;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px;}
  h2{margin:0 0 10px;font-size:18px;}
  p{margin:0 0 14px;font-size:14px;line-height:1.7;color:var(--muted);}
  button{width:100%;padding:12px;border:none;border-radius:8px;background:var(--danger);color:#fff;font-size:15px;font-weight:600;cursor:pointer;}
  button:disabled{opacity:.5;cursor:default;}
  .msg{margin-top:14px;font-size:14px;line-height:1.7;}
  .err{color:var(--danger);} .ok{color:var(--ok);}
  a{color:inherit;}
</style>
</head>
<body>
<div class="card">
  <h2>登出所有裝置</h2>
  <p>按下按鈕後，這個後台帳號在<b>所有裝置</b>上的登入都會立刻失效，包含剛剛那台沒見過的裝置。之後請重新登入，並馬上修改密碼、啟用兩步驟驗證。</p>
  <button id="go" onclick="go()">確定，登出所有裝置</button>
  <div id="msg" class="msg"></div>
  <p style="margin-top:16px;font-size:12px;">如果你不是為了這件事來到這裡，直接關閉這個頁面就可以，不會有任何變動。</p>
</div>
<script>
  function tokenFromHash(){
    var m = (location.hash || '').match(/^#t=(.+)$/);
    if (!m) return '';
    try { return decodeURIComponent(m[1]); } catch (e) { return ''; }
  }
  async function go(){
    var btn = document.getElementById('go'), msg = document.getElementById('msg');
    var t = tokenFromHash();
    if (!t){ msg.className = 'msg err'; msg.textContent = '連結不完整，請回到信件重新點一次；或直接登入後台，按右上角 🔐「帳號安全」→「登出所有裝置」。'; return; }
    btn.disabled = true; msg.className = 'msg'; msg.textContent = '處理中…';
    try{
      var res = await fetch('/api/auth/revoke-sessions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ t: t }) });
      var data = await res.json().catch(function(){ return {}; });
      if (!res.ok) throw new Error(data.error || ('錯誤: ' + res.status));
      msg.className = 'msg ok';
      msg.innerHTML = '已登出所有裝置。<br>請現在就 <a href="/admin">登入後台</a>，修改密碼並啟用兩步驟驗證。';
      history.replaceState(null, '', location.pathname);
    }catch(e){
      msg.className = 'msg err'; msg.textContent = e.message; btn.disabled = false;
    }
  }
</script>
</body>
</html>`;
}

// ---- 帳號安全視窗：這個帳號登入過的裝置 ----
export async function handleListDevices(request, env, session) {
  let email = "";
  try {
    const me = await env.DB.prepare("SELECT email FROM admins WHERE id=?").bind(session.adminId).first();
    email = String((me && me.email) || "").trim();
  } catch (e) {
    if (!/no such column/i.test(String((e && e.message) || ""))) throw e;
  }
  const base = { has_email: MAIL_RE.test(email), email_masked: maskEmail(email) };
  let rows;
  try {
    const r = await env.DB.prepare(
      "SELECT device_hash, user_agent, ip, country, city, first_seen, last_seen FROM admin_devices WHERE admin_id=? ORDER BY last_seen DESC, id DESC LIMIT ?"
    )
      .bind(session.adminId, MAX_DEVICES_PER_ADMIN)
      .all();
    rows = r.results || [];
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || ""))) return json({ ...base, ready: false, devices: [] });
    throw e;
  }
  const mine = await currentDeviceHash(request);
  return json({
    ...base,
    ready: true,
    devices: rows.map((d) => ({
      label: describeDevice(d.user_agent),
      ip: d.ip || "",
      location: locationText(d.city, d.country),
      first_seen: d.first_seen,
      last_seen: d.last_seen,
      current: !!mine && d.device_hash === mine,
    })),
  });
}
