// 會員詳細頁：基本資料、消費總覽、訂單歷史、點數紀錄、標籤、備註紀錄、封鎖下單
import { jsonRes as json, formatOrderNo, nowIso } from "./helpers.js";
import { getTierConfig, resolveTier } from "./tiers.js";

export const MEMBER_TAG_MAX_COUNT = 10;
export const MEMBER_TAG_MAX_LEN = 12;
export const MEMBER_NOTE_MAX_LEN = 500;
export const BLOCK_REASON_MAX_LEN = 200;

const MIGRATE_HINT = "資料庫尚未升級，請先在 D1 執行 migrate_v26.sql";
const isMissingColumn = (e) => /no such (column|table)/i.test(String(e && e.message));

// 整理標籤：去掉控制字元、多餘空白、重複（不分大小寫），每個最長 12 個字，最多 10 個
export function normalizeTags(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    let t = String(raw == null ? "" : raw)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    t = Array.from(t).slice(0, MEMBER_TAG_MAX_LEN).join("").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MEMBER_TAG_MAX_COUNT) break;
  }
  return out;
}

export function parseTags(raw) {
  if (!raw) return [];
  try {
    return normalizeTags(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function handleMemberDetail(id, env) {
  const member = await env.DB.prepare(
    `SELECT m.*, r.name AS referred_by_name
     FROM members m LEFT JOIN members r ON r.id = m.referred_by
     WHERE m.id=?`
  )
    .bind(id)
    .first();
  if (!member) return json({ error: "找不到此會員" }, 404);

  const stats = await env.DB.prepare(
    `SELECT COUNT(*) AS total_count,
            COALESCE(SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END), 0) AS paid_count,
            COALESCE(SUM(CASE WHEN status='paid' THEN amount END), 0) AS paid_total,
            COALESCE(SUM(CASE WHEN status IN ('expired','cancelled') THEN 1 ELSE 0 END), 0) AS dead_count,
            COALESCE(SUM(CASE WHEN status NOT IN ('paid','expired','cancelled') THEN 1 ELSE 0 END), 0) AS open_count,
            COALESCE(SUM(CASE WHEN status='paid' AND paid_at >= datetime(date('now','+8 hours','start of month'), '-8 hours') THEN amount END), 0) AS month_total,
            MIN(created_at) AS first_order_at,
            MAX(created_at) AS last_order_at
     FROM orders WHERE member_id=?`
  )
    .bind(id)
    .first();

  const { results: orderRows } = await env.DB.prepare(
    `SELECT id, amount, status, platform, payment_method, created_at, paid_at, is_completed, coins, points_used, coupon_code
     FROM orders WHERE member_id=? ORDER BY id DESC LIMIT 50`
  )
    .bind(id)
    .all();
  const orders = orderRows.map((o) => ({ ...o, order_no: formatOrderNo(o.id) }));

  const pts = await env.DB.prepare(
    `SELECT COALESCE(SUM(delta), 0) AS balance,
            COALESCE(SUM(CASE WHEN delta > 0 THEN delta END), 0) AS earned,
            COALESCE(SUM(CASE WHEN delta < 0 THEN -delta END), 0) AS spent
     FROM points_ledger WHERE member_id=?`
  )
    .bind(id)
    .first();
  const { results: ledger } = await env.DB.prepare(
    "SELECT id, delta, type, note, order_id, created_at FROM points_ledger WHERE member_id=? ORDER BY id DESC LIMIT 30"
  )
    .bind(id)
    .all();

  let notes = [];
  let migrated = true;
  try {
    const r = await env.DB.prepare("SELECT id, content, admin_username, created_at FROM member_notes WHERE member_id=? ORDER BY id DESC LIMIT 100")
      .bind(id)
      .all();
    notes = r.results;
  } catch (e) {
    if (!isMissingColumn(e)) throw e;
    migrated = false; // 還沒執行 migrate_v26.sql
  }

  const ref = await env.DB.prepare("SELECT COUNT(*) AS c FROM members WHERE referred_by=?").bind(id).first();

  const tierCfg = await getTierConfig(env);

  return json({
    migrated,
    member: {
      id: member.id,
      name: member.name,
      account: member.account,
      phone: member.phone,
      email: member.email,
      email_verified_at: member.email_verified_at,
      tiktok_id: member.tiktok_id,
      note: member.note,
      referral_code: member.referral_code,
      referred_by_name: member.referred_by_name,
      created_at: member.created_at,
      tags: parseTags(member.tags),
      is_blocked: !!member.is_blocked,
      blocked_reason: member.blocked_reason || null,
      blocked_at: member.blocked_at || null,
      blocked_by: member.blocked_by || null,
    },
    stats: {
      ...stats,
      avg_paid: stats.paid_count ? Math.round((stats.paid_total / stats.paid_count) * 100) / 100 : 0,
    },
    tier: (() => {
      if (!tierCfg.enabled || !tierCfg.tiers.length) return null;
      const r = resolveTier(tierCfg, stats.paid_total);
      return { name: r.name, rate_percent: r.ratePercent, next_name: r.next ? r.next.name : null, remaining: r.remaining };
    })(),
    points: { balance: pts.balance, earned: pts.earned, spent: pts.spent, ledger },
    orders,
    notes,
    referred_count: ref ? ref.c : 0,
  });
}

export async function handleMemberSetTags(id, request, env) {
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.tags)) return json({ error: "標籤格式錯誤" }, 400);
  const member = await env.DB.prepare("SELECT id, name FROM members WHERE id=?").bind(id).first();
  if (!member) return json({ error: "找不到此會員" }, 404);
  const tags = normalizeTags(body.tags);
  try {
    await env.DB.prepare("UPDATE members SET tags=? WHERE id=?").bind(tags.length ? JSON.stringify(tags) : null, id).run();
  } catch (e) {
    if (isMissingColumn(e)) return json({ error: MIGRATE_HINT }, 400);
    throw e;
  }
  return json({ ok: true, tags, name: member.name });
}

export async function handleMemberSetBlock(id, request, env, session) {
  const body = await request.json().catch(() => ({}));
  const member = await env.DB.prepare("SELECT id, name FROM members WHERE id=?").bind(id).first();
  if (!member) return json({ error: "找不到此會員" }, 404);
  const blocked = !!body.blocked;
  const reason = blocked ? String(body.reason || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, BLOCK_REASON_MAX_LEN) : "";
  try {
    if (blocked) {
      await env.DB.prepare("UPDATE members SET is_blocked=1, blocked_reason=?, blocked_at=?, blocked_by=? WHERE id=?")
        .bind(reason || null, nowIso(), (session && session.username) || null, id)
        .run();
    } else {
      await env.DB.prepare("UPDATE members SET is_blocked=0, blocked_reason=NULL, blocked_at=NULL, blocked_by=NULL WHERE id=?").bind(id).run();
    }
  } catch (e) {
    if (isMissingColumn(e)) return json({ error: MIGRATE_HINT }, 400);
    throw e;
  }
  return json({ ok: true, is_blocked: blocked, reason, name: member.name });
}

export async function handleMemberAddNote(id, request, env, session) {
  const body = await request.json().catch(() => ({}));
  const content = String(body.content || "").replace(/\r\n/g, "\n").trim();
  if (!content) return json({ error: "請輸入備註內容" }, 400);
  if (Array.from(content).length > MEMBER_NOTE_MAX_LEN) return json({ error: "備註最多 " + MEMBER_NOTE_MAX_LEN + " 字" }, 400);
  const member = await env.DB.prepare("SELECT id, name FROM members WHERE id=?").bind(id).first();
  if (!member) return json({ error: "找不到此會員" }, 404);
  const who = (session && session.username) || "未知";
  try {
    const r = await env.DB.prepare("INSERT INTO member_notes (member_id, content, admin_username) VALUES (?, ?, ?)").bind(id, content, who).run();
    const row = await env.DB.prepare("SELECT id, content, admin_username, created_at FROM member_notes WHERE id=?").bind(r.meta.last_row_id).first();
    return json({ ok: true, note: row, name: member.name, content });
  } catch (e) {
    if (isMissingColumn(e)) return json({ error: MIGRATE_HINT }, 400);
    throw e;
  }
}

export async function handleMemberDeleteNote(id, noteId, env) {
  try {
    const row = await env.DB.prepare("SELECT id, content FROM member_notes WHERE id=? AND member_id=?").bind(noteId, id).first();
    if (!row) return json({ error: "找不到這則備註" }, 404);
    await env.DB.prepare("DELETE FROM member_notes WHERE id=?").bind(noteId).run();
    return json({ ok: true, content: row.content });
  } catch (e) {
    if (isMissingColumn(e)) return json({ error: MIGRATE_HINT }, 400);
    throw e;
  }
}

// 訂單列表用：幫每筆訂單補上會員的標籤與封鎖狀態（member_tags、member_blocked）。
// 還沒執行 migrate_v26.sql（沒有這兩個欄位）時，一律當成沒有標籤、沒有封鎖，訂單列表照常運作。
export async function attachMemberFlags(env, orders) {
  const ids = [...new Set(orders.map((o) => o.member_id).filter((x) => x != null))];
  const byId = new Map();
  try {
    for (let i = 0; i < ids.length; i += 90) {
      const part = ids.slice(i, i + 90);
      const { results } = await env.DB.prepare("SELECT id, tags, is_blocked FROM members WHERE id IN (" + part.map(() => "?").join(",") + ")")
        .bind(...part)
        .all();
      results.forEach((m) => byId.set(m.id, m));
    }
  } catch (e) {
    if (!isMissingColumn(e)) throw e;
  }
  // 每張訂單有幾個品項設定了「寄送序號」：「訂單完成」視窗用它來提醒要不要寄信。
  // 還沒執行 migrate_v29.sql（沒有 delivery_note 欄位）時一律當 0。
  const serialByOrder = new Map();
  try {
    const oids = orders.map((o) => o.id);
    for (let i = 0; i < oids.length; i += 90) {
      const part = oids.slice(i, i + 90);
      const { results } = await env.DB.prepare(
        "SELECT order_id, COUNT(*) AS c FROM order_items WHERE order_id IN (" + part.map(() => "?").join(",") + ") AND delivery_note IS NOT NULL AND TRIM(delivery_note) != '' GROUP BY order_id"
      )
        .bind(...part)
        .all();
      results.forEach((r) => serialByOrder.set(r.order_id, r.c));
    }
  } catch (e) {
    if (!isMissingColumn(e)) throw e;
  }
  return orders.map((o) => {
    const m = o.member_id != null ? byId.get(o.member_id) : null;
    return { ...o, member_tags: m ? parseTags(m.tags) : [], member_blocked: !!(m && m.is_blocked), serial_count: serialByOrder.get(o.id) || 0 };
  });
}
