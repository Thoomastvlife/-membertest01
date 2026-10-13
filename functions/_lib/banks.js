// 轉帳銀行帳戶（可多家）。放在 settings 表的 bank_accounts（JSON 陣列）。
// 沒有這個設定時，自動沿用舊的 bank_name / bank_account_number / bank_account_holder 三個欄位（視為一家銀行）。
// 儲存時會把「第一家開放中的銀行」同步回舊的三個欄位，所以舊程式讀到的仍是正確資料。

export const BANKS_KEY = "bank_accounts";
export const MAX_BANKS = 10;
const LEGACY_KEYS = ["bank_name", "bank_account_number", "bank_account_holder"];
const LEGACY_DEFAULTS = {
  bank_name: "請於後台設定填入銀行名稱",
  bank_account_number: "請於後台設定填入帳號",
  bank_account_holder: "請於後台設定填入戶名",
};

function newId() {
  const a = new Uint8Array(4);
  crypto.getRandomValues(a);
  return "b" + Array.from(a, (x) => x.toString(16).padStart(2, "0")).join("");
}

const cut = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

export function cleanBanks(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    let id = cut(r.id, 20).replace(/[^A-Za-z0-9_-]/g, "");
    if (!id || seen.has(id)) id = newId();
    seen.add(id);
    out.push({
      id,
      bank_name: cut(r.bank_name, 40),
      account_number: cut(r.account_number, 40),
      account_holder: cut(r.account_holder, 40),
      enabled: r.enabled !== false && r.enabled !== 0,
    });
    if (out.length >= MAX_BANKS) break;
  }
  return out;
}

export async function getBankAccounts(db) {
  const keys = [BANKS_KEY, ...LEGACY_KEYS];
  const { results } = await db
    .prepare(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => "?").join(",")})`)
    .bind(...keys)
    .all();
  const m = {};
  for (const r of results || []) m[r.key] = r.value;
  if (m[BANKS_KEY] != null) {
    try {
      return cleanBanks(JSON.parse(m[BANKS_KEY]));
    } catch (e) {
      /* 壞掉就退回舊欄位 */
    }
  }
  if (m.bank_name || m.bank_account_number || m.bank_account_holder) {
    return [
      {
        id: "legacy",
        bank_name: m.bank_name || "",
        account_number: m.bank_account_number || "",
        account_holder: m.bank_account_holder || "",
        enabled: true,
      },
    ];
  }
  return [];
}

export async function saveBankAccounts(db, rawList) {
  const list = cleanBanks(rawList);
  for (const b of list) {
    if (!b.bank_name || !b.account_number) {
      throw new Error("每一家銀行都要填「銀行名稱」和「帳號」（戶名建議也填）");
    }
  }
  const up = "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value";
  await db.prepare(up).bind(BANKS_KEY, JSON.stringify(list)).run();
  // 同步舊欄位：第一家開放中的銀行；沒有就第一家；完全沒有就放回預設提示文字
  const first = list.find((b) => b.enabled) || list[0];
  const legacy = first
    ? { bank_name: first.bank_name, bank_account_number: first.account_number, bank_account_holder: first.account_holder }
    : LEGACY_DEFAULTS;
  for (const k of LEGACY_KEYS) await db.prepare(up).bind(k, legacy[k] || "").run();
  return list;
}

export function bankToOrderFields(b) {
  return b
    ? { bank_name: b.bank_name || null, bank_account_number: b.account_number || null, bank_account_holder: b.account_holder || null }
    : { bank_name: null, bank_account_number: null, bank_account_holder: null };
}

// 決定這筆「轉帳」訂單要用哪一家銀行。
//   customer = true：客人自己選，只能選開放中的；超過一家開放時一定要帶 bank_id。
//   customer = false：後台建單／更正，可以指定任何一家；沒指定就用第一家開放中的（沒有就第一家）。
// 回傳 { fields } 或 { error }。沒有設定任何銀行時回 { fields: null }，由呼叫端沿用舊欄位。
export function chooseBank(list, bankId, customer) {
  if (!list.length) return { fields: null };
  const enabled = list.filter((b) => b.enabled);
  if (bankId) {
    const b = (customer ? enabled : list).find((x) => x.id === String(bankId));
    if (!b) return { error: "選擇的銀行不存在或目前未開放" };
    return { fields: bankToOrderFields(b) };
  }
  if (customer) {
    if (!enabled.length) return { error: "目前沒有開放的轉帳帳戶，請選擇其他付款方式，或聯繫客服" };
    if (enabled.length > 1) return { error: "請先選擇要轉入的銀行" };
    return { fields: bankToOrderFields(enabled[0]) };
  }
  return { fields: bankToOrderFields(enabled[0] || list[0]) };
}
