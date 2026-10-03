// ========================================================================
// 點數系統
// - 餘額 = points_ledger 該會員所有 delta 加總（不另存餘額）
// - 訂單回饋：訂單「已付款」且標記為「訂單完成(結案)」時依實付金額給點；取消結案 / 取消 / 刪除 / 改會員時自動扣回或轉移
// - 訂單折抵：下單當下先扣點；訂單取消 / 過期 / 刪除時自動退回
// - 點數商城：兌換當下扣點；後台拒絕時退點並補回庫存
// ========================================================================
import { formatOrderNo } from "./helpers.js";

const DEFAULTS = { enabled: "1", earn_per: "100", redeem_value: "1", max_percent: "50" };

export async function getPointsConfig(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings WHERE key LIKE 'points_%'").all();
  const raw = { ...DEFAULTS };
  for (const r of results) raw[r.key.replace(/^points_/, "")] = r.value;
  const earnPer = Math.max(1, parseInt(raw.earn_per, 10) || 100);
  const redeemValue = Math.max(1, parseInt(raw.redeem_value, 10) || 1);
  const maxPercent = Math.min(90, Math.max(1, parseInt(raw.max_percent, 10) || 50));
  // 三個功能可以個別開關；舊版只有一個總開關（points_enabled），沒設定過個別開關時沿用總開關
  const base = raw.enabled !== "0";
  const flag = (k) => (raw[k] !== undefined ? raw[k] !== "0" : base);
  return {
    earnEnabled: flag("earn_enabled"),
    discountEnabled: flag("discount_enabled"),
    shopEnabled: flag("shop_enabled"),
    earnPer,
    redeemValue,
    maxPercent,
  };
}

export async function savePointsConfig(env, body) {
  const earnOn = !!body.earn_enabled;
  const discountOn = !!body.discount_enabled;
  const shopOn = !!body.shop_enabled;
  const cur = await getPointsConfig(env);
  // 該功能開著才檢查對應欄位；關閉的功能欄位填錯也沒關係，沿用原本的設定值
  let earnPer = parseInt(body.earn_per, 10);
  if (earnOn && (!earnPer || earnPer < 1)) return { ok: false, error: "「每實付幾元得 1 點」必須是 1 以上的整數" };
  if (!earnPer || earnPer < 1) earnPer = cur.earnPer;
  let redeemValue = parseInt(body.redeem_value, 10);
  if (discountOn && (!redeemValue || redeemValue < 1)) return { ok: false, error: "「1 點可折抵幾元」必須是 1 以上的整數" };
  if (!redeemValue || redeemValue < 1) redeemValue = cur.redeemValue;
  let maxPercent = parseInt(body.max_percent, 10);
  if (discountOn && (!maxPercent || maxPercent < 1 || maxPercent > 90)) return { ok: false, error: "折抵上限必須是 1～90 的整數（%）" };
  if (!maxPercent || maxPercent < 1 || maxPercent > 90) maxPercent = cur.maxPercent;
  const entries = [
    ["points_enabled", earnOn || discountOn || shopOn ? "1" : "0"],
    ["points_earn_enabled", earnOn ? "1" : "0"],
    ["points_discount_enabled", discountOn ? "1" : "0"],
    ["points_shop_enabled", shopOn ? "1" : "0"],
    ["points_earn_per", String(earnPer)],
    ["points_redeem_value", String(redeemValue)],
    ["points_max_percent", String(maxPercent)],
  ];
  for (const [k, v] of entries) {
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .bind(k, v)
      .run();
  }
  return { ok: true };
}

export async function getBalance(env, memberId) {
  const row = await env.DB.prepare("SELECT COALESCE(SUM(delta), 0) AS b FROM points_ledger WHERE member_id=?").bind(memberId).first();
  return row ? row.b : 0;
}

export async function addLedger(env, { memberId, delta, type, orderId = null, refId = null, note = null }) {
  if (!delta) return;
  await env.DB.prepare("INSERT INTO points_ledger (member_id, delta, type, order_id, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(memberId, delta, type, orderId, refId, note)
    .run();
}

// 原子性扣點：單一 SQL 同時檢查餘額與寫入，餘額不足就不會寫入（避免連點兩次重複花同一批點數）。
export async function spendAtomic(env, { memberId, points, type, orderId = null, refId = null, note = null }) {
  const r = await env.DB.prepare(
    `INSERT INTO points_ledger (member_id, delta, type, order_id, ref_id, note)
     SELECT ?, ?, ?, ?, ?, ?
     WHERE (SELECT COALESCE(SUM(delta), 0) FROM points_ledger WHERE member_id=?) >= ?`
  )
    .bind(memberId, -points, type, orderId, refId, note, memberId, points)
    .run();
  return r.meta.changes > 0;
}

// 讓某筆訂單的點數紀錄與訂單目前狀態一致（可重複呼叫，已一致時不會寫入任何東西）。
//   gone:   訂單即將被刪除 → 一律視為 0（扣回回饋、退回折抵）
//   recalc: 訂單金額被更正 → 依目前金額與費率重算回饋點數
export async function reconcileOrderPoints(env, order, { gone = false, recalc = false } = {}) {
  const cfg = await getPointsConfig(env);
  const orderNo = formatOrderNo(order.id);
  const { results } = await env.DB.prepare(
    "SELECT member_id, type, SUM(delta) AS s FROM points_ledger WHERE order_id=? AND type IN ('earn','spend') GROUP BY member_id, type"
  )
    .bind(order.id)
    .all();

  const target = gone ? null : order.member_id || null;
  let currEarn = 0;
  let currSpend = 0;

  for (const g of results) {
    if (!g.s) continue;
    if (g.member_id !== target) {
      // 屬於別的會員（訂單改了會員）或訂單被刪除 → 全部沖回
      await addLedger(env, {
        memberId: g.member_id,
        delta: -g.s,
        type: g.type,
        orderId: order.id,
        note: gone ? `訂單 ${orderNo} 已刪除，${g.type === "earn" ? "扣回回饋點數" : "退回折抵點數"}` : `訂單 ${orderNo} 更換會員，沖回`,
      });
    } else if (g.type === "earn") currEarn = g.s;
    else currSpend = g.s;
  }

  if (!target) return;

  // 訂單回饋：必須「已付款」而且「訂單完成(結案)」才給點；取消結案 / 取消訂單會自動扣回
  let wantEarn = 0;
  if (order.status === "paid" && order.is_completed) {
    if (cfg.earnEnabled) wantEarn = currEarn > 0 && !recalc ? currEarn : Math.floor(Number(order.amount) / cfg.earnPer);
    else wantEarn = currEarn; // 發點關閉時：不再發新點，但已發的不動
  }
  if (wantEarn !== currEarn) {
    await addLedger(env, {
      memberId: target,
      delta: wantEarn - currEarn,
      type: "earn",
      orderId: order.id,
      note:
        wantEarn > currEarn
          ? `訂單 ${orderNo} 完成回饋`
          : order.status === "paid" && order.is_completed
          ? `訂單 ${orderNo} 金額調整`
          : order.status === "paid"
          ? `訂單 ${orderNo} 取消結案，扣回回饋點數`
          : `訂單 ${orderNo} ${order.status === "cancelled" ? "已取消" : "未付款"}，扣回回饋點數`,
    });
  }

  // 折抵點數（下單時已扣；取消 / 過期時退回）
  const used = Number(order.points_used) || 0;
  const wantSpend = used > 0 && order.status !== "cancelled" && order.status !== "expired" ? -used : 0;
  if (wantSpend !== currSpend) {
    await addLedger(env, {
      memberId: target,
      delta: wantSpend - currSpend,
      type: "spend",
      orderId: order.id,
      note: wantSpend < currSpend ? `訂單 ${orderNo} 折抵` : `訂單 ${orderNo} ${order.status === "cancelled" ? "已取消" : "已過期"}，退回折抵點數`,
    });
  }
}

export async function reconcileOrderById(env, orderId, opts) {
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first();
  if (order) await reconcileOrderPoints(env, order, opts);
}

// 會員查看點數時順便處理「已過期 / 已取消但折抵點數還沒退回」的訂單
export async function reconcileMemberSpends(env, memberId) {
  await env.DB.prepare(
    "UPDATE orders SET status='expired' WHERE member_id=? AND points_used>0 AND status IN ('pending_method','awaiting_payment','awaiting_barcode','ready_to_pay') AND expires_at < datetime('now')"
  )
    .bind(memberId)
    .run();
  const { results } = await env.DB.prepare(
    "SELECT * FROM orders WHERE member_id=? AND points_used>0 AND status IN ('expired','cancelled')"
  )
    .bind(memberId)
    .all();
  for (const o of results) await reconcileOrderPoints(env, o);
}

// ---- 分頁工具 ----
export function parsePage(url, defaultSize, maxSize = 50) {
  const page = Math.max(1, parseInt(url.searchParams.get("page"), 10) || 1);
  const size = Math.min(maxSize, Math.max(1, parseInt(url.searchParams.get("size"), 10) || defaultSize));
  return { page, size, offset: (page - 1) * size };
}
