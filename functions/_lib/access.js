// 後台員工權限
// - 角色：owner（管理員，可以做所有事，包含新增員工與設定權限）／staff（員工，只能用被勾選的功能）
// - 員工帳號的權限存在 admins.permissions（JSON 陣列）；NULL 代表「還沒設定過」，維持升級前的行為（全部功能，但不含員工帳號管理）
// - 所有檢查都在伺服器端做（後台 API 入口統一擋），前端隱藏分頁只是方便使用

// 可以勾選的權限。requires = 必須同時有另一項（例如要能刪除訂單，先要能使用訂單功能）
export const PERMISSIONS = [
  { key: "dashboard", label: "首頁", desc: "查看營收與待辦總覽" },
  { key: "checkout", label: "結帳櫃檯", desc: "建立訂單（含品項明細、優惠碼試算）並產生付款連結；不能查看或修改已建立的訂單" },
  { key: "order_list", label: "訂單列表", desc: "查看與搜尋訂單、處理訂單（標記付款、更正、結案、上傳條碼、品項與交貨、寄明細）" },
  { key: "orders_delete", label: "永久刪除訂單", desc: "危險操作，刪除後無法復原", requires: "order_list" },
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
export const DEFAULT_STAFF_PERMISSIONS = ["dashboard", "checkout", "order_list"];

// 舊版的「orders」（結帳櫃檯／訂單列表合在一起）已經拆成「checkout」和「order_list」。
// 資料庫裡還存著舊的 "orders" 的員工帳號，視為「兩個都有」，行為跟拆分之前完全一樣，不需要另外升級資料庫；
// 之後在後台重新儲存該員工的權限，就會改存成新的兩個項目。
const LEGACY_ORDERS_KEY = "orders";

// 把前端送來的權限清單整理乾淨：去掉不認識的、重複的，沒有前提的相依權限也一併拿掉
export function normalizePermissions(list) {
  const arr = Array.isArray(list) ? list : [];
  const expanded = arr.includes(LEGACY_ORDERS_KEY) ? [...arr, "checkout", "order_list"] : arr;
  const set = new Set(expanded.filter((k) => PERMISSION_KEYS.includes(k)));
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
      if (m === "DELETE") return "orders_delete";
      // 只有「建立訂單」（POST /api/admin/orders）屬於結帳櫃檯；其餘查詢與處理（含 /orders/:id/...）都屬於訂單列表
      if (m === "POST" && String(path).replace(/\/+$/, "") === "/api/admin/orders") return "checkout";
      return "order_list";
    case "order-items": // 訂單的品項（修改、刪除、標記交貨）屬於訂單列表
      return "order_list";
    case "members":
      if (m === "DELETE") return "members_delete";
      return read ? { any: ["members", "checkout", "order_list", "live", "points"] } : "members"; // 結帳櫃檯、直播、點數都要挑會員
    case "stats":
    case "export":
      return "stats";
    case "settings":
    case "announcement":
    case "payment-methods":
      return "settings";
    case "platforms":
      return read ? { any: ["settings", "rates", "checkout", "order_list"] } : "settings";
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

export function parsePermissions(raw) {
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
