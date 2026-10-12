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

// POST /api/cron/daily-report   標頭 X-Cron-Key: <CRON_SECRET>
//   ?date=YYYY-MM-DD   指定要統計的日期（預設昨天）
//   ?dry=1             只回傳預覽（JSON），不寄信也不記錄
//   ?force=1           同一天已經寄過也再寄一次
export async function handleDailyReportCron(request, env) {
  const key = env.CRON_SECRET || "";
  const given = request.headers.get("x-cron-key") || "";
  if (!key || !safeEqual(key, given)) return json({ error: "金鑰不正確" }, 401);
  if (request.method !== "POST") return json({ error: "請用 POST" }, 405);

  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";

  const report = await buildDailyReport(env, url.searchParams.get("date"));

  let platformNames = {};
  try {
    for (const p of await getPlatforms(env.DB)) platformNames[p.key] = p.name;
  } catch (e) {
    platformNames = {};
  }
  const mail = renderDailyReport(report, platformNames);

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
