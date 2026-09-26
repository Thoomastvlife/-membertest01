// === 抖幣匯率規則 ===
// 由大到小排列，符合第一個 min 就套用該 rate
// 你可以隨時修改這裡的數字，重新部署即生效
// 注意：管理員若在後台有設定過費率，會以資料庫的為主

export const DEFAULT_RATE_RULES = [
  { min: 20000, rate: 2.700 },
  { min: 10000, rate: 2.700 },
  { min: 9000,  rate: 2.700 },
  { min: 8000,  rate: 2.700 },
  { min: 7000,  rate: 2.700 },
  { min: 6000,  rate: 2.700 },
  { min: 5000,  rate: 2.700 },
  { min: 4500,  rate: 2.700 },
  { min: 4000,  rate: 2.700 },
  { min: 3000,  rate: 2.700 },
  { min: 2250,  rate: 2.700 },
  { min: 2000,  rate: 2.700 },
  { min: 1500,  rate: 2.700 },
  { min: 1000,  rate: 2.700 },
  { min: 500,   rate: 2.600 },
  { min: 150,   rate: 2.500 }
];

// 取得目前費率（優先讀資料庫，沒有則用預設）
export async function getRateRules(env) {
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key='rate_rules'").first();
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // 資料表不存在或讀取失敗 → 用預設
  }
  return DEFAULT_RATE_RULES;
}

// 儲存費率到資料庫
export async function saveRateRules(env, rules) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('rate_rules', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(JSON.stringify(rules)).run();
}

// 依金額取得對應匯率
export function getRate(rules, amount) {
  for (const rule of rules) {
    if (amount >= rule.min) return rule.rate;
  }
  return null;
}

// 計算抖幣
export function calcCoins(rules, amount) {
  if (isNaN(amount) || amount < 150 || amount > 50000) return null;
  const rate = getRate(rules, amount);
  if (!rate) return null;
  return { amount, rate, coins: (amount * rate).toFixed(2) };
}
