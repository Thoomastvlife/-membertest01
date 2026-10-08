// === 儲值平台 / 付款方式 後台設定 ===
// 兩份設定都存在 settings 表（JSON），不需要資料庫升級。
//   platforms_config        → 儲值平台清單（內建 4 個 + 後台自訂）
//   payment_methods_config  → 各付款方式是否「開放顧客自行選擇」
// 原則：關閉＝顧客看不到、也不能選；後台建單／更正訂單仍然可以指定。

const PLATFORMS_KEY = "platforms_config";
const METHODS_KEY = "payment_methods_config";

export const RATE_GROUP_CHOICES = ["tiktok", "other", "own", "none"]; // own = 這個平台自己一組費率；none = 不計算預估幣數

// 內建平台：不能刪除（舊訂單、直播下單都依賴它們），但可以改名、關閉、調整順序
export const DEFAULT_PLATFORMS = [
  { key: "tiktok", name: "TikTok", enabled: true, require_password: true, rate_group: "tiktok", builtin: true },
  { key: "kuaishou", name: "快手", enabled: true, require_password: false, rate_group: "other", builtin: true },
  { key: "xiaohongshu", name: "小紅書", enabled: true, require_password: false, rate_group: "other", builtin: true },
  { key: "douyin", name: "陸抖", enabled: true, require_password: false, rate_group: "other", builtin: true },
];

export const PAYMENT_METHOD_KEYS = ["transfer", "store_barcode", "taiwan_pay"];
export const PAYMENT_METHOD_LABEL = { transfer: "轉帳", store_barcode: "超商條碼", taiwan_pay: "TWQR" };

const KEY_RE = /^[a-z0-9_]{1,24}$/;

function cleanName(v, fallback) {
  const s = String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, 20);
  return s || fallback;
}

// 把資料庫裡存的 JSON 整理成標準清單：內建平台一定存在，順序依存檔順序，壞資料直接丟掉
export function normalizePlatforms(raw) {
  const out = [];
  const seen = new Set();
  const arr = Array.isArray(raw) ? raw : [];
  for (const r of arr) {
    if (!r || typeof r !== "object") continue;
    const key = String(r.key || "");
    if (!KEY_RE.test(key) || seen.has(key)) continue;
    const def = DEFAULT_PLATFORMS.find((d) => d.key === key);
    seen.add(key);
    out.push({
      key,
      name: cleanName(r.name, def ? def.name : key),
      enabled: r.enabled !== false,
      require_password: !!r.require_password,
      rate_group: RATE_GROUP_CHOICES.includes(r.rate_group) ? r.rate_group : "other",
      builtin: !!def,
    });
  }
  // 內建平台若不在清單裡（例如舊資料、或第一次使用）就補回去
  for (const d of DEFAULT_PLATFORMS) {
    if (!seen.has(d.key)) out.push({ ...d });
  }
  // 內建平台的「是否內建」「TikTok 專用費率」不允許被改壞
  return out;
}

export async function getPlatforms(db) {
  try {
    const row = await db.prepare("SELECT value FROM settings WHERE key=?").bind(PLATFORMS_KEY).first();
    if (row && row.value) return normalizePlatforms(JSON.parse(row.value));
  } catch (e) {
    // 讀不到就用預設
  }
  return normalizePlatforms(null);
}

export async function savePlatforms(db, list) {
  const clean = normalizePlatforms(list);
  await db
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(PLATFORMS_KEY, JSON.stringify(clean))
    .run();
  return clean;
}

export function generatePlatformKey(existing) {
  for (let i = 0; i < 20; i++) {
    const k = "p" + Math.random().toString(36).slice(2, 8);
    if (KEY_RE.test(k) && !existing.some((p) => p.key === k)) return k;
  }
  return "p" + Date.now().toString(36);
}

export function platformLabelMap(list) {
  const m = {};
  for (const p of list) m[p.key] = p.name;
  return m;
}

export function findPlatform(list, key) {
  return list.find((p) => p.key === key) || null;
}

// 平台實際使用的費率組 id：'tiktok' | 'other' | 'plat_<key>'（獨立費率）| 'none'（不計算預估幣數）
export function effectiveRateGroup(p) {
  return p.rate_group === "own" ? "plat_" + p.key : p.rate_group;
}

export function rateGroupOf(list, key) {
  const p = findPlatform(list, key);
  return p ? effectiveRateGroup(p) : "other";
}

// ---- 付款方式：是否開放顧客自行選擇 ----
export function normalizeMethodsConfig(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const k of PAYMENT_METHOD_KEYS) out[k] = o[k] !== false; // 預設全部開放
  return out;
}

export async function getMethodsConfig(db) {
  try {
    const row = await db.prepare("SELECT value FROM settings WHERE key=?").bind(METHODS_KEY).first();
    if (row && row.value) return normalizeMethodsConfig(JSON.parse(row.value));
  } catch (e) {
    // 讀不到就全部開放
  }
  return normalizeMethodsConfig(null);
}

export async function saveMethodsConfig(db, body) {
  const clean = normalizeMethodsConfig(body);
  await db
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(METHODS_KEY, JSON.stringify(clean))
    .run();
  return clean;
}

export function enabledMethodList(cfg) {
  return PAYMENT_METHOD_KEYS.filter((k) => cfg[k]);
}

// 放進 <script> 的 JSON：把 < 跳脫掉，避免名稱裡出現 </script> 破壞頁面
export function jsonForScript(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
