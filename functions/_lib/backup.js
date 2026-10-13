// ===== 資料備份 / 還原（只有管理員可用）=====
// 做法：瀏覽器分批向伺服器要資料（每批幾百筆）→ 在瀏覽器組成備份檔下載；還原則是瀏覽器讀檔 → 分批送回伺服器寫入。
// 好處：單一請求都很小，不會碰到 Cloudflare 的執行時間／記憶體上限；備份檔的加密也在瀏覽器完成，密碼不會送到伺服器。
//
// 安全：
//  - 資料表與欄位名稱一律先跟「資料庫實際有的」比對才會用在 SQL 裡（SQL 不接受以參數代入名稱），其餘值全部走綁定參數。
//  - 後台帳號（admins）絕不清空：還原只做「同編號覆寫」，且一定不動到目前登入的這個帳號，避免把自己鎖在門外。
//  - 操作紀錄（admin_logs）絕不清空、絕不覆寫：只補回缺少的，確保稽核軌跡不會因為還原而消失。
//  - 這幾張暫時性資料表不備份：email_codes（驗證碼）、email_send_log（寄信節流）、push_subscriptions（裝置推播訂閱）。
import { jsonRes as json, logAdminAction } from "./helpers.js";

export const BACKUP_FORMAT = "member-checkout-backup";
const EXCLUDED_TABLES = new Set(["email_codes", "email_send_log", "push_subscriptions"]);
const NEVER_CLEAR = new Set(["admins", "admin_logs"]);
const NAME_RE = /^[A-Za-z0-9_]+$/;
const IMAGE_COL_RE = /image|photo|blob/i;
const ROWS_DEFAULT = 300;
const ROWS_MAX = 1000;
const ROWS_WITH_IMAGES = 10;
const RESTORE_MAX_ROWS = 500;
const RESTORE_MAX_BYTES = 8 * 1024 * 1024;
const MAX_COLUMNS = 90; // D1 每個陳述式最多 100 個綁定參數

// 實際存在、而且允許備份的資料表（動態讀取，之後新增資料表也不會漏）
async function listTables(env) {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name NOT LIKE 'd1\\_%' ESCAPE '\\' ORDER BY name"
  ).all();
  return results.map((r) => r.name).filter((n) => NAME_RE.test(n) && !EXCLUDED_TABLES.has(n));
}

async function tableColumns(env, table) {
  const { results } = await env.DB.prepare("SELECT name, type FROM pragma_table_info(?)").bind(table).all();
  return results.map((r) => ({ name: r.name, type: r.type || "" })).filter((c) => NAME_RE.test(c.name));
}

async function tableParents(env, table) {
  const { results } = await env.DB.prepare('SELECT DISTINCT "table" AS parent FROM pragma_foreign_key_list(?)').bind(table).all();
  return results.map((r) => r.parent).filter((p) => p !== table);
}

const q = (name) => '"' + name + '"'; // 名稱已通過白名單驗證，這裡只負責加上引號

// 依外鍵關係排序：被參照的資料表（父）排前面，還原時先寫入父表，清除時則反過來
function sortParentsFirst(names, parentsOf) {
  const left = new Set(names);
  const out = [];
  let guard = names.length + 2;
  while (left.size && guard-- > 0) {
    for (const n of [...left]) {
      if ((parentsOf[n] || []).every((p) => !left.has(p))) {
        out.push(n);
        left.delete(n);
      }
    }
  }
  return out.concat([...left]); // 理論上不會有循環；萬一有，照原順序接在後面
}

// 只查「單一張」資料表的資訊（讀一批、寫一批資料時用，不用每次都掃過整個資料庫的結構）。不在允許清單內就回傳 null。
async function loadOne(env, table) {
  if (!NAME_RE.test(String(table)) || !(await listTables(env)).includes(table)) return null;
  const cols = await tableColumns(env, table);
  return { name: table, columns: cols.map((c) => c.name), image_columns: cols.filter((c) => IMAGE_COL_RE.test(c.name) || /blob/i.test(c.type)).map((c) => c.name) };
}

async function loadMeta(env) {
  const names = await listTables(env);
  const meta = {};
  const parentsOf = {};
  for (const n of names) {
    const cols = await tableColumns(env, n);
    meta[n] = { name: n, columns: cols.map((c) => c.name), image_columns: cols.filter((c) => IMAGE_COL_RE.test(c.name) || /blob/i.test(c.type)).map((c) => c.name) };
    parentsOf[n] = (await tableParents(env, n)).filter((p) => names.includes(p));
  }
  return { names, meta, order: sortParentsFirst(names, parentsOf) };
}

export async function handleBackupTables(env) {
  const { meta, order } = await loadMeta(env);
  const tables = [];
  for (const n of order) {
    const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM " + q(n)).first();
    tables.push({ ...meta[n], count: row ? row.c : 0 });
  }
  const getSetting = async (k) => {
    const r = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(k).first().catch(() => null);
    return r ? r.value : null;
  };
  return json({
    tables,
    order,
    never_clear: [...NEVER_CLEAR],
    last_backup_at: await getSetting("last_backup_at"),
    last_backup_by: await getSetting("last_backup_by"),
  });
}

// 分批讀資料：用 rowid 當游標（每次從上一批最後一筆之後開始），不用 OFFSET，資料多也不會越讀越慢
export async function handleBackupRows(request, env) {
  const url = new URL(request.url);
  const table = url.searchParams.get("table") || "";
  const info = await loadOne(env, table);
  if (!info) return json({ error: "沒有這張資料表，或這張資料表不提供備份" }, 400);
  const withImages = url.searchParams.get("images") === "1";
  const after = Math.max(0, parseInt(url.searchParams.get("after"), 10) || 0);
  let limit = Math.min(ROWS_MAX, Math.max(1, parseInt(url.searchParams.get("limit"), 10) || ROWS_DEFAULT));
  if (withImages && info.image_columns.length) limit = Math.min(limit, ROWS_WITH_IMAGES);

  const select = info.columns
    .map((c) => (info.image_columns.includes(c) && !withImages ? "NULL AS " + q(c) : q(c)))
    .join(", ");
  const { results } = await env.DB.prepare(
    "SELECT rowid AS __rid, " + select + " FROM " + q(table) + " WHERE rowid > ? ORDER BY rowid LIMIT ?"
  )
    .bind(after, limit)
    .all();
  const rows = results.map((r) => info.columns.map((c) => (r[c] === undefined ? null : r[c])));
  const last = results.length ? results[results.length - 1].__rid : after;
  return json({ columns: info.columns, rows, last, done: results.length < limit });
}

// 還原（全部覆蓋）前，清空指定資料表（admins、admin_logs 一律不清）。先清子表再清父表。
export async function handleBackupClear(request, env, session) {
  const body = await request.json().catch(() => ({}));
  const want = Array.isArray(body.tables) ? body.tables : [];
  const { names, order } = await loadMeta(env);
  for (const n of want) {
    if (!names.includes(n)) return json({ error: "資料表不存在：" + String(n).slice(0, 40) }, 400);
    if (NEVER_CLEAR.has(n)) return json({ error: "「" + n + "」不允許清空" }, 400);
  }
  const targets = order.filter((n) => want.includes(n)).reverse(); // 子表在前
  if (targets.length) {
    await env.DB.batch([env.DB.prepare("PRAGMA defer_foreign_keys = on"), ...targets.map((n) => env.DB.prepare("DELETE FROM " + q(n)))]);
  }
  await logAdminAction(env, session, request, {
    action: "data.backup_clear",
    summary: "還原前清空資料表：" + (targets.join("、") || "（無）"),
    detail: { tables: targets },
  });
  return json({ ok: true, cleared: targets });
}

// 寫入一批資料
export async function handleBackupRestore(request, env, session) {
  const len = parseInt(request.headers.get("content-length") || "0", 10);
  if (len > RESTORE_MAX_BYTES) return json({ error: "這一批資料太大，請重新整理頁面後再試" }, 413);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "資料格式不正確" }, 400);

  const table = String(body.table || "");
  const info = await loadOne(env, table);
  if (!info) return json({ error: "資料表不存在或不提供還原：" + table.slice(0, 40) }, 400);
  const mode = body.mode === "replace" ? "replace" : "merge";
  const cols = Array.isArray(body.columns) ? body.columns : [];
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!cols.length || cols.length > MAX_COLUMNS) return json({ error: "欄位數量不正確" }, 400);
  if (rows.length > RESTORE_MAX_ROWS) return json({ error: "一次最多還原 " + RESTORE_MAX_ROWS + " 筆" }, 400);
  const allowed = info.columns;
  for (const c of cols) {
    if (typeof c !== "string" || !allowed.includes(c)) {
      return json({ error: "備份檔的欄位「" + String(c).slice(0, 40) + "」在目前的資料表（" + table + "）裡不存在，可能是來自較新的版本，請先升級資料庫" }, 400);
    }
  }
  if (new Set(cols).size !== cols.length) return json({ error: "欄位重複" }, 400);

  // 後台帳號：不動到目前登入的這個帳號（避免被備份裡舊的角色或權限覆蓋）
  const idIdx = cols.indexOf("id");
  let skippedSelf = 0;
  let useRows = rows;
  if (table === "admins" && idIdx >= 0 && session) {
    useRows = rows.filter((r) => {
      const isSelf = Array.isArray(r) && Number(r[idIdx]) === Number(session.adminId);
      if (isSelf) skippedSelf++;
      return !isSelf;
    });
  }
  // 操作紀錄只補不覆蓋；其餘資料表依模式
  const verb = mode === "replace" && table !== "admin_logs" ? "INSERT OR REPLACE" : "INSERT OR IGNORE";
  const sql = verb + " INTO " + q(table) + " (" + cols.map(q).join(", ") + ") VALUES (" + cols.map(() => "?").join(", ") + ")";

  // 操作紀錄：沿用原編號；編號被「別筆」紀錄佔用時改發新編號（不能因為編號相撞就把稽核紀錄丟掉）；
  // 內容完全相同的紀錄（例如重複還原、或還原回同一個系統）就跳過，不會重複。
  const isLogs = table === "admin_logs";
  const dedupeCols = ["created_at", "action", "summary", "admin_username"].filter((c) => cols.includes(c));
  const noIdCols = cols.filter((c) => c !== "id");
  const sqlNoId = isLogs && noIdCols.length && dedupeCols.length
    ? "INSERT INTO " + q(table) + " (" + noIdCols.map(q).join(", ") + ") SELECT " + noIdCols.map(() => "?").join(", ") +
      " WHERE NOT EXISTS (SELECT 1 FROM " + q(table) + " WHERE " + dedupeCols.map((c) => q(c) + " IS ?").join(" AND ") + ")"
    : null;

  const stmts = [];
  for (const r of useRows) {
    if (!Array.isArray(r) || r.length !== cols.length) return json({ error: "有資料列的欄位數量跟 columns 不一致" }, 400);
    const vals = r.map((v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === "boolean") return v ? 1 : 0;
      if (typeof v === "string" || typeof v === "number") return v;
      return Symbol.for("bad");
    });
    if (vals.includes(Symbol.for("bad"))) return json({ error: "資料列裡有不支援的值（只接受文字、數字、空值）" }, 400);
    if (isLogs) {
      if (idIdx >= 0) stmts.push(env.DB.prepare(sql).bind(...vals)); // 編號沒被佔用就沿用
      if (sqlNoId) {
        const noId = cols.map((c, i) => [c, vals[i]]).filter(([c]) => c !== "id").map(([, v]) => v);
        const key = dedupeCols.map((c) => vals[cols.indexOf(c)]);
        stmts.push(env.DB.prepare(sqlNoId).bind(...noId, ...key)); // 被別筆佔用時改發新編號；內容相同則跳過
      }
    } else {
      stmts.push(env.DB.prepare(sql).bind(...vals));
    }
  }

  let inserted = 0;
  try {
    for (let i = 0; i < stmts.length; i += 100) {
      const res = await env.DB.batch([env.DB.prepare("PRAGMA defer_foreign_keys = on"), ...stmts.slice(i, i + 100)]);
      for (const x of res.slice(1)) inserted += (x && x.meta && x.meta.changes) || 0;
    }
  } catch (err) {
    return json({ error: "寫入「" + table + "」失敗：" + String((err && err.message) || err).slice(0, 200) }, 500);
  }
  return json({ ok: true, table, received: rows.length, inserted, skipped_self: skippedSelf });
}

// 備份或還原完成後，由瀏覽器通知伺服器留一筆操作紀錄（並記下「上次備份時間」）
export async function handleBackupFinish(request, env, session) {
  const body = await request.json().catch(() => ({}));
  const type = body.type === "restore" ? "restore" : "export";
  const counts = {};
  let total = 0;
  if (body.tables && typeof body.tables === "object") {
    for (const [k, v] of Object.entries(body.tables).slice(0, 40)) {
      if (NAME_RE.test(k) && Number.isFinite(Number(v))) {
        counts[k] = Number(v);
        total += Number(v);
      }
    }
  }
  const nTables = Object.keys(counts).length;
  if (type === "export") {
    const snap = body.snapshot === true;
    await logAdminAction(env, session, request, {
      action: "data.backup_export",
      summary: (snap ? "還原前自動下載目前資料的備份" : "下載資料備份") + "（" + nTables + " 張資料表、共 " + total + " 筆" + (body.images ? "，含圖片" : "") + (body.encrypted ? "，已加密" : "，未加密") + "）",
      detail: { tables: counts, images: !!body.images, encrypted: !!body.encrypted, snapshot: snap },
    });
    if (!snap) {
      const upsert = "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value";
      await env.DB.batch([
        env.DB.prepare(upsert).bind("last_backup_at", new Date().toISOString().replace("T", " ").slice(0, 19)),
        env.DB.prepare(upsert).bind("last_backup_by", (session && session.username) || ""),
      ]);
    }
  } else {
    const mode = body.mode === "replace" ? "全部覆蓋" : "補回缺少的資料";
    await logAdminAction(env, session, request, {
      action: "data.backup_restore",
      summary: "還原資料備份（" + mode + "，" + nTables + " 張資料表、寫入 " + total + " 筆" + (body.with_admins ? "，含後台帳號" : "") + "）",
      detail: { mode: body.mode === "replace" ? "replace" : "merge", tables: counts, with_admins: !!body.with_admins },
    });
  }
  return json({ ok: true });
}
