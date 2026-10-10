// ===== 後台訂單搜尋 =====
// GET /api/admin/orders?q=關鍵字&date_from=&date_to=&date_field=created|paid&member_id=&status=&payment_method=&platform=&completed=&amount_min=&amount_max=
// - q：任何內容。用空白隔開多個關鍵字，每個關鍵字都要符合（AND）；單一關鍵字只要「任一欄位」符合即可（OR）。
//   比對欄位：訂單編號、會員姓名／帳號／電話／信箱／TikTok 帳號、儲值平台（代碼或名稱）、平台帳號、
//   金額、優惠碼、後台備註、轉帳末碼、付款方式、超商、訂單狀態、結案。
//   刻意不比對：平台密碼、證明截圖、條碼圖片。
// - 日期一律以「台灣時間」計算（資料庫存的是 UTC，所以先 +8 小時再取日期）。
import { parseOrderNo } from "./helpers.js";

export const ORDER_SEARCH_LIMIT = 300;
const MAX_TERMS = 8;

const PAY_SYN = {
  transfer: ["轉帳", "匯款", "transfer"],
  store_barcode: ["超商", "條碼", "store_barcode"],
  taiwan_pay: ["twqr", "台灣pay", "taiwan_pay", "taiwanpay"],
};
const STORE_SYN = {
  seven: ["7-11", "711", "7eleven", "seven", "統一"],
  family: ["全家", "family", "familymart"],
  hilife: ["萊爾富", "hilife"],
};
const STATUS_SYN = {
  pending_method: ["待選付款方式", "待選", "pending_method"],
  awaiting_payment: ["等待客人付款", "等待付款", "待付款", "awaiting_payment"],
  awaiting_barcode: ["待上傳條碼", "待上傳", "awaiting_barcode"],
  ready_to_pay: ["已可付款", "可付款", "ready_to_pay"],
  paid: ["已付款", "已完成付款", "paid"],
  expired: ["已過期", "過期", "expired"],
  cancelled: ["已取消", "取消", "cancelled"],
};
const COMPLETED_WORDS = ["結案", "已結案", "訂單完成"];
const NOT_COMPLETED_WORDS = ["未結案"];

const STATUS_KEYS = Object.keys(STATUS_SYN);
const PAY_KEYS = Object.keys(PAY_SYN);
const KEY_RE = /^[a-z0-9_]{1,24}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HAS_CJK = /[\u4e00-\u9fff]/;

// 用來比對關鍵字的文字欄位（皆為 LIKE 部分比對）
const LIKE_COLUMNS = [
  "o.member_name_snapshot", "m.name", "m.account", "m.phone", "m.email", "m.tiktok_id",
  "o.platform", "o.platform_account", "o.coupon_code", "o.admin_note", "o.proof_last_digits",
  "o.notify_email_addr", "o.token", "o.payment_method", "o.store_brand", "o.status",
];

const FILTER_PARAMS = ["q", "date_from", "date_to", "member_id", "status", "payment_method", "platform", "completed", "amount_min", "amount_max"];

export function hasOrderSearchParams(sp) {
  return FILTER_PARAMS.some((k) => String(sp.get(k) || "").trim() !== "");
}

function escLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => "\\" + c);
}

function synMatch(map, term) {
  if (term.length < 2) return [];
  const out = [];
  for (const [key, words] of Object.entries(map)) {
    if (words.some((w) => w.toLowerCase() === term || w.toLowerCase().includes(term))) out.push(key);
  }
  return out;
}

// 組出查詢 SQL。回傳 { sql, binds }；所有使用者輸入都走綁定參數（?N），不會拼進 SQL。
export function buildOrderSearch(sp, platforms) {
  const binds = [];
  const bind = (v) => {
    binds.push(v);
    return "?" + binds.length;
  };
  const where = [];
  const list = Array.isArray(platforms) ? platforms : [];

  // ---- 篩選條件（精確）----
  const memberId = String(sp.get("member_id") || "").trim();
  if (memberId === "guest") where.push("o.member_id IS NULL");
  else if (/^\d+$/.test(memberId)) where.push("o.member_id = " + bind(parseInt(memberId, 10)));

  const status = String(sp.get("status") || "").trim();
  if (STATUS_KEYS.includes(status)) where.push("o.status = " + bind(status));

  const pm = String(sp.get("payment_method") || "").trim();
  if (pm === "none") where.push("o.payment_method IS NULL");
  else if (PAY_KEYS.includes(pm)) where.push("o.payment_method = " + bind(pm));

  const pf = String(sp.get("platform") || "").trim();
  if (pf === "none") where.push("o.platform IS NULL");
  else if (KEY_RE.test(pf)) where.push("o.platform = " + bind(pf));

  const completed = String(sp.get("completed") || "").trim();
  if (completed === "yes") where.push("o.is_completed = 1");
  else if (completed === "no") where.push("o.is_completed = 0");

  const dateCol = String(sp.get("date_field") || "") === "paid" ? "o.paid_at" : "o.created_at";
  const from = String(sp.get("date_from") || "").trim();
  const to = String(sp.get("date_to") || "").trim();
  if (DATE_RE.test(from)) where.push("date(" + dateCol + ", '+8 hours') >= " + bind(from));
  if (DATE_RE.test(to)) where.push("date(" + dateCol + ", '+8 hours') <= " + bind(to));

  const amin = Number(String(sp.get("amount_min") || "").trim());
  const amax = Number(String(sp.get("amount_max") || "").trim());
  if (String(sp.get("amount_min") || "").trim() !== "" && Number.isFinite(amin)) where.push("o.amount >= " + bind(amin));
  if (String(sp.get("amount_max") || "").trim() !== "" && Number.isFinite(amax)) where.push("o.amount <= " + bind(amax));

  // ---- 關鍵字（每個關鍵字都要符合；單一關鍵字任一欄位符合即可）----
  const terms = String(sp.get("q") || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TERMS);
  for (const raw of terms) {
    const term = raw.toLowerCase();
    const ors = [];
    const like = bind("%" + escLike(raw) + "%");
    for (const col of LIKE_COLUMNS) ors.push(col + " LIKE " + like + " ESCAPE '\\'");

    // 金額（可帶 $ 或「元」）
    const num = raw.replace(/^\$/, "").replace(/元$/, "");
    if (/^\d+(\.\d+)?$/.test(num)) ors.push("o.amount = " + bind(Number(num)));

    // 訂單編號：只有「TW 開頭」或「21 開頭的完整編號」才當訂單編號，避免 500 這種數字被當成第 500 號訂單
    if (/^tw\d+$/i.test(raw) || /^21\d{4,}$/.test(raw)) {
      const id = parseOrderNo(raw);
      if (id) ors.push("o.id = " + bind(id));
    }

    // 中文名稱 / 同義詞 → 對應的代碼
    const payKeys = synMatch(PAY_SYN, term);
    if (payKeys.length) ors.push("o.payment_method IN (" + payKeys.map((k) => "'" + k + "'").join(",") + ")");
    const storeKeys = synMatch(STORE_SYN, term);
    if (storeKeys.length) ors.push("o.store_brand IN (" + storeKeys.map((k) => "'" + k + "'").join(",") + ")");
    const stKeys = synMatch(STATUS_SYN, term);
    if (stKeys.length) ors.push("o.status IN (" + stKeys.map((k) => "'" + k + "'").join(",") + ")");
    if (COMPLETED_WORDS.includes(raw)) ors.push("o.is_completed = 1");
    if (NOT_COMPLETED_WORDS.includes(raw)) ors.push("o.is_completed = 0");

    // 平台名稱（含後台新增的平台）：名稱含關鍵字就算符合
    if (term.length >= 2 || HAS_CJK.test(term)) {
      const pKeys = list
        .filter((p) => p && KEY_RE.test(String(p.key || "")) && String(p.name || "").toLowerCase().includes(term))
        .map((p) => "'" + p.key + "'");
      if (pKeys.length) ors.push("o.platform IN (" + pKeys.join(",") + ")");
    }

    where.push("(" + ors.join(" OR ") + ")");
  }

  const sql =
    "SELECT o.* FROM orders o LEFT JOIN members m ON m.id = o.member_id" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY o.created_at DESC, o.id DESC LIMIT " + ORDER_SEARCH_LIMIT;
  return { sql, binds };
}
