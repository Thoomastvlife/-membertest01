// 每日營運日報
// Cloudflare Pages 沒有內建排程，所以由 GitHub Actions（.github/workflows/daily-report.yml）
// 每天定時呼叫 POST /api/cron/daily-report，標頭帶 X-Cron-Key（= secret CRON_SECRET）。
// 日期一律用台灣時間（UTC+8）切日；資料庫存的是 UTC。

import { sendEmail, getSettingsObj, formatOrderNo } from "./helpers.js";
import { getPlatforms } from "./platforms.js";

const TZ = "'+8 hours'";
const METHOD_LABEL = { transfer: "轉帳", store_barcode: "超商條碼", taiwan_pay: "台灣Pay" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

// 收件人 = 「管理員（role = owner）在後台填的信箱」＋「DAILY_REPORT_TO（環境變數，沒設定就看 settings 表的 daily_report_to）」，
// 合併後去重（不分大小寫）。DAILY_REPORT_TO 變成選填：想額外寄給不是帳號的人（例如會計）才需要。
const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function reportRecipients(env) {
  const list = [];

  // 1) 管理員帳號上的信箱（還沒執行 migrate_v24.sql、或舊資料庫沒有 role 欄位時就略過，不影響其他來源）
  try {
    const { results } = await env.DB.prepare(
      "SELECT email FROM admins WHERE role='owner' AND email IS NOT NULL AND TRIM(email) <> '' ORDER BY id ASC"
    ).all();
    for (const r of results || []) list.push(r.email);
  } catch (e) {
    /* no such column：舊資料庫，改用下面的來源 */
  }

  // 2) 額外指定的收件人（可用逗號分隔多個）
  let raw = env.DAILY_REPORT_TO || "";
  if (!raw) {
    try {
      raw = (await getSettingsObj(env)).daily_report_to || "";
    } catch (e) {
      raw = "";
    }
  }
  for (const x of String(raw).split(/[,;\s]+/)) list.push(x);

  const seen = new Set();
  const out = [];
  for (const x of list) {
    const addr = String(x || "").trim();
    const key = addr.toLowerCase();
    if (!addr || !MAIL_RE.test(addr) || seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

// 統計指定日期（台灣時間 YYYY-MM-DD；不給就是「昨天」）
export async function buildDailyReport(env, dateStr) {
  const db = env.DB;
  const one = async (sql, ...b) => (await db.prepare(sql).bind(...b).first()) || {};
  const all = async (sql, ...b) => (await db.prepare(sql).bind(...b).all()).results || [];

  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")
    ? dateStr
    : (await one(`SELECT date('now', ${TZ}, '-1 day') AS d`)).d;
  const prevDate = (await one(`SELECT date(?, '-1 day') AS d`, date)).d;
  const month = date.slice(0, 7);

  const paidDay = `strftime('%Y-%m-%d', datetime(paid_at, ${TZ}))`;
  const createdDay = `strftime('%Y-%m-%d', datetime(created_at, ${TZ}))`;

  const paid = await one(
    `SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS t,
            COALESCE(SUM(coupon_discount),0) AS coupon, COALESCE(SUM(points_discount),0) AS points
       FROM orders WHERE status='paid' AND ${paidDay} = ?`,
    date
  );
  const prevPaid = await one(`SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS t FROM orders WHERE status='paid' AND ${paidDay} = ?`, prevDate);
  const monthPaid = await one(
    `SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS t FROM orders
      WHERE status='paid' AND strftime('%Y-%m', datetime(paid_at, ${TZ})) = ? AND ${paidDay} <= ?`,
    month,
    date
  );
  const created = await one(`SELECT COUNT(*) AS c FROM orders WHERE ${createdDay} = ?`, date);
  const lost = await one(
    `SELECT SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN status='expired' OR (status IN ('pending_method','awaiting_payment','awaiting_barcode','ready_to_pay') AND expires_at <= datetime('now')) THEN 1 ELSE 0 END) AS expired
       FROM orders WHERE ${createdDay} = ?`,
    date
  );
  const byMethod = await all(
    `SELECT COALESCE(payment_method,'-') AS m, COUNT(*) AS c, COALESCE(SUM(amount),0) AS t
       FROM orders WHERE status='paid' AND ${paidDay} = ? GROUP BY m ORDER BY t DESC`,
    date
  );
  const byPlatform = await all(
    `SELECT COALESCE(platform,'-') AS p, COUNT(*) AS c, COALESCE(SUM(amount),0) AS t
       FROM orders WHERE status='paid' AND ${paidDay} = ? GROUP BY p ORDER BY t DESC`,
    date
  );
  const topMembers = await all(
    `SELECT member_name_snapshot AS name, COUNT(*) AS c, SUM(amount) AS t
       FROM orders WHERE status='paid' AND ${paidDay} = ? GROUP BY COALESCE(member_id, member_name_snapshot), member_name_snapshot
       ORDER BY t DESC LIMIT 5`,
    date
  );

  // 目前的待處理（跟後台首頁同一套定義；已超過付款時效的不算）
  const live = "expires_at > datetime('now')";
  const pend = await one(
    `SELECT
       SUM(CASE WHEN status='awaiting_barcode' AND ${live} THEN 1 ELSE 0 END) AS need_barcode,
       SUM(CASE WHEN status='awaiting_payment' AND ${live} AND proof_uploaded_at IS NOT NULL THEN 1 ELSE 0 END) AS need_verify,
       SUM(CASE WHEN status='awaiting_payment' AND ${live} AND proof_uploaded_at IS NULL THEN 1 ELSE 0 END) AS wait_transfer,
       SUM(CASE WHEN status='ready_to_pay' AND ${live} THEN 1 ELSE 0 END) AS wait_barcode_pay,
       SUM(CASE WHEN status='paid' AND is_completed=0 THEN 1 ELSE 0 END) AS to_complete
     FROM orders`
  );
  let redeemPending = 0;
  try {
    redeemPending = (await one("SELECT COUNT(*) AS c FROM points_redemptions WHERE status='pending'")).c || 0;
  } catch (e) {
    // 沒有點數兌換表就當 0
  }
  const oldest = await all(
    `SELECT id, member_name_snapshot AS name, amount, status, datetime(created_at, '+8 hours') AS created_tw FROM orders
      WHERE ${live} AND ((status='awaiting_barcode') OR (status='awaiting_payment' AND proof_uploaded_at IS NOT NULL))
      ORDER BY created_at ASC LIMIT 5`
  );

  return {
    date,
    paid: { count: paid.c || 0, total: paid.t || 0, coupon: paid.coupon || 0, points: paid.points || 0 },
    prevPaid: { count: prevPaid.c || 0, total: prevPaid.t || 0 },
    monthPaid: { count: monthPaid.c || 0, total: monthPaid.t || 0 },
    created: created.c || 0,
    cancelled: lost.cancelled || 0,
    expired: lost.expired || 0,
    byMethod,
    byPlatform,
    topMembers,
    pending: {
      need_barcode: pend.need_barcode || 0,
      need_verify: pend.need_verify || 0,
      wait_transfer: pend.wait_transfer || 0,
      wait_barcode_pay: pend.wait_barcode_pay || 0,
      to_complete: pend.to_complete || 0,
      redeem: redeemPending,
    },
    oldest,
  };
}

function diffText(cur, prev) {
  if (!prev) return cur ? "（前一日 $0）" : "";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `（較前一日 ${pct >= 0 ? "+" : ""}${pct}%）`;
}

export function renderDailyReport(r, platformNames = {}) {
  const pname = (k) => (k === "-" ? "未指定" : platformNames[k] || k);
  const mname = (k) => METHOD_LABEL[k] || "未選擇";
  const subject = `營運日報 ${r.date}｜儲值 ${money(r.paid.total)}（${r.paid.count} 筆）｜待處理 ${r.pending.need_verify + r.pending.need_barcode} 筆`;

  const lines = [];
  lines.push(`營運日報 ${r.date}`);
  lines.push("");
  lines.push(`【當日營收】`);
  lines.push(`已付款 ${r.paid.count} 筆，${money(r.paid.total)} ${diffText(r.paid.total, r.prevPaid.total)}`);
  lines.push(`新建立訂單 ${r.created} 筆；取消 ${r.cancelled}、過期 ${r.expired}`);
  if (r.paid.coupon || r.paid.points) lines.push(`折抵：優惠碼 ${money(r.paid.coupon)}、點數 ${money(r.paid.points)}`);
  lines.push(`本月累計（至 ${r.date}）：${money(r.monthPaid.total)}（${r.monthPaid.count} 筆）`);
  if (r.byMethod.length) {
    lines.push("");
    lines.push("【付款方式】");
    for (const x of r.byMethod) lines.push(`${mname(x.m)}：${x.c} 筆 ${money(x.t)}`);
  }
  if (r.byPlatform.length) {
    lines.push("");
    lines.push("【儲值平台】");
    for (const x of r.byPlatform) lines.push(`${pname(x.p)}：${x.c} 筆 ${money(x.t)}`);
  }
  if (r.topMembers.length) {
    lines.push("");
    lines.push("【當日前 5 名會員】");
    r.topMembers.forEach((x, i) => lines.push(`${i + 1}. ${x.name}：${x.c} 筆 ${money(x.t)}`));
  }
  lines.push("");
  lines.push("【目前待處理】");
  lines.push(`待核對付款 ${r.pending.need_verify}、待上傳條碼 ${r.pending.need_barcode}`);
  lines.push(`等客人轉帳 ${r.pending.wait_transfer}、等客人繳費 ${r.pending.wait_barcode_pay}、已付款未結案 ${r.pending.to_complete}、點數兌換單 ${r.pending.redeem}`);
  if (r.oldest.length) {
    lines.push("等最久的：");
    for (const o of r.oldest) lines.push(`  ${formatOrderNo(o.id)} ${o.name} ${money(o.amount)}（${o.status === "awaiting_barcode" ? "待上傳條碼" : "待核對"}，建立於 ${o.created_tw}）`);
  }
  const text = lines.join("\n");

  const tbl = (rows) =>
    `<table style="border-collapse:collapse;width:100%;font-size:14px">${rows
      .map((c) => `<tr>${c.map((v, i) => `<td style="padding:5px 8px;border-bottom:1px solid #eee;${i ? "text-align:right" : ""}">${v}</td>`).join("")}</tr>`)
      .join("")}</table>`;
  const h = (t) => `<h3 style="margin:22px 0 6px;font-size:15px;color:#3D2314">${t}</h3>`;
  const warn = r.pending.need_verify + r.pending.need_barcode > 0;

  const html = `<div style="font-family:-apple-system,'Noto Sans TC',sans-serif;max-width:560px;margin:0 auto;color:#222">
<h2 style="margin:0 0 4px;color:#3D2314">營運日報 ${esc(r.date)}</h2>
<div style="background:#faf5ef;border-radius:10px;padding:14px 16px;margin-top:10px">
  <div style="font-size:12px;color:#777">當日儲值（已付款）</div>
  <div style="font-size:28px;font-weight:700">${money(r.paid.total)}</div>
  <div style="font-size:13px;color:#555">${r.paid.count} 筆 ${esc(diffText(r.paid.total, r.prevPaid.total))}　本月累計 ${money(r.monthPaid.total)}</div>
</div>
${h("訂單概況")}${tbl([
    ["新建立訂單", r.created + " 筆"],
    ["取消／過期", `${r.cancelled} ／ ${r.expired} 筆`],
    ["優惠碼折抵", money(r.paid.coupon)],
    ["點數折抵", money(r.paid.points)],
  ])}
${r.byMethod.length ? h("付款方式") + tbl(r.byMethod.map((x) => [esc(mname(x.m)), `${x.c} 筆　${money(x.t)}`])) : ""}
${r.byPlatform.length ? h("儲值平台") + tbl(r.byPlatform.map((x) => [esc(pname(x.p)), `${x.c} 筆　${money(x.t)}`])) : ""}
${r.topMembers.length ? h("當日前 5 名會員") + tbl(r.topMembers.map((x) => [esc(x.name), `${x.c} 筆　${money(x.t)}`])) : ""}
${h(warn ? "⚠ 目前待處理" : "目前待處理")}${tbl([
    ["待核對付款", `<b>${r.pending.need_verify}</b>`],
    ["待上傳條碼", `<b>${r.pending.need_barcode}</b>`],
    ["等客人轉帳", r.pending.wait_transfer],
    ["等客人繳費", r.pending.wait_barcode_pay],
    ["已付款未結案", r.pending.to_complete],
    ["點數兌換單", r.pending.redeem],
  ])}
${r.oldest.length ? `<div style="font-size:13px;color:#555;margin-top:8px">等最久的：<br>${r.oldest.map((o) => `${esc(formatOrderNo(o.id))} ${esc(o.name)} ${money(o.amount)}（${o.status === "awaiting_barcode" ? "待上傳條碼" : "待核對"}）`).join("<br>")}</div>` : ""}
<div style="font-size:11px;color:#999;margin-top:22px">日期以台灣時間（UTC+8）計算；統計只計「已付款」訂單，依付款時間。</div>
</div>`;

  return { subject, html, text };
}

async function loadPlatformNames(env) {
  const names = {};
  try {
    for (const p of await getPlatforms(env.DB)) names[p.key] = p.name;
  } catch (e) {
    /* 平台名稱查不到就用代碼顯示 */
  }
  return names;
}

// 後台「寄一封測試日報」：把「昨天」的日報只寄給目前登入的管理員自己（用他帳號上填的信箱）。
// 不會寫入「今天已寄過」的紀錄，所以不影響正式排程；也不會寄給其他收件人。
// 權限由 API 入口統一擋（/api/admin/daily-report/... 預設只有管理員）。
export async function handleDailyReportTest(request, env, session) {
  let me;
  try {
    me = await env.DB.prepare("SELECT username, email FROM admins WHERE id=?").bind(session.adminId).first();
  } catch (e) {
    if (/no such column/i.test(String(e && e.message))) return json({ error: "資料庫尚未升級，請先執行 migrate_v24.sql" }, 400);
    throw e;
  }
  const email = String((me && me.email) || "").trim();
  if (!email || !MAIL_RE.test(email)) {
    return json({ error: "你的帳號還沒有設定信箱：請先在「帳號列表」按自己那一列的「設定信箱」，再寄測試日報" }, 400);
  }

  const report = await buildDailyReport(env, null);
  const mail = renderDailyReport(report, await loadPlatformNames(env));
  const sender = env.EMAIL_FROM_REPORT || env.EMAIL_FROM_ORDER || env.EMAIL_FROM;
  const subject = "【測試】" + mail.subject;
  const note = "（這是從後台寄出的測試信，只寄給你自己；正式日報不受影響。）";

  try {
    await sendEmail(env, {
      to: email,
      from: sender,
      subject,
      html: `<p style="color:#888;font-size:12px;">${esc(note)}</p>` + mail.html,
      text: note + "\n\n" + mail.text,
    });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (msg === "EMAIL_NOT_CONFIGURED") {
      return json({ error: "寄信服務還沒設定好：需要 RESEND_API_KEY（secret）和 EMAIL_FROM（或 EMAIL_FROM_REPORT）" }, 400);
    }
    return json({ error: "寄信失敗：" + msg.replace(/^EMAIL_SEND_FAILED:/, "").slice(0, 200) }, 502);
  }

  return json({ ok: true, to: email, date: report.date, sender: sender || "", recipients: await reportRecipients(env) });
}

// POST /api/cron/daily-report   標頭 X-Cron-Key: <CRON_SECRET>
//   ?date=YYYY-MM-DD   指定要統計的日期（預設昨天）
//   ?dry=1             只回傳預覽（JSON），不寄信也不記錄
//   ?force=1           同一天已經寄過也再寄一次
// 排錯用：金鑰的長度＋SHA-256 前 6 碼。64 字元亂數金鑰的指紋無法反推原文，可以安全顯示。
async function keyFingerprint(v) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `長度${v.length}/指紋${hex.slice(0, 6)}`;
}

async function dailyReportCronCore(request, env) {
  // 兩邊都先去掉前後空白／換行（貼上密碼時常會多帶一個換行）
  const key = String(env.CRON_SECRET || "").trim();
  const given = String(request.headers.get("x-cron-key") || "").trim();
  if (!key) return json({ error: "網站還沒有讀到 CRON_SECRET：請確認 Cloudflare Pages 的 Production 已新增這個 Secret，並且新增後重新部署過" }, 401);
  if (!safeEqual(key, given)) {
    return json(
      { error: `金鑰不正確（網站上的：${await keyFingerprint(key)}；GitHub 送來的：${await keyFingerprint(given)}）。兩邊要一模一樣` },
      401
    );
  }
  if (request.method !== "POST") return json({ error: "請用 POST" }, 405);

  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";

  const report = await buildDailyReport(env, url.searchParams.get("date"));

  const mail = renderDailyReport(report, await loadPlatformNames(env));

  const to = await reportRecipients(env);
  if (dry) return json({ ok: true, dry: true, to, report, subject: mail.subject, text: mail.text });

  if (!to.length) return json({ error: "沒有收件人：請到後台「員工帳號」替管理員帳號設定信箱（或設定 DAILY_REPORT_TO 環境變數）" }, 400);

  // 同一天只寄一次（GitHub 排程偶爾會重複觸發）
  const lastKey = "daily_report_last_sent";
  const last = (await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(lastKey).first())?.value;
  if (!force && last === report.date) return json({ ok: true, skipped: true, reason: "這一天的日報已經寄過", date: report.date });

  const sender = env.EMAIL_FROM_REPORT || env.EMAIL_FROM_ORDER || env.EMAIL_FROM;
  const failed = [];
  for (const addr of to) {
    try {
      await sendEmail(env, { to: addr, from: sender, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (e) {
      failed.push({ to: addr, error: String(e && e.message ? e.message : e).slice(0, 200) });
    }
  }
  if (failed.length === to.length) return json({ error: "寄信全部失敗", failed }, 502);

  await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(lastKey, report.date)
    .run();
  return json({ ok: true, date: report.date, sent: to.length - failed.length, failed });
}

// ======================================================================
// 週報／月報
//   週報：每週一寄「上週一～上週日」；月報：每月 1 號寄「上個月整月」。日期一律台灣時間。
//   不需要另外設定排程：每天的日報排程（/api/cron/daily-report）寄完日報後，會順便檢查
//   「該寄的週報／月報寄了沒」，沒寄就寄（只在週一～週三／每月 1～3 號這個時間窗內補寄，避免寄出很舊的報表）。
//   也可以手動呼叫：POST /api/cron/weekly-report、POST /api/cron/monthly-report（標頭 X-Cron-Key）
//     ?dry=1 只回傳預覽  ?force=1 已寄過也再寄  ?date=YYYY-MM-DD（週報：該日所在那一週）  ?month=YYYY-MM（月報）
// ======================================================================
const DAY_MS = 86400000;
const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const ymd = (d) => d.toISOString().slice(0, 10);
const parseYmd = (str) => {
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const addDays = (str, n) => ymd(new Date(parseYmd(str).getTime() + n * DAY_MS));
const validYmd = (str) => /^\d{4}-\d{2}-\d{2}$/.test(str || "") && ymd(parseYmd(str)) === str;
const validYm = (str) => /^\d{4}-(0[1-9]|1[0-2])$/.test(str || "");
export const taipeiToday = () => ymd(new Date(Date.now() + 8 * 3600 * 1000));
const weekStartOf = (str) => addDays(str, -((parseYmd(str).getUTCDay() + 6) % 7)); // 週一
const monthRange = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return { start: ym + "-01", end: ymd(new Date(Date.UTC(y, m, 0))) };
};
const prevMonthOf = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return ymd(new Date(Date.UTC(y, m - 2, 1))).slice(0, 7);
};

// kind = "weekly" | "monthly"；param 沒給（或格式不對）就用「最近一個已經結束的週／月」
export function resolvePeriod(kind, param, today = taipeiToday()) {
  if (kind === "weekly") {
    const start = validYmd(param) ? weekStartOf(param) : addDays(weekStartOf(today), -7);
    const end = addDays(start, 6);
    return { kind, key: start, start, end, prevStart: addDays(start, -7), prevEnd: addDays(start, -1), label: `${start}～${end}`, days: 7 };
  }
  const ym = validYm(param) ? param : prevMonthOf(today.slice(0, 7));
  const cur = monthRange(ym);
  const prev = monthRange(prevMonthOf(ym));
  return { kind: "monthly", key: ym, start: cur.start, end: cur.end, prevStart: prev.start, prevEnd: prev.end, label: `${ym.slice(0, 4)} 年 ${Number(ym.slice(5))} 月`, days: Number(cur.end.slice(8)) };
}

export async function buildPeriodReport(env, kind, param, today) {
  const db = env.DB;
  const one = async (sql, ...b) => (await db.prepare(sql).bind(...b).first()) || {};
  const all = async (sql, ...b) => (await db.prepare(sql).bind(...b).all()).results || [];
  const period = resolvePeriod(kind, param, today);
  const { start, end, prevStart, prevEnd } = period;
  const paidDay = `strftime('%Y-%m-%d', datetime(paid_at, ${TZ}))`;
  const createdDay = `strftime('%Y-%m-%d', datetime(created_at, ${TZ}))`;

  const stat = (a, b) =>
    one(
      `SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS t,
              COALESCE(SUM(coupon_discount),0) AS coupon, COALESCE(SUM(points_discount),0) AS points,
              COUNT(DISTINCT COALESCE(member_id, member_name_snapshot)) AS payers
         FROM orders WHERE status='paid' AND ${paidDay} BETWEEN ? AND ?`,
      a,
      b
    );
  const cur = await stat(start, end);
  const prev = await stat(prevStart, prevEnd);

  // 每日走勢（沒有訂單的日子補 0）
  const dayRows = await all(
    `SELECT ${paidDay} AS d, COUNT(*) AS c, COALESCE(SUM(amount),0) AS t FROM orders
      WHERE status='paid' AND ${paidDay} BETWEEN ? AND ? GROUP BY d`,
    start,
    end
  );
  const dayMap = {};
  for (const r of dayRows) dayMap[r.d] = r;
  const daily = [];
  for (let i = 0; i < period.days; i++) {
    const d = addDays(start, i);
    daily.push({ date: d, dow: parseYmd(d).getUTCDay(), c: (dayMap[d] && dayMap[d].c) || 0, t: (dayMap[d] && dayMap[d].t) || 0 });
  }
  const bestDay = daily.reduce((b, x) => (x.t > (b ? b.t : 0) ? x : b), null);

  const lost = await one(
    `SELECT COUNT(*) AS created,
            SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid,
            SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN status='expired' OR (status IN ('pending_method','awaiting_payment','awaiting_barcode','ready_to_pay') AND expires_at <= datetime('now')) THEN 1 ELSE 0 END) AS expired
       FROM orders WHERE ${createdDay} BETWEEN ? AND ?`,
    start,
    end
  );

  const byMethod = await all(
    `SELECT COALESCE(payment_method,'-') AS m, COUNT(*) AS c, COALESCE(SUM(amount),0) AS t FROM orders
      WHERE status='paid' AND ${paidDay} BETWEEN ? AND ? GROUP BY m ORDER BY t DESC`,
    start,
    end
  );
  const byPlatform = await all(
    `SELECT COALESCE(platform,'-') AS p, COUNT(*) AS c, COALESCE(SUM(amount),0) AS t FROM orders
      WHERE status='paid' AND ${paidDay} BETWEEN ? AND ? GROUP BY p ORDER BY t DESC`,
    start,
    end
  );
  const topMembers = await all(
    `SELECT member_name_snapshot AS name, COUNT(*) AS c, SUM(amount) AS t FROM orders
      WHERE status='paid' AND ${paidDay} BETWEEN ? AND ?
      GROUP BY COALESCE(member_id, member_name_snapshot), member_name_snapshot ORDER BY t DESC LIMIT 10`,
    start,
    end
  );
  const peakHours = await all(
    `SELECT strftime('%H', datetime(paid_at, ${TZ})) AS h, COUNT(*) AS c, COALESCE(SUM(amount),0) AS t FROM orders
      WHERE status='paid' AND ${paidDay} BETWEEN ? AND ? GROUP BY h ORDER BY t DESC, h ASC LIMIT 3`,
    start,
    end
  );
  const wk = await all(
    `SELECT CAST(strftime('%w', datetime(paid_at, ${TZ})) AS INTEGER) AS w, COUNT(*) AS c, COALESCE(SUM(amount),0) AS t FROM orders
      WHERE status='paid' AND ${paidDay} BETWEEN ? AND ? GROUP BY w`,
    start,
    end
  );
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((w) => {
    const x = wk.find((r) => r.w === w);
    return { w, c: x ? x.c : 0, t: x ? x.t : 0 };
  });

  // 會員面：有會員帳號的付款人中，期間之前就付過款的 = 回頭客；其餘 = 首次儲值
  const mem = await one(
    `SELECT COUNT(DISTINCT o.member_id) AS paying,
            COUNT(DISTINCT CASE WHEN EXISTS (
              SELECT 1 FROM orders p WHERE p.member_id = o.member_id AND p.status='paid'
                 AND strftime('%Y-%m-%d', datetime(p.paid_at, ${TZ})) < ?) THEN o.member_id END) AS repeat_m
       FROM orders o WHERE o.status='paid' AND o.member_id IS NOT NULL
        AND strftime('%Y-%m-%d', datetime(o.paid_at, ${TZ})) BETWEEN ? AND ?`,
    start,
    start,
    end
  );
  let newMembers = 0;
  try {
    newMembers = (await one(`SELECT COUNT(*) AS c FROM members WHERE strftime('%Y-%m-%d', datetime(created_at, ${TZ})) BETWEEN ? AND ?`, start, end)).c || 0;
  } catch (e) {
    /* 沒有 members 表就當 0 */
  }

  const live = "expires_at > datetime('now')";
  const pend = await one(
    `SELECT SUM(CASE WHEN status='awaiting_barcode' AND ${live} THEN 1 ELSE 0 END) AS need_barcode,
            SUM(CASE WHEN status='awaiting_payment' AND ${live} AND proof_uploaded_at IS NOT NULL THEN 1 ELSE 0 END) AS need_verify,
            SUM(CASE WHEN status='paid' AND is_completed=0 THEN 1 ELSE 0 END) AS to_complete
       FROM orders`
  );

  const avg = (x) => (x.c ? Math.round(x.t / x.c) : 0);
  return {
    period,
    cur: { count: cur.c || 0, total: cur.t || 0, coupon: cur.coupon || 0, points: cur.points || 0, payers: cur.payers || 0, avg: avg({ c: cur.c, t: cur.t }) },
    prev: { count: prev.c || 0, total: prev.t || 0, avg: avg({ c: prev.c, t: prev.t }) },
    created: lost.created || 0,
    createdPaid: lost.paid || 0,
    cancelled: lost.cancelled || 0,
    expired: lost.expired || 0,
    daily,
    bestDay: bestDay && bestDay.t > 0 ? bestDay : null,
    byMethod,
    byPlatform,
    topMembers,
    peakHours,
    weekdays,
    members: { paying: mem.paying || 0, repeat: mem.repeat_m || 0, first: Math.max(0, (mem.paying || 0) - (mem.repeat_m || 0)), registered: newMembers },
    pending: { need_verify: pend.need_verify || 0, need_barcode: pend.need_barcode || 0, to_complete: pend.to_complete || 0 },
  };
}

export function renderPeriodReport(r, platformNames = {}) {
  const isW = r.period.kind === "weekly";
  const name = isW ? "週報" : "月報";
  const prevLabel = isW ? "上週" : "上月";
  const pname = (k) => (k === "-" ? "未指定" : platformNames[k] || k);
  const mname = (k) => METHOD_LABEL[k] || "未選擇";
  const chgIn = (c, p) => (p ? `較${prevLabel} ${c >= p ? "+" : ""}${Math.round(((c - p) / p) * 100)}%` : c ? `${prevLabel}沒有資料` : "");
  const chg = (c, p) => (chgIn(c, p) ? `（${chgIn(c, p)}）` : "");
  const cntChg = (n, c, p) => `（${n} 筆${chgIn(c, p) ? "，" + chgIn(c, p) : ""}）`; // 「（4 筆，較上週 +12%）」
  const share = (t, total) => (total ? Math.round((t / total) * 100) + "%" : "0%");
  const conv = r.created ? Math.round((r.createdPaid / r.created) * 100) + "%" : "-";
  const repeatPct = r.members.paying ? Math.round((r.members.repeat / r.members.paying) * 100) + "%" : "-";
  const maxDay = Math.max(1, ...r.daily.map((x) => x.t));
  const dlabel = (x) => `${x.date.slice(5).replace("-", "/")}（${WEEKDAY_ZH[x.dow]}）`;
  const bar = (n, max, cell) => "█".repeat(Math.max(n > 0 ? 1 : 0, Math.round((n / max) * cell)));

  const subject = `營運${name} ${r.period.label}｜儲值 ${money(r.cur.total)}${cntChg(r.cur.count, r.cur.total, r.prev.total)}`;

  const L = [];
  L.push(`營運${name} ${r.period.label}`, "");
  L.push("【總覽】");
  L.push(`儲值金額 ${money(r.cur.total)}${cntChg(r.cur.count, r.cur.total, r.prev.total)}`);
  L.push(`平均客單價 ${money(r.cur.avg)}${chg(r.cur.avg, r.prev.avg)}；付款人數 ${r.cur.payers}`);
  L.push(`新建立訂單 ${r.created} 筆，其中 ${r.createdPaid} 筆已付款（成交率 ${conv}）；取消 ${r.cancelled}、過期 ${r.expired}`);
  if (r.cur.coupon || r.cur.points) L.push(`折抵：優惠碼 ${money(r.cur.coupon)}、點數 ${money(r.cur.points)}`);
  L.push("", "【每日走勢】");
  for (const x of r.daily) L.push(`${dlabel(x)} ${bar(x.t, maxDay, 20).padEnd(1)} ${money(x.t)}（${x.c} 筆）`);
  if (r.bestDay) L.push(`最高的一天：${dlabel(r.bestDay)}，${money(r.bestDay.t)}`);
  if (r.byMethod.length) {
    L.push("", "【付款方式】");
    for (const x of r.byMethod) L.push(`${mname(x.m)}：${x.c} 筆 ${money(x.t)}（${share(x.t, r.cur.total)}）`);
  }
  if (r.byPlatform.length) {
    L.push("", "【儲值平台】");
    for (const x of r.byPlatform) L.push(`${pname(x.p)}：${x.c} 筆 ${money(x.t)}（${share(x.t, r.cur.total)}）`);
  }
  L.push("", "【會員】");
  L.push(`有會員帳號的付款人 ${r.members.paying} 人：首次儲值 ${r.members.first} 人、回頭客 ${r.members.repeat} 人（${repeatPct}）`);
  L.push(`新註冊會員 ${r.members.registered} 人`);
  if (r.peakHours.length) {
    L.push("", "【尖峰時段（依儲值金額）】");
    for (const x of r.peakHours) L.push(`${x.h}:00～${x.h}:59：${x.c} 筆 ${money(x.t)}`);
  }
  if (!isW) {
    const maxW = Math.max(1, ...r.weekdays.map((x) => x.t));
    L.push("", "【星期分布】");
    for (const x of r.weekdays) L.push(`週${WEEKDAY_ZH[x.w]} ${bar(x.t, maxW, 20)} ${money(x.t)}（${x.c} 筆）`);
  }
  if (r.topMembers.length) {
    L.push("", "【前 10 名會員】");
    r.topMembers.forEach((x, i) => L.push(`${i + 1}. ${x.name}：${x.c} 筆 ${money(x.t)}`));
  }
  L.push("", "【目前待處理】", `待核對付款 ${r.pending.need_verify}、待上傳條碼 ${r.pending.need_barcode}、已付款未結案 ${r.pending.to_complete}`);
  const text = L.join("\n");

  const h = (t) => `<h3 style="margin:22px 0 6px;font-size:15px;color:#3D2314">${t}</h3>`;
  const td = (v, right) => `<td style="padding:5px 8px;border-bottom:1px solid #eee;${right ? "text-align:right;" : ""}">${v}</td>`;
  const tbl = (rows) => `<table style="border-collapse:collapse;width:100%;font-size:14px">${rows.map((c) => `<tr>${c.map((v, i) => td(v, i > 0)).join("")}</tr>`).join("")}</table>`;
  const barRow = (label, n, max, right) =>
    `<tr>${td(label)}<td style="padding:5px 8px;border-bottom:1px solid #eee;width:45%"><div style="background:#c9a27a;height:10px;border-radius:3px;width:${Math.max(n > 0 ? 2 : 0, Math.round((n / max) * 100))}%"></div></td>${td(right, true)}</tr>`;
  const maxW2 = Math.max(1, ...r.weekdays.map((x) => x.t));

  const html = `<div style="font-family:-apple-system,'Noto Sans TC',sans-serif;max-width:600px;margin:0 auto;color:#222">
<h2 style="margin:0 0 4px;color:#3D2314">營運${name} ${esc(r.period.label)}</h2>
<div style="background:#faf5ef;border-radius:10px;padding:14px 16px;margin-top:10px">
  <div style="font-size:12px;color:#777">儲值金額（已付款）</div>
  <div style="font-size:28px;font-weight:700">${money(r.cur.total)}</div>
  <div style="font-size:13px;color:#555">${r.cur.count} 筆 ${esc(chg(r.cur.total, r.prev.total))}　平均客單價 ${money(r.cur.avg)}</div>
</div>
${h("訂單概況")}${tbl([
    [`${prevLabel}儲值`, `${money(r.prev.total)}（${r.prev.count} 筆）`],
    ["付款人數", r.cur.payers + " 人"],
    ["新建立訂單", `${r.created} 筆（成交率 ${conv}）`],
    ["取消／過期", `${r.cancelled} ／ ${r.expired} 筆`],
    ["優惠碼折抵", money(r.cur.coupon)],
    ["點數折抵", money(r.cur.points)],
  ])}
${h("每日走勢")}<table style="border-collapse:collapse;width:100%;font-size:13px">${r.daily.map((x) => barRow(esc(dlabel(x)), x.t, maxDay, `${money(x.t)}（${x.c}）`)).join("")}</table>
${r.bestDay ? `<div style="font-size:13px;color:#555;margin-top:6px">最高的一天：${esc(dlabel(r.bestDay))}，${money(r.bestDay.t)}</div>` : ""}
${r.byMethod.length ? h("付款方式") + tbl(r.byMethod.map((x) => [esc(mname(x.m)), `${x.c} 筆　${money(x.t)}（${share(x.t, r.cur.total)}）`])) : ""}
${r.byPlatform.length ? h("儲值平台") + tbl(r.byPlatform.map((x) => [esc(pname(x.p)), `${x.c} 筆　${money(x.t)}（${share(x.t, r.cur.total)}）`])) : ""}
${h("會員")}${tbl([
    ["付款人（有會員帳號）", r.members.paying + " 人"],
    ["首次儲值", r.members.first + " 人"],
    ["回頭客", `${r.members.repeat} 人（${repeatPct}）`],
    ["新註冊會員", r.members.registered + " 人"],
  ])}
${r.peakHours.length ? h("尖峰時段（依儲值金額）") + tbl(r.peakHours.map((x) => [`${x.h}:00～${x.h}:59`, `${x.c} 筆　${money(x.t)}`])) : ""}
${!isW ? h("星期分布") + `<table style="border-collapse:collapse;width:100%;font-size:13px">${r.weekdays.map((x) => barRow("週" + WEEKDAY_ZH[x.w], x.t, maxW2, `${money(x.t)}（${x.c}）`)).join("")}</table>` : ""}
${r.topMembers.length ? h("前 10 名會員") + tbl(r.topMembers.map((x, i) => [`${i + 1}. ${esc(x.name)}`, `${x.c} 筆　${money(x.t)}`])) : ""}
${h("目前待處理")}${tbl([
    ["待核對付款", `<b>${r.pending.need_verify}</b>`],
    ["待上傳條碼", `<b>${r.pending.need_barcode}</b>`],
    ["已付款未結案", r.pending.to_complete],
  ])}
<div style="font-size:11px;color:#999;margin-top:22px">日期以台灣時間（UTC+8）計算；統計只計「已付款」訂單，依付款時間；比較對象為${prevLabel}同長度的期間。</div>
</div>`;

  return { subject, html, text };
}

// 共用：驗證排程金鑰。通過回傳 null，沒通過回傳要直接回給呼叫端的 Response。
async function cronAuthError(request, env) {
  const key = String(env.CRON_SECRET || "").trim();
  const given = String(request.headers.get("x-cron-key") || "").trim();
  if (!key) return json({ error: "網站還沒有讀到 CRON_SECRET：請確認 Cloudflare Pages 的 Production 已新增這個 Secret，並且新增後重新部署過" }, 401);
  if (!safeEqual(key, given)) {
    return json({ error: `金鑰不正確（網站上的：${await keyFingerprint(key)}；GitHub 送來的：${await keyFingerprint(given)}）。兩邊要一模一樣` }, 401);
  }
  if (request.method !== "POST") return json({ error: "請用 POST" }, 405);
  return null;
}

// 寄出某一期的週報／月報給所有收件人。回傳物件（不是 Response）。
async function sendPeriodReportCore(env, kind, param, { force = false, today } = {}) {
  const report = await buildPeriodReport(env, kind, param, today);
  const mail = renderPeriodReport(report, await loadPlatformNames(env));
  const to = await reportRecipients(env);
  if (!to.length) return { error: "沒有收件人：請到後台「員工帳號」替管理員帳號設定信箱（或設定 DAILY_REPORT_TO 環境變數）", period: report.period.key };

  const lastKey = kind + "_report_last_sent";
  const last = (await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(lastKey).first())?.value;
  if (!force && last === report.period.key) return { ok: true, skipped: true, reason: "這一期已經寄過", period: report.period.key };

  const sender = env.EMAIL_FROM_REPORT || env.EMAIL_FROM_ORDER || env.EMAIL_FROM;
  const failed = [];
  for (const addr of to) {
    try {
      await sendEmail(env, { to: addr, from: sender, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (e) {
      failed.push({ to: addr, error: String(e && e.message ? e.message : e).slice(0, 200) });
    }
  }
  if (failed.length === to.length) return { error: "寄信全部失敗", failed, period: report.period.key };

  await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(lastKey, report.period.key)
    .run();
  return { ok: true, period: report.period.key, label: report.period.label, sent: to.length - failed.length, failed };
}

// 日報排程順便檢查：該寄的週報／月報寄了沒。today 可傳入（測試用）。
export async function runDuePeriodReports(env, today = taipeiToday()) {
  const out = {};
  let settings = {};
  try {
    settings = await getSettingsObj(env);
  } catch (e) {
    settings = {};
  }
  const sinceMonday = (parseYmd(today).getUTCDay() + 6) % 7; // 0 = 週一
  for (const kind of ["weekly", "monthly"]) {
    if (settings["report_" + kind + "_enabled"] === "0") {
      out[kind] = { skipped: true, reason: "已在後台關閉" };
      continue;
    }
    const inWindow = kind === "weekly" ? sinceMonday <= 2 : Number(today.slice(8)) <= 3;
    if (!inWindow) {
      out[kind] = { skipped: true, reason: "還沒到寄送時間" };
      continue;
    }
    try {
      out[kind] = await sendPeriodReportCore(env, kind, null, { today });
    } catch (e) {
      out[kind] = { error: String(e && e.message ? e.message : e).slice(0, 200) };
    }
  }
  return out;
}

// 每日排程入口：先寄日報（原本的行為不變），成功後順便處理週報／月報。
// ?dry=1、?date=（補寄特定日期）、?periodic=0 時不會碰週報／月報。
export async function handleDailyReportCron(request, env) {
  const res = await dailyReportCronCore(request, env);
  if (res.status !== 200) return res;
  const url = new URL(request.url);
  if (url.searchParams.get("dry") === "1" || url.searchParams.get("date") || url.searchParams.get("periodic") === "0") return res;
  let body;
  try {
    body = await res.clone().json();
  } catch (e) {
    return res;
  }
  try {
    body.periodic = await runDuePeriodReports(env);
  } catch (e) {
    body.periodic = { error: String(e && e.message ? e.message : e).slice(0, 200) };
  }
  return json(body);
}

// POST /api/cron/weekly-report、/api/cron/monthly-report
export async function handlePeriodReportCron(request, env, kind) {
  const bad = await cronAuthError(request, env);
  if (bad) return bad;
  const url = new URL(request.url);
  const param = kind === "weekly" ? url.searchParams.get("date") : url.searchParams.get("month");
  if (url.searchParams.get("dry") === "1") {
    const report = await buildPeriodReport(env, kind, param);
    const mail = renderPeriodReport(report, await loadPlatformNames(env));
    return json({ ok: true, dry: true, to: await reportRecipients(env), report, subject: mail.subject, text: mail.text });
  }
  const r = await sendPeriodReportCore(env, kind, param, { force: url.searchParams.get("force") === "1" });
  return json(r, r.error ? (r.failed ? 502 : 400) : 200);
}

// 後台「寄一封測試週報／月報」：把最近一期只寄給目前登入的管理員自己；不寫入「已寄過」的紀錄。
export async function handlePeriodReportTest(request, env, session) {
  const body = await request.json().catch(() => ({}));
  const kind = body && body.kind === "monthly" ? "monthly" : "weekly";
  let me;
  try {
    me = await env.DB.prepare("SELECT username, email FROM admins WHERE id=?").bind(session.adminId).first();
  } catch (e) {
    if (/no such column/i.test(String(e && e.message))) return json({ error: "資料庫尚未升級，請先執行 migrate_v24.sql" }, 400);
    throw e;
  }
  const email = String((me && me.email) || "").trim();
  if (!email || !MAIL_RE.test(email)) {
    return json({ error: "你的帳號還沒有設定信箱：請先在「帳號列表」按自己那一列的「設定信箱」，再寄測試報表" }, 400);
  }
  const report = await buildPeriodReport(env, kind, null);
  const mail = renderPeriodReport(report, await loadPlatformNames(env));
  const sender = env.EMAIL_FROM_REPORT || env.EMAIL_FROM_ORDER || env.EMAIL_FROM;
  const note = "（這是從後台寄出的測試信，只寄給你自己；正式報表不受影響。）";
  try {
    await sendEmail(env, { to: email, from: sender, subject: "【測試】" + mail.subject, html: `<p style="color:#888;font-size:12px;">${esc(note)}</p>` + mail.html, text: note + "\n\n" + mail.text });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (msg === "EMAIL_NOT_CONFIGURED") return json({ error: "寄信服務還沒設定好：需要 RESEND_API_KEY（secret）和 EMAIL_FROM（或 EMAIL_FROM_REPORT）" }, 400);
    return json({ error: "寄信失敗：" + msg.replace(/^EMAIL_SEND_FAILED:/, "").slice(0, 200) }, 502);
  }
  return json({ ok: true, kind, to: email, label: report.period.label, sender: sender || "" });
}

// 後台「週報／月報要不要寄」的開關。沒設定過 = 兩個都開。
export async function handleReportSettings(request, env) {
  const readAll = async () => {
    const s = await getSettingsObj(env).catch(() => ({}));
    return {
      weekly: s.report_weekly_enabled !== "0",
      monthly: s.report_monthly_enabled !== "0",
      last: { weekly: s.weekly_report_last_sent || null, monthly: s.monthly_report_last_sent || null },
    };
  };
  if (request.method === "GET") return json(await readAll());
  const body = await request.json().catch(() => ({}));
  const up = "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value";
  if (typeof body.weekly === "boolean") await env.DB.prepare(up).bind("report_weekly_enabled", body.weekly ? "1" : "0").run();
  if (typeof body.monthly === "boolean") await env.DB.prepare(up).bind("report_monthly_enabled", body.monthly ? "1" : "0").run();
  return json({ ok: true, ...(await readAll()) });
}
