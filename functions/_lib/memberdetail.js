// 會員詳細頁：基本資料、消費總覽、訂單歷史、點數紀錄、標籤、備註紀錄、封鎖下單
import { jsonRes as json, formatOrderNo, nowIso } from "./helpers.js";

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
