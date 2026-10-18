// ========================================================================
// 會員等級
// - 依「累積儲值金額」分級：該會員所有「已付款」訂單的實付金額（orders.amount）加總
// - 每個等級可以設定：點數倍率（訂單完成發點時乘上去）、專屬優惠碼（只有該等級以上的會員能用）
// - 設定存在 settings 表（key = member_tiers，JSON），不需要資料庫升級
// - 這個檔案只靠資料庫，不 import 其他模組（points.js、helpers.js 都會用到它，避免循環引用）
// ========================================================================

const KEY = "member_tiers";

export const TIER_MAX = 8;
export const TIER_NAME_MAX = 12;
export const TIER_CODES_MAX = 5;
export const RATE_MIN = 100; // 1.0 倍
export const RATE_MAX = 1000; // 10 倍
export const THRESHOLD_MAX = 1000000000;
const CODE_RE = /^[A-Z0-9_-]{1,32}$/;

export const DEFAULT_TIER_CONFIG = { enabled: false, base_name: "一般會員", tiers: [] };

const cleanName = (v) => String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, TIER_NAME_MAX);

// 把資料庫裡存的 JSON 整理成標準格式（寬鬆：壞資料直接丟掉，不丟錯）
export function normalizeTierConfig(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const tiers = [];
  for (const t of Array.isArray(o.tiers) ? o.tiers : []) {
    if (!t || typeof t !== "object") continue;
    const name = cleanName(t.name);
    const threshold = Math.round(Number(t.threshold));
    if (!name || !Number.isFinite(threshold) || threshold < 1 || threshold > THRESHOLD_MAX) continue;
    let rate = Math.round(Number(t.rate_percent));
    if (!Number.isFinite(rate) || rate < RATE_MIN) rate = RATE_MIN;
    if (rate > RATE_MAX) rate = RATE_MAX;
    const codes = [];
    for (const c of Array.isArray(t.coupon_codes) ? t.coupon_codes : []) {
      const code = String(c || "").trim().toUpperCase();
      if (CODE_RE.test(code) && !codes.includes(code)) codes.push(code);
    }
    tiers.push({ name, threshold, rate_percent: rate, coupon_codes: codes.slice(0, TIER_CODES_MAX) });
  }
  tiers.sort((a, b) => a.threshold - b.threshold);
  return {
    enabled: o.enabled === true,
    base_name: cleanName(o.base_name) || DEFAULT_TIER_CONFIG.base_name,
    tiers: tiers.slice(0, TIER_MAX),
  };
}

// 儲存前的嚴格檢查：有問題就回傳中文錯誤訊息（不會靜悄悄修正）
export function validateTierInput(body) {
  const b = body && typeof body === "object" ? body : {};
  const baseName = cleanName(b.base_name) || DEFAULT_TIER_CONFIG.base_name;
  const list = Array.isArray(b.tiers) ? b.tiers : [];
  if (list.length > TIER_MAX) return { ok: false, error: `等級最多 ${TIER_MAX} 個` };
  const tiers = [];
  const names = new Set([baseName.toLowerCase()]);
  const allCodes = new Set();
  for (let i = 0; i < list.length; i++) {
    const t = list[i] || {};
    const n = i + 1;
    const rawName = String(t.name == null ? "" : t.name).trim().replace(/\s+/g, " ");
    if (!rawName) return { ok: false, error: `第 ${n} 個等級請輸入名稱` };
    if (rawName.length > TIER_NAME_MAX) return { ok: false, error: `「${rawName}」的名稱最多 ${TIER_NAME_MAX} 個字` };
    if (names.has(rawName.toLowerCase())) return { ok: false, error: `等級名稱「${rawName}」重複了（也不能和基本等級同名）` };
    names.add(rawName.toLowerCase());
    const threshold = Number(t.threshold);
    if (!Number.isFinite(threshold) || threshold < 1 || threshold > THRESHOLD_MAX || Math.round(threshold) !== threshold) {
      return { ok: false, error: `「${rawName}」的累積儲值門檻必須是 1 以上的整數（元）` };
    }
    const rate = Number(t.rate_percent);
    if (!Number.isFinite(rate) || Math.round(rate) !== rate || rate < RATE_MIN || rate > RATE_MAX) {
      return { ok: false, error: `「${rawName}」的點數倍率必須在 1.0～10 倍之間` };
    }
    const codes = [];
    for (const c of Array.isArray(t.coupon_codes) ? t.coupon_codes : []) {
      const code = String(c || "").trim().toUpperCase();
      if (!code) continue;
      if (!CODE_RE.test(code)) return { ok: false, error: `優惠碼「${code}」格式不正確（只能用英文、數字、-、_）` };
      if (allCodes.has(code)) return { ok: false, error: `優惠碼「${code}」重複了（同一組優惠碼只能屬於一個等級）` };
      allCodes.add(code);
      codes.push(code);
    }
    if (codes.length > TIER_CODES_MAX) return { ok: false, error: `「${rawName}」的專屬優惠碼最多 ${TIER_CODES_MAX} 組` };
    tiers.push({ name: rawName, threshold, rate_percent: rate, coupon_codes: codes });
  }
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].threshold === sorted[i - 1].threshold) {
      return { ok: false, error: `「${sorted[i - 1].name}」和「${sorted[i].name}」的門檻金額相同，每個等級的門檻必須不一樣` };
    }
  }
  return { ok: true, config: { enabled: b.enabled === true, base_name: baseName, tiers: sorted } };
}

export async function getTierConfig(env) {
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(KEY).first();
    if (row && row.value) return normalizeTierConfig(JSON.parse(row.value));
  } catch (e) {
    // 讀不到就當作沒設定
  }
  return normalizeTierConfig(null);
}

// 專屬優惠碼必須真的存在（避免打錯字）。回傳不存在的碼
export async function findMissingCoupons(env, codes) {
  const missing = [];
  for (const code of codes) {
    const row = await env.DB.prepare("SELECT id FROM coupons WHERE UPPER(code)=?").bind(code).first();
    if (!row) missing.push(code);
  }
  return missing;
}

export async function saveTierConfig(env, body) {
  const v = validateTierInput(body);
  if (!v.ok) return v;
  const all = v.config.tiers.flatMap((t) => t.coupon_codes);
  const missing = await findMissingCoupons(env, all);
  if (missing.length) return { ok: false, error: `找不到優惠碼：${missing.join("、")}（請先到「優惠碼」分頁建立）` };
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(KEY, JSON.stringify(v.config))
    .run();
  return { ok: true, config: v.config };
}

// 累積儲值金額：所有「已付款」訂單的實付金額加總。excludeOrderId = 計算某一筆訂單的回饋時，不把它自己算進去
export async function memberPaidTotal(env, memberId, excludeOrderId = null) {
  if (!memberId) return 0;
  const row = excludeOrderId
    ? await env.DB.prepare("SELECT COALESCE(SUM(amount), 0) AS t FROM orders WHERE member_id=? AND status='paid' AND id<>?").bind(memberId, excludeOrderId).first()
    : await env.DB.prepare("SELECT COALESCE(SUM(amount), 0) AS t FROM orders WHERE member_id=? AND status='paid'").bind(memberId).first();
  return row ? Number(row.t) || 0 : 0;
}

// 依累積金額判斷等級。index = -1 代表基本等級；剛好達到門檻就算升級
export function resolveTier(cfg, total) {
  const t = Number(total) || 0;
  if (!cfg.enabled || !cfg.tiers.length) {
    return { index: -1, name: cfg.base_name, ratePercent: 100, couponCodes: [], threshold: 0, next: null, remaining: 0, progress: 1 };
  }
  let index = -1;
  for (let i = 0; i < cfg.tiers.length; i++) if (t >= cfg.tiers[i].threshold) index = i;
  const cur = index >= 0 ? cfg.tiers[index] : null;
  const next = index + 1 < cfg.tiers.length ? cfg.tiers[index + 1] : null;
  const curThreshold = cur ? cur.threshold : 0;
  return {
    index,
    name: cur ? cur.name : cfg.base_name,
    ratePercent: cur ? cur.rate_percent : 100,
    couponCodes: cur ? cur.coupon_codes : [],
    threshold: curThreshold,
    next,
    remaining: next ? Math.max(0, next.threshold - t) : 0,
    progress: next ? Math.min(1, Math.max(0, (t - curThreshold) / (next.threshold - curThreshold))) : 1,
  };
}

// 訂單完成發點時的倍率：以「這筆訂單之前」的累積金額判斷等級（升級後的下一筆才享有新倍率）
export async function tierRateForOrder(env, order) {
  if (!order || !order.member_id) return { ratePercent: 100, name: null };
  const cfg = await getTierConfig(env);
  if (!cfg.enabled || !cfg.tiers.length) return { ratePercent: 100, name: null };
  const total = await memberPaidTotal(env, order.member_id, order.id);
  const r = resolveTier(cfg, total);
  return { ratePercent: r.ratePercent, name: r.name };
}

// 這組優惠碼是不是某個等級的專屬碼？回傳需要的等級 index；不是專屬碼回傳 -1（等級功能關閉時一律當一般優惠碼）
export function couponRequiredIndex(cfg, code) {
  if (!cfg.enabled) return -1;
  const c = String(code || "").trim().toUpperCase();
  return cfg.tiers.findIndex((t) => t.coupon_codes.includes(c));
}

// 會員端使用優惠碼時檢查：專屬碼只有該等級（含）以上的會員能用
export async function checkCouponForMember(env, memberId, code) {
  const cfg = await getTierConfig(env);
  const need = couponRequiredIndex(cfg, code);
  if (need < 0) return { ok: true };
  if (!memberId) return { ok: false, error: "此優惠碼為會員等級專屬，請先登入會員" };
  const r = resolveTier(cfg, await memberPaidTotal(env, memberId));
  if (r.index >= need) return { ok: true };
  return { ok: false, error: `此優惠碼為「${cfg.tiers[need].name}」以上會員專屬，累積儲值達 $${cfg.tiers[need].threshold.toLocaleString("en-US")} 即可使用` };
}

function couponDesc(c) {
  const parts = [];
  if (c.discount_type === "fixed") parts.push(`折抵 $${Math.round(c.discount_amount || 0)}`);
  else {
    parts.push(`折抵 ${c.discount_percent || 0}%`);
    if (c.max_discount_amount != null) parts.push(`最高 $${Math.round(c.max_discount_amount)}`);
  }
  if (c.min_order_amount) parts.push(`滿 $${Math.round(c.min_order_amount)} 可用`);
  if (c.expires_at) parts.push(`${String(c.expires_at).slice(0, 10)} 前有效`);
  return parts.join("，");
}

const couponUsable = (c) =>
  !!c.is_active &&
  !(c.expires_at && new Date() > new Date(c.expires_at + "Z")) &&
  !(c.usage_limit != null && c.used_count >= c.usage_limit);

// 會員頁顯示用：目前等級、升級進度、可享優惠、全部等級一覽
export async function memberTierInfo(env, memberId) {
  const cfg = await getTierConfig(env);
  if (!cfg.enabled || !cfg.tiers.length) return { enabled: false };
  const total = await memberPaidTotal(env, memberId);
  const r = resolveTier(cfg, total);

  // 抓出所有專屬優惠碼的內容（只有「已達到」的等級才會把碼顯示給會員）
  const codes = cfg.tiers.flatMap((t) => t.coupon_codes);
  const info = {};
  for (const code of codes) {
    const row = await env.DB.prepare("SELECT * FROM coupons WHERE UPPER(code)=?").bind(code).first();
    if (row) info[code] = row;
  }
  const mine = [];
  for (let i = 0; i <= r.index; i++) {
    for (const code of cfg.tiers[i].coupon_codes) {
      const c = info[code];
      if (c && couponUsable(c)) mine.push({ code, desc: couponDesc(c), tier: cfg.tiers[i].name });
    }
  }
  const tiers = [{ name: cfg.base_name, threshold: 0, rate_percent: 100, has_coupon: false, reached: true, current: r.index === -1 }];
  cfg.tiers.forEach((t, i) => {
    tiers.push({
      name: t.name,
      threshold: t.threshold,
      rate_percent: t.rate_percent,
      has_coupon: t.coupon_codes.some((c) => info[c] && couponUsable(info[c])),
      reached: i <= r.index,
      current: i === r.index,
    });
  });
  return {
    enabled: true,
    total,
    current: { name: r.name, index: r.index, rate_percent: r.ratePercent },
    next: r.next ? { name: r.next.name, threshold: r.next.threshold, remaining: r.remaining, rate_percent: r.next.rate_percent } : null,
    progress: r.progress,
    coupons: mine,
    tiers,
  };
}

// 後台：各等級目前有多少會員（沒有任何已付款訂單的會員算基本等級）
export async function tierDistribution(env, cfg) {
  const totalMembers = await env.DB.prepare("SELECT COUNT(*) AS c FROM members").first();
  const { results } = await env.DB.prepare(
    "SELECT member_id, SUM(amount) AS t FROM orders WHERE status='paid' AND member_id IS NOT NULL GROUP BY member_id"
  ).all();
  const counts = new Array(cfg.tiers.length + 1).fill(0); // [0] = 基本等級
  let withPaid = 0;
  for (const row of results) {
    withPaid++;
    counts[resolveTier(cfg, row.t).index + 1]++;
  }
  counts[0] += Math.max(0, (totalMembers ? totalMembers.c : 0) - withPaid);
  return [{ name: cfg.base_name, count: counts[0] }].concat(cfg.tiers.map((t, i) => ({ name: t.name, count: counts[i + 1] })));
}
