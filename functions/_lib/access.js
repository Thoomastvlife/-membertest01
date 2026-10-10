// 後台員工權限
// - 角色：owner（管理員，可以做所有事，包含新增員工與設定權限）／staff（員工，只能用被勾選的功能）
// - 員工帳號的權限存在 admins.permissions（JSON 陣列）；NULL 代表「還沒設定過」，維持升級前的行為（全部功能，但不含員工帳號管理）
// - 所有檢查都在伺服器端做（後台 API 入口統一擋），前端隱藏分頁只是方便使用

// 可以勾選的權限。requires = 必須同時有另一項（例如要能刪除訂單，先要能使用訂單功能）
export const PERMISSIONS = [
  { key: "dashboard", label: "首頁", desc: "查看營收與待辦總覽" },
  { key: "orders", label: "結帳櫃檯／訂單列表", desc: "建立訂單、查看與處理訂單（標記付款、更正、結案、上傳條碼）" },
  { key: "orders_delete", label: "永久刪除訂單", desc: "危險操作，刪除後無法復原", requires: "orders" },
  { key: "members", label: "會員管理", desc: "新增、編輯會員，重設會員密碼" },
  { key: "members_delete", label: "刪除會員", desc: "危險操作，刪除後無法復原", requires: "members" },
  { key: "stats", label: "儲值統計／資料匯出", desc: "查看每月儲值統計、下載匯出檔" },
  { key: "settings", label: "付款設定／系統公告", desc: "付款方式、儲值平台、銀行資料、公告" },
  { key: "rates", label: "費率設定", desc: "修改各平台的費率" },
  { key: "coupons", label: "優惠碼", desc: "新增、修改、刪除優惠碼" },
  { key: "points", label: "點數系統", desc: "點數設定、調整會員點數、點數商城與兌換單" },
  { key: "live", label: "直播下單", desc: "直播場次、留言解析、建立訂單、自動抓取金鑰" },
  { key: "logs", label: "操作紀錄", desc: "查看所有帳號的後台操作紀錄" },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
// 新增員工時預設勾選的項目
export const DEFAULT_STAFF_PERMISSIONS = ["dashboard", "orders"];

// 把前端送來的權限清單整理乾淨：去掉不認識的、重複的，沒有前提的相依權限也一併拿掉
export function normalizePermissions(list) {
  const set = new Set((Array.isArray(list) ? list : []).filter((k) => PERMISSION_KEYS.includes(k)));
  for (const p of PERMISSIONS) {
    if (p.requires && set.has(p.key) && !set.has(p.requires)) set.delete(p.key);
  }
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

// 這個後台 API 需要什麼權限。回傳：
//   null               → 任何登入的後台帳號都可以
//   "OWNER"            → 只有管理員
//   "<key>"            → 需要這項權限
//   { any: [...] }     → 符合其中一項即可（"OWNER" 也可以放在裡面）
export function requiredAdminPermission(path, method) {
  const seg = String(path).split("/")[3] || "";
  const m = String(method || "GET").toUpperCase();
  const read = m === "GET";
  switch (seg) {
    case "me":
    case "push":
      return null;
    case "staff":
      return read ? { any: ["OWNER", "logs"] } : "OWNER"; // 操作紀錄的帳號篩選要讀帳號名稱
    case "dashboard":
      return "dashboard";
    case "logs":
      return "logs";
    case "orders":
      return m === "DELETE" ? "orders_delete" : "orders";
    case "members":
      if (m === "DELETE") return "members_delete";
      return read ? { any: ["members", "orders", "live", "points"] } : "members"; // 結帳櫃檯、直播、點數都要挑會員
    case "stats":
    case "export":
      return "stats";
    case "settings":
    case "announcement":
    case "payment-methods":
      return "settings";
    case "platforms":
      return read ? { any: ["settings", "rates", "orders"] } : "settings";
    case "rates":
      return "rates";
    case "coupons":
      return "coupons";
    case "points":
      return "points";
    case "live":
      return "live";
    default:
      return "OWNER"; // 沒有列在上面的後台路徑，員工一律不能用（預設拒絕）
  }
}

function parsePermissions(raw) {
  if (raw == null || raw === "") return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? normalizePermissions(arr) : [];
  } catch {
    return []; // 資料壞掉時寧可全部不給
  }
}

// 讀出目前登入帳號的角色與權限。回傳 null 代表這個帳號已經不存在（被刪除），要請他重新登入。
export async function getAdminAccess(env, session) {
  let row;
  try {
    row = await env.DB.prepare("SELECT id, username, role, permissions FROM admins WHERE id=?").bind(session.adminId).first();
  } catch (e) {
    if (/no such column/i.test(String(e && e.message))) {
      // 資料庫還沒執行 migrate_v22.sql：維持舊行為（所有帳號都是管理員），不要讓整個後台壞掉
      return { id: session.adminId, username: session.username, owner: true, legacy: true, configured: true, perms: new Set(PERMISSION_KEYS) };
    }
    throw e;
  }
  if (!row) return null;
  const owner = row.role === "owner";
  const parsed = owner ? null : parsePermissions(row.permissions);
  const configured = owner || parsed !== null;
  const perms = new Set(owner || parsed === null ? PERMISSION_KEYS : parsed);
  return { id: row.id, username: row.username, owner, legacy: false, configured, perms };
}

export function canAccess(access, need) {
  if (need == null) return true;
  if (access.owner) return true;
  if (need === "OWNER") return false;
  if (typeof need === "string") return access.perms.has(need);
  if (need && Array.isArray(need.any)) return need.any.some((k) => k !== "OWNER" && access.perms.has(k));
  return false;
}

export function accessSummary(access) {
  return {
    is_owner: access.owner,
    configured: access.configured,
    permissions: PERMISSION_KEYS.filter((k) => access.perms.has(k)),
    catalog: PERMISSIONS,
  };
}
