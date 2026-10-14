// 後台管理員／員工的兩步驟驗證（TOTP，使用手機驗證器 App，例如 Google Authenticator、Microsoft
// Authenticator、Authy，免費）跟連續失敗鎖定的帳號管理。兩步驟驗證是「選用」的：每個帳號自己決定
// 要不要開，沒開的人登入方式完全不變。
//
// 流程：
//   1. POST /api/admin/2fa/setup   → 產生一組新密鑰（存在 totp_pending_secret，還沒生效），
//                                     回傳 secret + otpauth 連結給前端畫 QR code
//   2. 用手機驗證器 App 掃 QR（或手動輸入密鑰）
//   3. POST /api/admin/2fa/confirm → 輸入 App 顯示的 6 位數驗證碼，驗證通過才正式生效（totp_enabled=1），
//                                     同時產生一組備援碼，只在這次回應裡明碼顯示一次，請使用者自行保存
//   4. 之後登入：帳密正確後，若該帳號已啟用兩步驟驗證，會再要求輸入驗證碼（或備援碼）
//   5. POST /api/admin/2fa/disable → 需要再輸入一次目前密碼，關閉兩步驟驗證
//   6. POST /api/admin/2fa/backup-codes → 需要再輸入一次密碼，重新產生一組備援碼（舊的全部失效）
//
// 如果使用者弄丟手機又把備援碼搞丟，自己是進不去的——這時候由管理員（owner）用員工帳號頁籤的
// 「重設兩步驟驗證」把該帳號的兩步驟驗證關掉（POST /api/admin/staff/:id/2fa-reset），讓他可以只用密碼登入，
// 之後要用再重新設定一次。

import {
  jsonRes as json,
  hashPassword,
  verifyPassword,
  generateTotpSecret,
  verifyTotpCode,
  totpOtpauthUrl,
  generateBackupCodes,
} from "./helpers.js";

const ISSUER = "會員結帳後台";

async function getSelf(env, adminId) {
  try {
    return await env.DB.prepare(
      "SELECT id, username, password_hash, totp_enabled, totp_secret, totp_pending_secret FROM admins WHERE id=?"
    ).bind(adminId).first();
  } catch (e) {
    if (/no such column/i.test(String(e && e.message))) return { __missingMigration: true };
    throw e;
  }
}

const NEED_MIGRATION = () => json({ error: "資料庫還沒升級，請先執行 migrate_v28.sql 再使用兩步驟驗證" }, 400);

// 產生新密鑰（還沒生效），給前端畫 QR code 用
export async function handleTotpSetup(session, env) {
  const admin = await getSelf(env, session.adminId);
  if (!admin) return json({ error: "帳號不存在" }, 404);
  if (admin.__missingMigration) return NEED_MIGRATION();
  if (admin.totp_enabled) return json({ error: "已經啟用兩步驟驗證，請先關閉後再重新設定" }, 400);

  const secret = generateTotpSecret();
  await env.DB.prepare("UPDATE admins SET totp_pending_secret=? WHERE id=?").bind(secret, admin.id).run();
  return json({
    secret,
    otpauth_url: totpOtpauthUrl(secret, admin.username, ISSUER),
  });
}

// 輸入驗證碼確認 → 正式啟用，產生備援碼
export async function handleTotpConfirm(session, request, env) {
  const body = await request.json().catch(() => ({}));
  const admin = await getSelf(env, session.adminId);
  if (!admin) return json({ error: "帳號不存在" }, 404);
  if (admin.__missingMigration) return NEED_MIGRATION();
  if (admin.totp_enabled) return json({ error: "已經啟用兩步驟驗證了" }, 400);
  if (!admin.totp_pending_secret) return json({ error: "請先產生 QR code（重新整理這個畫面再試一次）" }, 400);

  const ok = await verifyTotpCode(admin.totp_pending_secret, body.code);
  if (!ok) return json({ error: "驗證碼不正確，請確認手機時間正確，或重新整理 QR code" }, 400);

  const backupCodes = generateBackupCodes();
  const hashed = await Promise.all(backupCodes.map((c) => hashPassword(c)));
  await env.DB.prepare(
    "UPDATE admins SET totp_secret=?, totp_pending_secret=NULL, totp_enabled=1, totp_backup_codes=? WHERE id=?"
  ).bind(admin.totp_pending_secret, JSON.stringify(hashed), admin.id).run();

  return json({ ok: true, backup_codes: backupCodes });
}

// 關閉兩步驟驗證（需要再輸入一次密碼）
export async function handleTotpDisable(session, request, env) {
  const body = await request.json().catch(() => ({}));
  const admin = await getSelf(env, session.adminId);
  if (!admin) return json({ error: "帳號不存在" }, 404);
  if (admin.__missingMigration) return NEED_MIGRATION();
  if (!admin.totp_enabled) return json({ error: "本來就沒有啟用兩步驟驗證" }, 400);

  const valid = await verifyPassword(body.password || "", admin.password_hash);
  if (!valid) return json({ error: "密碼不正確" }, 401);

  await env.DB.prepare(
    "UPDATE admins SET totp_secret=NULL, totp_pending_secret=NULL, totp_enabled=0, totp_backup_codes=NULL WHERE id=?"
  ).bind(admin.id).run();
  return json({ ok: true });
}

// 重新產生一組備援碼（舊的全部失效），需要再輸入一次密碼
export async function handleTotpRegenerateBackupCodes(session, request, env) {
  const body = await request.json().catch(() => ({}));
  const admin = await getSelf(env, session.adminId);
  if (!admin) return json({ error: "帳號不存在" }, 404);
  if (admin.__missingMigration) return NEED_MIGRATION();
  if (!admin.totp_enabled) return json({ error: "請先啟用兩步驟驗證" }, 400);

  const valid = await verifyPassword(body.password || "", admin.password_hash);
  if (!valid) return json({ error: "密碼不正確" }, 401);

  const backupCodes = generateBackupCodes();
  const hashed = await Promise.all(backupCodes.map((c) => hashPassword(c)));
  await env.DB.prepare("UPDATE admins SET totp_backup_codes=? WHERE id=?").bind(JSON.stringify(hashed), admin.id).run();
  return json({ ok: true, backup_codes: backupCodes });
}

// 管理員（owner）幫其他員工帳號關閉兩步驟驗證：員工手機弄丟、備援碼也找不到時的救援手段。
// 路由本身已經限定只有 owner 能呼叫（跟其他 /api/admin/staff/:id/... 寫入操作一樣）。
export async function handleTotpAdminReset(targetId, env) {
  const admin = await getSelf(env, targetId);
  if (!admin || admin.__missingMigration) {
    if (admin && admin.__missingMigration) return NEED_MIGRATION();
    return json({ error: "帳號不存在" }, 404);
  }
  await env.DB.prepare(
    "UPDATE admins SET totp_secret=NULL, totp_pending_secret=NULL, totp_enabled=0, totp_backup_codes=NULL WHERE id=?"
  ).bind(targetId).run();
  return json({ ok: true, username: admin.username });
}

// 提早解除「連續失敗鎖定」（owner 專用）。table 由呼叫端固定傳入 "admins" 或 "members"，不是使用者輸入。
export async function handleUnlockLogin(table, targetId, env) {
  const label = table === "members" ? "會員帳號" : "員工帳號";
  let row;
  try {
    row = await env.DB.prepare(`SELECT id, username FROM ${table} WHERE id=?`).bind(targetId).first();
  } catch (e) {
    if (/no such column/i.test(String(e && e.message))) return NEED_MIGRATION();
    throw e;
  }
  if (!row) return json({ error: `${label}不存在` }, 404);
  try {
    await env.DB.prepare(`UPDATE ${table} SET failed_attempts=0, locked_until=NULL WHERE id=?`).bind(targetId).run();
  } catch (e) {
    if (!/no such column/i.test(String(e && e.message))) throw e;
    return NEED_MIGRATION();
  }
  return json({ ok: true });
}
