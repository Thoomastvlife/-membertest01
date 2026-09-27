// === 抖幣匯率規則 ===
// 由大到小排列，符合第一個 min 就套用該 rate
// 你可以隨時修改這裡的數字，重新部署即生效
// 注意：管理員若在後台有設定過費率，會以資料庫的為主
//
// 費率分兩組，各自獨立設定：
//   tiktok → 只給 TikTok 使用
//   other  → 快手 / 小紅書 / 陸抖 共用同一組費率

export const DEFAULT_RATE_RULES = [
  { min: 0, rate: 2.500 }
];

export const RATE_GROUPS = ["tiktok", "other"];
export const RATE_GROUP_LABEL = { tiktok: "TikTok", other: "快手 / 小紅書 / 陸抖" };

const SETTINGS_KEY_BY_GROUP = { tiktok: "rate_rules", other: "rate_rules_other" };

// 依平台代碼取得對應的費率群組 key（tiktok 自己一組，其餘平台共用 other 這組）
export function getRateGroupForPlatform(platform) {
  return platform === "tiktok" ? "tiktok" : "other";
}

// 取得目前費率（優先讀資料庫，沒有則用預設）
export async function getRateRules(env, group = "tiktok") {
  const key = SETTINGS_KEY_BY_GROUP[group] || SETTINGS_KEY_BY_GROUP.tiktok;
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first();
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // 資料表不存在或讀取失敗 → 用預設
  }
  return DEFAULT_RATE_RULES;
}

// 一次取得兩組費率，給前台（查價／自助下單）使用
export async function getAllRateRules(env) {
  const [tiktok, other] = await Promise.all([
    getRateRules(env, "tiktok"),
    getRateRules(env, "other"),
  ]);
  return { tiktok, other };
}

// 儲存費率到資料庫
export async function saveRateRules(env, rules, group = "tiktok") {
  const key = SETTINGS_KEY_BY_GROUP[group] || SETTINGS_KEY_BY_GROUP.tiktok;
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(key, JSON.stringify(rules)).run();
}

// 依金額取得對應匯率
export function getRate(rules, amount) {
  for (const rule of rules) {
    if (amount >= rule.min) return rule.rate;
  }
  return null;
}

// 最低購買金額（查價／自助下單共用，前後端都要保持一致）
export const MIN_QUOTE_AMOUNT = 200;

// 計算抖幣
export function calcCoins(rules, amount) {
  if (isNaN(amount) || amount < MIN_QUOTE_AMOUNT || amount > 50000) return null;
  const rate = getRate(rules, amount);
  if (!rate) return null;
  return { amount, rate, coins: (amount * rate).toFixed(2) };
}
