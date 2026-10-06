import { adminHtml, payHtml, memberHtml, memberRegisterHtml } from "./_lib/templates.js";
import { homeHtml } from "./_lib/home.js";
import {
  getPointsConfig,
  savePointsConfig,
  getBalance,
  addLedger,
  spendAtomic,
  reconcileOrderPoints,
  reconcileOrderById,
  reconcileMemberSpends,
  parsePage,
} from "./_lib/points.js";
import {
  normalizeTiktokId,
  handleLiveListRounds,
  handleLiveCreateRound,
  handleLiveUpdateRound,
  handleLiveDeleteRound,
  handleLiveGetRound,
  handleLiveAddItem,
  handleLiveUpdateItem,
  handleLiveDeleteItem,
  handleLiveAddComments,
  handleLiveBindComment,
  handleLiveGuestComment,
  handleLivePromoteComment,
  handleLiveDeleteComment,
  handleLiveRematch,
  handleLiveCreateOrders,
} from "./_lib/live.js";
import { getRateRules, saveRateRules, getAllRateRules, getRateGroupForPlatform, RATE_GROUPS, DEFAULT_RATE_RULES, MIN_QUOTE_AMOUNT, calcCoins } from "./_lib/rates.js";

// 會員自助下單的最低金額，跟查價系統的最低查詢金額保持一致
const MIN_ORDER_AMOUNT = MIN_QUOTE_AMOUNT;
import {
  jsonRes as json,
  htmlRes as html,
  randomToken,
  hashPassword,
  verifyPassword,
  signSession,
  requireAdmin,
  requireMember,
  setCookieHeader,
  clearCookieHeader,
  nowIso,
  addHours,
  PAYMENT_METHODS,
  PLATFORMS,
  PLATFORM_LABEL,
  PLATFORMS_REQUIRE_PASSWORD,
  PROOF_ELIGIBLE_METHODS,
  publicOrderView,
  expireIfNeeded,
  isLinkHardExpired,
  getSettingsObj,
  getOrCreateVapidKeys,
  notifyAdminsOfNewOrder,
  generateReferralCode,
  ensureMemberReferralCode,
  applyCouponToAmount,
  incrementCouponUsage,
  parseTaipeiDatetimeLocalToUtc,
  formatOrderNo,
  parseOrderNo,
  isAllowedEmailDomain,
  emailVerifyEnabled,
  generateNumericCode,
  hashEmailCode,
  sendEmail,
  CVS_STORES,
  CVS_LIMIT,
} from "./_lib/helpers.js";

// 付款連結建立後，最多可以被開啟／操作幾小時，超過就整條連結失效（跟訂單本身 3 小時付款時效是兩回事）。
function linkHardExpireHours(env) {
  return parseInt(env.LINK_HARD_EXPIRE_HOURS || "24", 10);
}

// ---- Setup / auth ----

async function handleSetupStatus(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) as c FROM admins").first();
  return json({ hasAdmin: row.c > 0 });
}

async function handleSetupAdmin(request, env) {
  const row = await env.DB.prepare("SELECT COUNT(*) as c FROM admins").first();
  if (row.c > 0) return json({ error: "管理員帳號已存在，請直接登入" }, 400);
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password || password.length < 6) {
    return json({ error: "請提供帳號，密碼至少 6 碼" }, 400);
  }
  const hash = await hashPassword(password);
  await env.DB.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").bind(username, hash).run();
  return json({ ok: true });
}

async function handleLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  const admin = await env.DB.prepare("SELECT * FROM admins WHERE username=?").bind(username).first();
  if (!admin) return json({ error: "帳號或密碼錯誤" }, 401);
  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) return json({ error: "帳號或密碼錯誤" }, 401);
  const ttlHours = parseInt(env.SESSION_TTL_HOURS || "12", 10);
  const session = await signSession(
    { adminId: admin.id, username: admin.username, exp: Date.now() + ttlHours * 3600 * 1000 },
    env.ADMIN_SESSION_SECRET
  );
  return json({ ok: true }, 200, { "Set-Cookie": setCookieHeader("admin_session", session, ttlHours * 3600) });
}

async function handleLogout() {
  return json({ ok: true }, 200, { "Set-Cookie": clearCookieHeader("admin_session") });
}

async function handleMe(session) {
  return json({ id: session.adminId, username: session.username });
}

// ---- Staff / admin accounts ----

async function handleListStaff(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, username, created_at FROM admins ORDER BY created_at ASC"
  ).all();
  return json(results);
}

async function handleAddStaff(request, env) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !username.trim()) return json({ error: "請輸入帳號" }, 400);
  if (!password || password.length < 6) return json({ error: "密碼至少需要 6 碼" }, 400);
  const hash = await hashPassword(password);
  try {
    const r = await env.DB.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)")
      .bind(username.trim(), hash)
      .run();
    return json({ ok: true, id: r.meta.last_row_id });
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) {
      return json({ error: "此帳號已被使用，請換一個" }, 400);
    }
    throw err;
  }
}

async function handleResetStaffPassword(id, request, env) {
  const body = await request.json().catch(() => ({}));
  const { password } = body;
  if (!password || password.length < 6) return json({ error: "密碼至少需要 6 碼" }, 400);
  const hash = await hashPassword(password);
  await env.DB.prepare("UPDATE admins SET password_hash=? WHERE id=?").bind(hash, id).run();
  return json({ ok: true });
}

async function handleDeleteStaff(id, session, env) {
  if (parseInt(id, 10) === session.adminId) {
    return json({ error: "無法刪除目前登入中的自己帳號，請改用其他帳號登入後再刪除" }, 400);
  }
  const row = await env.DB.prepare("SELECT COUNT(*) as c FROM admins").first();
  if (row.c <= 1) return json({ error: "至少要保留一組管理員帳號，無法全部刪除" }, 400);
  await env.DB.prepare("DELETE FROM admins WHERE id=?").bind(id).run();
  return json({ ok: true });
}

// ---- Members ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleListMembers(env) {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.name, m.account, m.phone, m.email, m.email_verified_at, m.tiktok_id, m.note, m.created_at, m.referral_code,
            r.name as referred_by_name
     FROM members m LEFT JOIN members r ON r.id = m.referred_by
     ORDER BY m.created_at DESC`
  ).all();
  // 相容舊資料：還沒有推薦碼的會員，第一次查看時懶惰補上
  for (const m of results) {
    if (!m.referral_code) m.referral_code = await ensureMemberReferralCode(env, m);
  }
  return json(results);
}

async function handleAddMember(request, env) {
  const body = await request.json().catch(() => ({}));
  const { name, phone, email, note, account, password } = body;
  if (!name || !name.trim()) return json({ error: "請輸入姓名" }, 400);
  const tiktokRaw = body.tiktok_id && String(body.tiktok_id).trim() ? String(body.tiktok_id).trim() : "";
  const tiktokId = tiktokRaw ? normalizeTiktokId(tiktokRaw) : null;
  if (tiktokRaw && !tiktokId) return json({ error: "TikTok 帳號格式不正確（只能英文、數字、底線、句點）" }, 400);
  if (password && password.length < 6) return json({ error: "密碼至少需要 6 碼" }, 400);
  // 後台彈性：電話、信箱都可以不填；有填信箱才檢查格式
  const emailClean = email && String(email).trim() ? String(email).trim() : null;
  if (emailClean && !EMAIL_RE.test(emailClean)) return json({ error: "電子信箱格式不正確" }, 400);

  const passwordHash = password ? await hashPassword(password) : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const referralCode = generateReferralCode();
    try {
      const r = await env.DB.prepare(
        "INSERT INTO members (name, account, password_hash, phone, email, note, referral_code, tiktok_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          name.trim(),
          account && account.trim() ? account.trim() : null,
          passwordHash,
          phone && String(phone).trim() ? String(phone).trim() : null,
          emailClean,
          note || null,
          referralCode,
          tiktokId
        )
        .run();
      return json({ ok: true, id: r.meta.last_row_id, referral_code: referralCode });
    } catch (err) {
      const msg = String(err.message || "");
      if (msg.includes("referral_code")) continue; // 推薦碼恰好撞號，重新產生再試
      if (msg.includes("tiktok_id")) return json({ error: "此 TikTok 帳號已綁定其他會員" }, 400);
      if (msg.includes("UNIQUE")) return json({ error: "此帳號已被使用，請換一個" }, 400);
      throw err;
    }
  }
  return json({ error: "建立會員失敗，請再試一次" }, 500);
}

async function handleDeleteMember(id, env) {
  await env.DB.prepare("DELETE FROM members WHERE id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM points_ledger WHERE member_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM points_redemptions WHERE member_id=?").bind(id).run();
  return json({ ok: true });
}

async function handleUpdateMember(id, request, env) {
  const existing = await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(id).first();
  if (!existing) return json({ error: "找不到此會員" }, 404);

  const body = await request.json().catch(() => ({}));
  const { name, phone, email, note, account } = body;
  if (name !== undefined && !String(name).trim()) return json({ error: "姓名不可為空白" }, 400);
  const newEmail = email !== undefined ? (email && String(email).trim() ? String(email).trim() : null) : existing.email;
  if (newEmail && !EMAIL_RE.test(newEmail)) return json({ error: "電子信箱格式不正確" }, 400);

  const newName = name !== undefined ? name.trim() : existing.name;
  const newPhone = phone !== undefined ? phone || null : existing.phone;
  const newNote = note !== undefined ? note || null : existing.note;
  const newAccount = account !== undefined ? (account && account.trim() ? account.trim() : null) : existing.account;
  let newTiktok = existing.tiktok_id || null;
  if (body.tiktok_id !== undefined) {
    const raw = body.tiktok_id && String(body.tiktok_id).trim() ? String(body.tiktok_id).trim() : "";
    newTiktok = raw ? normalizeTiktokId(raw) : null;
    if (raw && !newTiktok) return json({ error: "TikTok 帳號格式不正確（只能英文、數字、底線、句點）" }, 400);
  }

  // 信箱有變更就清掉「已驗證」標記（只改大小寫視為同一個信箱）
  const sameEmail = (newEmail || "").toLowerCase() === (existing.email || "").toLowerCase();
  const newVerifiedAt = sameEmail ? existing.email_verified_at ?? null : null;

  try {
    await env.DB.prepare("UPDATE members SET name=?, phone=?, email=?, email_verified_at=?, note=?, account=?, tiktok_id=? WHERE id=?")
      .bind(newName, newPhone, newEmail, newVerifiedAt, newNote, newAccount, newTiktok, id)
      .run();
    return json({ ok: true });
  } catch (err) {
    if (String(err.message || "").includes("tiktok_id")) {
      return json({ error: "此 TikTok 帳號已綁定其他會員" }, 400);
    }
    if (String(err.message || "").includes("UNIQUE")) {
      return json({ error: "此帳號已被使用，請換一個" }, 400);
    }
    throw err;
  }
}

async function handleSetMemberPassword(id, request, env) {
  const body = await request.json().catch(() => ({}));
  const { password } = body;
  if (!password || password.length < 6) return json({ error: "密碼至少需要 6 碼" }, 400);
  const hash = await hashPassword(password);
  await env.DB.prepare("UPDATE members SET password_hash=? WHERE id=?").bind(hash, id).run();
  return json({ ok: true });
}

// ---- Settings ----

async function handleGetSettings(env) {
  const obj = await getSettingsObj(env);
  return json(obj);
}

async function handleSaveSettings(request, env) {
  const body = await request.json().catch(() => ({}));
  const allowed = ["bank_name", "bank_account_number", "bank_account_holder"];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      )
        .bind(key, body[key])
        .run();
    }
  }
  return json({ ok: true });
}

// ---- 系統公告（會員登入 /member 時彈出） ----
const DEFAULT_ANNOUNCEMENT = { enabled: false, type: "text", title: "", text: "", images: [], updated_at: null };

async function handleGetAnnouncement(env) {
  const settings = await getSettingsObj(env);
  let ann = DEFAULT_ANNOUNCEMENT;
  if (settings.announcement) {
    try {
      ann = { ...DEFAULT_ANNOUNCEMENT, ...JSON.parse(settings.announcement) };
    } catch {
      ann = DEFAULT_ANNOUNCEMENT;
    }
  }
  return json(ann);
}

async function handleSaveAnnouncement(request, env) {
  const body = await request.json().catch(() => ({}));
  const enabled = !!body.enabled;
  const type = body.type === "image" ? "image" : "text";
  const title = typeof body.title === "string" ? body.title.slice(0, 100) : "";
  const text = typeof body.text === "string" ? body.text.slice(0, 2000) : "";
  let images = Array.isArray(body.images)
    ? body.images.filter((s) => typeof s === "string" && s.startsWith("data:image"))
    : [];
  images = images.slice(0, 10); // 最多 10 張，避免單一設定值過大

  if (enabled && type === "text" && !text.trim()) {
    return json({ error: "公告內容不能空白" }, 400);
  }
  if (enabled && type === "image" && images.length === 0) {
    return json({ error: "請至少上傳一張公告圖片" }, 400);
  }

  const ann = { enabled, type, title, text, images, updated_at: nowIso() };
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('announcement', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  )
    .bind(JSON.stringify(ann))
    .run();
  return json({ ok: true });
}

// 會員端只需要「是否啟用」與顯示所需的內容，並附上 version（=最後儲存時間）供前端判斷「今天不再顯示」是否該重新彈出
async function handleMemberAnnouncement(env) {
  const settings = await getSettingsObj(env);
  if (!settings.announcement) return json({ enabled: false });
  let ann;
  try {
    ann = JSON.parse(settings.announcement);
  } catch {
    return json({ enabled: false });
  }
  if (!ann.enabled) return json({ enabled: false });
  return json({
    enabled: true,
    type: ann.type === "image" ? "image" : "text",
    title: ann.title || "",
    text: ann.text || "",
    images: Array.isArray(ann.images) ? ann.images : [],
    version: ann.updated_at || "",
  });
}

// ---- 費率設定 ----

async function handlePublicRates(env) {
  const groups = await getAllRateRules(env);
  return json({ groups });
}

async function handleGetRates(request, env) {
  const url = new URL(request.url);
  const group = RATE_GROUPS.includes(url.searchParams.get("group")) ? url.searchParams.get("group") : "tiktok";
  const rules = await getRateRules(env, group);
  return json({ rules, group, isDefault: JSON.stringify(rules) === JSON.stringify(DEFAULT_RATE_RULES) });
}

async function handleSaveRates(request, env) {
  const body = await request.json().catch(() => ({}));
  const group = RATE_GROUPS.includes(body.group) ? body.group : "tiktok";
  const rules = body.rules;
  if (!Array.isArray(rules) || rules.length === 0) {
    return json({ error: "費率格式錯誤，需為陣列" }, 400);
  }
  for (const r of rules) {
    if (typeof r.min !== "number" || typeof r.rate !== "number") {
      return json({ error: "每筆費率需包含 min（數字）與 rate（數字）" }, 400);
    }
  }
  rules.sort((a, b) => b.min - a.min);
  await saveRateRules(env, rules, group);
  return json({ ok: true, group });
}

// ---- 優惠碼 ----

function couponPublicView(c) {
  return {
    id: c.id,
    code: c.code,
    discount_type: c.discount_type || "percent",
    discount_percent: c.discount_percent,
    discount_amount: c.discount_amount,
    max_discount_amount: c.max_discount_amount,
    min_order_amount: c.min_order_amount,
    usage_limit: c.usage_limit,
    used_count: c.used_count,
    expires_at: c.expires_at,
    is_active: !!c.is_active,
    note: c.note,
    created_at: c.created_at,
  };
}

async function handleListCoupons(env) {
  const { results } = await env.DB.prepare("SELECT * FROM coupons ORDER BY created_at DESC").all();
  return json(results.map(couponPublicView));
}

async function handleCreateCoupon(request, env) {
  const body = await request.json().catch(() => ({}));
  const code = (body.code || "").trim().toUpperCase();
  if (!code) return json({ error: "請輸入優惠碼" }, 400);

  const discountType = body.discount_type === "fixed" ? "fixed" : "percent";

  let discountPercent = null;
  let discountAmount = null;
  if (discountType === "percent") {
    discountPercent = parseFloat(body.discount_percent);
    if (!discountPercent || discountPercent <= 0 || discountPercent > 100) {
      return json({ error: "折扣百分比需介於 0~100 之間" }, 400);
    }
  } else {
    discountAmount = parseFloat(body.discount_amount);
    if (!discountAmount || discountAmount <= 0) {
      return json({ error: "折抵金額需大於 0" }, 400);
    }
  }

  const maxDiscountAmount =
    discountType === "percent" &&
    body.max_discount_amount !== undefined && body.max_discount_amount !== null && String(body.max_discount_amount).trim() !== ""
      ? parseFloat(body.max_discount_amount)
      : null;
  if (maxDiscountAmount !== null && (isNaN(maxDiscountAmount) || maxDiscountAmount < 0)) {
    return json({ error: "最高優惠金額不正確" }, 400);
  }

  const minOrderAmount =
    body.min_order_amount !== undefined && body.min_order_amount !== null && String(body.min_order_amount).trim() !== ""
      ? parseFloat(body.min_order_amount)
      : 0;
  if (isNaN(minOrderAmount) || minOrderAmount < 0) return json({ error: "最低訂單金額不正確" }, 400);

  const usageLimit =
    body.usage_limit !== undefined && body.usage_limit !== null && String(body.usage_limit).trim() !== ""
      ? parseInt(body.usage_limit, 10)
      : null;
  if (usageLimit !== null && (isNaN(usageLimit) || usageLimit <= 0)) return json({ error: "使用次數上限不正確" }, 400);

  let expiresAt = null;
  if (body.expires_at && String(body.expires_at).trim()) {
    const parsed = parseTaipeiDatetimeLocalToUtc(body.expires_at);
    if (parsed.error) return json({ error: "到期時間格式不正確" }, 400);
    expiresAt = parsed.value;
  }

  try {
    const r = await env.DB.prepare(
      `INSERT INTO coupons (code, discount_type, discount_percent, discount_amount, max_discount_amount, min_order_amount, usage_limit, expires_at, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(code, discountType, discountPercent, discountAmount, maxDiscountAmount, minOrderAmount, usageLimit, expiresAt, body.note || null)
      .run();
    return json({ ok: true, id: r.meta.last_row_id });
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) return json({ error: "此優惠碼已存在，請換一個代碼" }, 400);
    throw err;
  }
}

async function handleUpdateCoupon(id, request, env) {
  const existing = await env.DB.prepare("SELECT * FROM coupons WHERE id=?").bind(id).first();
  if (!existing) return json({ error: "找不到此優惠碼" }, 404);

  const body = await request.json().catch(() => ({}));
  const fields = [];
  const binds = [];

  if (body.code !== undefined) {
    const code = (body.code || "").trim().toUpperCase();
    if (!code) return json({ error: "優惠碼不可為空白" }, 400);
    fields.push("code=?");
    binds.push(code);
  }
  if (body.discount_type !== undefined) {
    const dt = body.discount_type === "fixed" ? "fixed" : "percent";
    fields.push("discount_type=?");
    binds.push(dt);
  }
  if (body.discount_percent !== undefined) {
    const v = body.discount_percent === null || String(body.discount_percent).trim() === "" ? null : parseFloat(body.discount_percent);
    if (v !== null && (isNaN(v) || v <= 0 || v > 100)) return json({ error: "折扣百分比需介於 0~100 之間" }, 400);
    fields.push("discount_percent=?");
    binds.push(v);
  }
  if (body.discount_amount !== undefined) {
    const v = body.discount_amount === null || String(body.discount_amount).trim() === "" ? null : parseFloat(body.discount_amount);
    if (v !== null && (isNaN(v) || v <= 0)) return json({ error: "折抵金額需大於 0" }, 400);
    fields.push("discount_amount=?");
    binds.push(v);
  }
  if (body.max_discount_amount !== undefined) {
    const v = body.max_discount_amount === null || String(body.max_discount_amount).trim() === "" ? null : parseFloat(body.max_discount_amount);
    if (v !== null && (isNaN(v) || v < 0)) return json({ error: "最高優惠金額不正確" }, 400);
    fields.push("max_discount_amount=?");
    binds.push(v);
  }
  if (body.min_order_amount !== undefined) {
    const v = body.min_order_amount === null || String(body.min_order_amount).trim() === "" ? 0 : parseFloat(body.min_order_amount);
    if (isNaN(v) || v < 0) return json({ error: "最低訂單金額不正確" }, 400);
    fields.push("min_order_amount=?");
    binds.push(v);
  }
  if (body.usage_limit !== undefined) {
    const v = body.usage_limit === null || String(body.usage_limit).trim() === "" ? null : parseInt(body.usage_limit, 10);
    if (v !== null && (isNaN(v) || v <= 0)) return json({ error: "使用次數上限不正確" }, 400);
    fields.push("usage_limit=?");
    binds.push(v);
  }
  if (body.expires_at !== undefined) {
    let expiresAt = null;
    if (body.expires_at && String(body.expires_at).trim()) {
      const parsed = parseTaipeiDatetimeLocalToUtc(body.expires_at);
      if (parsed.error) return json({ error: "到期時間格式不正確" }, 400);
      expiresAt = parsed.value;
    }
    fields.push("expires_at=?");
    binds.push(expiresAt);
  }
  if (body.note !== undefined) {
    fields.push("note=?");
    binds.push(body.note || null);
  }
  if (body.is_active !== undefined) {
    fields.push("is_active=?");
    binds.push(body.is_active ? 1 : 0);
  }

  if (!fields.length) return json({ error: "沒有要更新的內容" }, 400);

  try {
    binds.push(id);
    await env.DB.prepare(`UPDATE coupons SET ${fields.join(", ")} WHERE id=?`).bind(...binds).run();
    return json({ ok: true });
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) return json({ error: "此優惠碼已存在，請換一個代碼" }, 400);
    throw err;
  }
}

async function handleDeleteCoupon(id, env) {
  await env.DB.prepare("DELETE FROM coupons WHERE id=?").bind(id).run();
  return json({ ok: true });
}

// 試算優惠碼折抵金額（結帳櫃檯 / 會員自助下單都會用到，下單前先預覽，不會真的扣用次數）
async function handleCouponPreview(request, env) {
  const body = await request.json().catch(() => ({}));
  const amt = parseFloat(body.amount);
  if (!amt || amt <= 0) return json({ error: "金額不正確" }, 400);

  const result = await applyCouponToAmount(env, body.code, amt);
  if (!result.ok) return json({ error: result.error }, 400);
  return json({
    ok: true,
    code: result.coupon.code,
    discount: result.discount,
    final_amount: result.finalAmount,
  });
}

// ---- Orders (admin) ----

async function handleCreateOrder(request, env) {
  const body = await request.json().catch(() => ({}));
  const { amount, member_id, non_member_name, payment_method, coupon_code, platform } = body;
  const storeBrand = payment_method === "store_barcode" && body.store_brand ? String(body.store_brand) : null;

  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return json({ error: "金額不正確" }, 400);
  if (payment_method && !PAYMENT_METHODS.has(payment_method)) return json({ error: "付款方式不正確" }, 400);
  if (storeBrand && !CVS_STORES[storeBrand]) return json({ error: "超商選擇不正確" }, 400);
  if (platform && !PLATFORMS.has(platform)) return json({ error: "儲值平台不正確" }, 400);

  let memberNameSnapshot = non_member_name && non_member_name.trim() ? non_member_name.trim() : "非會員";
  let memberId = null;
  if (member_id) {
    const m = await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(member_id).first();
    if (!m) return json({ error: "找不到指定會員" }, 400);
    memberId = m.id;
    memberNameSnapshot = m.name;
  }

  let finalAmount = amt;
  let couponResult = null;
  if (coupon_code && coupon_code.trim()) {
    couponResult = await applyCouponToAmount(env, coupon_code, amt);
    if (!couponResult.ok) return json({ error: couponResult.error }, 400);
    finalAmount = couponResult.finalAmount;
  }
  if (payment_method === "store_barcode" && finalAmount > CVS_LIMIT) {
    return json({ error: `超商條碼單筆上限 $${CVS_LIMIT.toLocaleString()}，超過請分筆訂單` }, 400);
  }

  // 預計獲得幣數：只有指定了儲值平台才試算（TikTok 用自己一組費率，快手/小紅書/陸抖 共用另一組）
  let coins = null;
  if (platform) {
    const rateRules = await getRateRules(env, getRateGroupForPlatform(platform));
    const coinsResult = calcCoins(rateRules, amt);
    coins = coinsResult ? coinsResult.coins : null;
  }

  const token = randomToken(24);
  const ttlHours = parseInt(env.LINK_TTL_HOURS || "3", 10);
  const expiresAt = addHours(new Date(), ttlHours).toISOString().replace("T", " ").slice(0, 19);

  let status = "pending_method";
  let bankFields = { bank_name: null, bank_account_number: null, bank_account_holder: null };

  if (payment_method === "transfer") {
    status = "awaiting_payment";
    const settings = await getSettingsObj(env);
    bankFields = {
      bank_name: settings.bank_name || null,
      bank_account_number: settings.bank_account_number || null,
      bank_account_holder: settings.bank_account_holder || null,
    };
  } else if (payment_method === "store_barcode" || payment_method === "taiwan_pay") {
    status = "awaiting_barcode";
  }

  const methodSelectedAt = payment_method ? nowIso() : null;

  const insertResult = await env.DB.prepare(
    `INSERT INTO orders (token, amount, member_id, member_name_snapshot, payment_method, status,
      bank_name, bank_account_number, bank_account_holder, expires_at, method_selected_at,
      original_amount, coupon_code, coupon_discount, platform, coins)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      token,
      finalAmount,
      memberId,
      memberNameSnapshot,
      payment_method || null,
      status,
      bankFields.bank_name,
      bankFields.bank_account_number,
      bankFields.bank_account_holder,
      expiresAt,
      methodSelectedAt,
      couponResult ? amt : null,
      couponResult ? couponResult.coupon.code : null,
      couponResult ? couponResult.discount : null,
      platform || null,
      coins
    )
    .run();

  if (couponResult) await incrementCouponUsage(env, couponResult.coupon.id);
  if (storeBrand) {
    await env.DB.prepare("UPDATE orders SET store_brand=? WHERE id=?").bind(storeBrand, insertResult.meta.last_row_id).run();
  }

  const url = new URL(request.url);
  const link = `${url.origin}/pay/${token}`;
  return json({
    ok: true,
    token,
    link,
    expires_at: expiresAt,
    amount: finalAmount,
    discount: couponResult ? couponResult.discount : 0,
    order_no: formatOrderNo(insertResult.meta.last_row_id),
  });
}

async function handleListOrders(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const orderNoParam = url.searchParams.get("order_no");

  // 用訂單編號（例如 TW210007，或只打數字部分也可以）快速查詢單一訂單，不受月份篩選限制
  if (orderNoParam && orderNoParam.trim()) {
    const id = parseOrderNo(orderNoParam);
    if (!id) return json([]);
    const { results } = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).all();
    return json(results.map((o) => ({ ...o, order_no: formatOrderNo(o.id) })));
  }

  let query = "SELECT * FROM orders";
  const binds = [];
  if (month) {
    query += " WHERE strftime('%Y-%m', created_at) = ?";
    binds.push(month);
  }
  query += " ORDER BY created_at DESC";
  const stmt = binds.length ? env.DB.prepare(query).bind(...binds) : env.DB.prepare(query);
  const { results } = await stmt.all();
  return json(results.map((o) => ({ ...o, order_no: formatOrderNo(o.id) })));
}

function normalizeImageDataUrl(v) {
  if (!v || typeof v !== "string") return v;
  // 部分安卓瀏覽器傳來 data:application/octet-stream 或空的 MIME，統一視為圖片
  return v.replace(/^data:(application\/octet-stream|binary\/octet-stream)?;base64,/, "data:image/jpeg;base64,");
}

async function handleUploadBarcode(id, request, env) {
  const body = await request.json().catch(() => ({}));
  const image_base64 = normalizeImageDataUrl(body.image_base64);
  if (!image_base64 || !image_base64.startsWith("data:image")) return json({ error: "請上傳有效的圖片" }, 400);
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
  if (!order) return json({ error: "找不到訂單" }, 404);
  if (!["store_barcode", "taiwan_pay"].includes(order.payment_method)) {
    return json({ error: "此訂單付款方式不需要上傳條碼" }, 400);
  }
  await env.DB.prepare(
    "UPDATE orders SET barcode_image=?, status='ready_to_pay', barcode_uploaded_at=? WHERE id=?"
  )
    .bind(image_base64, nowIso(), id)
    .run();
  return json({ ok: true });
}

async function handleMarkPaid(id, env) {
  await env.DB.prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=?").bind(nowIso(), id).run();
  await reconcileOrderById(env, id);
  return json({ ok: true });
}

async function handleCancelOrder(id, env) {
  await env.DB.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(id).run();
  await reconcileOrderById(env, id);
  return json({ ok: true });
}

async function handleDeleteOrder(id, env) {
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
  if (!order) return json({ error: "找不到訂單" }, 404);
  await reconcileOrderPoints(env, order, { gone: true });
  await env.DB.prepare("DELETE FROM orders WHERE id=?").bind(id).run();
  return json({ ok: true });
}

async function handleCorrectOrder(id, request, env) {
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
  if (!order) return json({ error: "找不到訂單" }, 404);
  if (order.status === "cancelled") return json({ error: "已取消的訂單無法更正" }, 400);
  if (order.is_completed) return json({ error: "此訂單已結案，請先取消結案才能更正" }, 400);

  const body = await request.json().catch(() => ({}));
  const fields = [];
  const binds = [];

  let correctedAmount = order.amount;
  if (body.amount !== undefined && body.amount !== null && String(body.amount).trim() !== "") {
    const amt = parseFloat(body.amount);
    if (!amt || amt <= 0) return json({ error: "金額不正確" }, 400);
    fields.push("amount=?");
    binds.push(amt);
    correctedAmount = amt;
  }

  // 超商條碼：單筆上限、超商選擇
  const finalMethod = body.payment_method !== undefined ? body.payment_method || null : order.payment_method;
  if (finalMethod === "store_barcode" && correctedAmount > CVS_LIMIT) {
    return json({ error: `超商條碼單筆上限 $${CVS_LIMIT.toLocaleString()}，超過請分筆訂單或改用其他付款方式` }, 400);
  }
  if (body.payment_method !== undefined && (body.payment_method || null) !== order.payment_method) {
    fields.push("store_brand=?");
    binds.push(null); // 換付款方式 → 先清掉超商（下面若指定了超商會覆蓋）
  }
  if (finalMethod === "store_barcode" && body.store_brand !== undefined) {
    const sb = body.store_brand ? String(body.store_brand) : null;
    if (sb && !CVS_STORES[sb]) return json({ error: "超商選擇不正確" }, 400);
    fields.push("store_brand=?");
    binds.push(sb);
  }

  if (body.member_id !== undefined) {
    if (body.member_id) {
      const m = await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(body.member_id).first();
      if (!m) return json({ error: "找不到指定會員" }, 400);
      fields.push("member_id=?", "member_name_snapshot=?");
      binds.push(m.id, m.name);
    } else {
      const name = body.non_member_name && body.non_member_name.trim() ? body.non_member_name.trim() : "非會員";
      fields.push("member_id=?", "member_name_snapshot=?");
      binds.push(null, name);
    }
  }

  if (body.platform !== undefined) {
    const platform = body.platform || null;
    if (platform && !PLATFORMS.has(platform)) return json({ error: "儲值平台不正確" }, 400);
    fields.push("platform=?");
    binds.push(platform);
  }

  if (body.payment_method !== undefined) {
    const method = body.payment_method || null;
    if (method && !PAYMENT_METHODS.has(method)) return json({ error: "付款方式不正確" }, 400);
    if (method !== order.payment_method) {
      if (!method) {
        fields.push(
          "payment_method=?", "status=?", "method_selected_at=?",
          "bank_name=?", "bank_account_number=?", "bank_account_holder=?",
          "barcode_image=?", "barcode_uploaded_at=?",
          "proof_image=?", "proof_last_digits=?", "proof_uploaded_at=?"
        );
        binds.push(null, "pending_method", null, null, null, null, null, null, null, null, null);
      } else {
        let newStatus = order.status === "paid" ? "paid" : method === "transfer" ? "awaiting_payment" : "awaiting_barcode";
        let bankFields = {
          bank_name: order.bank_name,
          bank_account_number: order.bank_account_number,
          bank_account_holder: order.bank_account_holder,
        };
        if (newStatus === "awaiting_payment") {
          const settings = await getSettingsObj(env);
          bankFields = {
            bank_name: settings.bank_name || null,
            bank_account_number: settings.bank_account_number || null,
            bank_account_holder: settings.bank_account_holder || null,
          };
        }
        fields.push(
          "payment_method=?", "status=?", "method_selected_at=?",
          "bank_name=?", "bank_account_number=?", "bank_account_holder=?",
          "barcode_image=?", "barcode_uploaded_at=?",
          "proof_image=?", "proof_last_digits=?", "proof_uploaded_at=?"
        );
        binds.push(
          method, newStatus, nowIso(),
          bankFields.bank_name, bankFields.bank_account_number, bankFields.bank_account_holder,
          null, null, null, null, null
        );
      }
    }
  }

  if (!fields.length) return json({ error: "沒有要更正的內容" }, 400);

  binds.push(id);
  await env.DB.prepare(`UPDATE orders SET ${fields.join(", ")} WHERE id=?`).bind(...binds).run();
  await reconcileOrderById(env, id, { recalc: body.amount !== undefined && body.amount !== null && String(body.amount).trim() !== "" });
  return json({ ok: true });
}

// 訂單內部備註：只給後台看，跟「更正」是分開的動作，不受訂單狀態（已取消/已結案）限制，隨時可以補寫。
async function handleUpdateOrderNote(id, request, env) {
  const order = await env.DB.prepare("SELECT id FROM orders WHERE id=?").bind(id).first();
  if (!order) return json({ error: "找不到訂單" }, 404);
  const body = await request.json().catch(() => ({}));
  const note = body.note && String(body.note).trim() ? String(body.note).trim() : null;
  await env.DB.prepare("UPDATE orders SET admin_note=? WHERE id=?").bind(note, id).run();
  return json({ ok: true });
}

function escHtmlMail(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function maskEmail(e) {
  const [u, d] = String(e).split("@");
  if (!d) return e;
  return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***") + "@" + d;
}

// 訂單完成通知信：回傳 { sent, reason?, to? }；任何失敗都只回報原因，不會讓「訂單完成」本身失敗
async function sendOrderCompleteEmail(env, order) {
  const ownAddr = order.notify_email_addr && String(order.notify_email_addr).trim() ? String(order.notify_email_addr).trim() : null;
  if (!order.member_id && !ownAddr) return { sent: false, reason: "此訂單不是會員訂單，沒有信箱可寄" };
  const m = order.member_id
    ? await env.DB.prepare("SELECT name, email FROM members WHERE id=?").bind(order.member_id).first()
    : { name: order.member_name_snapshot, email: null };
  const toAddr = ownAddr || (m && m.email ? String(m.email).trim() : "");
  if (!toAddr) return { sent: false, reason: "此會員沒有填寫信箱，未寄送" };
  const orderSender = env.EMAIL_FROM_ORDER || env.EMAIL_FROM;
  if (!env.RESEND_API_KEY || !orderSender) return { sent: false, reason: "尚未設定寄信服務（RESEND_API_KEY / EMAIL_FROM_ORDER 或 EMAIL_FROM），未寄送" };

  const orderNo = formatOrderNo(order.id);
  const PM = { transfer: "轉帳", store_barcode: "超商條碼", taiwan_pay: "TWQR" };
  const CVS = { seven: "7-11", family: "全家", hilife: "萊爾富" };
  const rows = [["訂單編號", orderNo], ["訂單金額", "$" + order.amount]];
  if (order.platform) rows.push(["儲值平台", PLATFORM_LABEL[order.platform] || order.platform]);
  if (order.payment_method) {
    rows.push(["付款方式", (PM[order.payment_method] || order.payment_method) + (order.store_brand && CVS[order.store_brand] ? "（" + CVS[order.store_brand] + "）" : "")]);
  }
  rows.push(["完成時間", new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })]);

  const name = (m && m.name) || order.member_name_snapshot || "會員";
  const tableHtml = rows
    .map((r) => `<tr><td style="padding:6px 12px 6px 0;color:#767B8C;white-space:nowrap;">${escHtmlMail(r[0])}</td><td style="padding:6px 0;font-weight:600;">${escHtmlMail(r[1])}</td></tr>`)
    .join("");
  try {
    await sendEmail(env, {
      to: toAddr,
      from: orderSender,
      subject: `【訂單完成】${orderNo} 已完成`,
      text: `${name} 您好，您的訂單 ${orderNo} 已完成，謝謝您的惠顧。\n` + rows.map((r) => `${r[0]}：${r[1]}`).join("\n"),
      html: `<div style="font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;max-width:440px;margin:auto;padding:20px;">
        <p style="font-size:16px;">${escHtmlMail(name)} 您好，</p>
        <p>您的訂單已完成，謝謝您的惠顧！</p>
        <table style="border-collapse:collapse;margin:12px 0;font-size:14px;">${tableHtml}</table>
        <p style="color:#767B8C;font-size:13px;">這是系統自動發送的通知信，如有任何問題請直接聯絡店家。</p></div>`,
    });
    return { sent: true, to: maskEmail(toAddr) };
  } catch (e) {
    return { sent: false, reason: "寄信失敗：" + String(e.message || e).slice(0, 120) };
  }
}

async function handleCompleteOrder(id, request, env) {
  const body = await request.json().catch(() => ({}));
  const adminWantsEmail = body.send_email === true || body.send_email === 1 || body.send_email === "1";
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
  if (!order) return json({ error: "找不到訂單" }, 404);
  // 後台有勾，或顧客下單時自己勾選了要通知 → 寄信
  const wantEmail = adminWantsEmail || order.notify_email === 1;
  if (order.status !== "paid") return json({ error: "只有已完成付款的訂單才能標記為訂單完成" }, 400);
  const alreadyCompleted = !!order.is_completed;
  await env.DB.prepare("UPDATE orders SET is_completed=1, completed_at=? WHERE id=?").bind(nowIso(), id).run();
  await reconcileOrderById(env, id); // 訂單完成 → 發放回饋點數

  // 勾選了才寄信；已經是完成狀態的訂單（例如重複點擊）不重複寄
  let email = null;
  if (wantEmail) {
    email = alreadyCompleted ? { sent: false, reason: "此訂單先前已標記完成，未重複寄信" } : await sendOrderCompleteEmail(env, order);
  }
  return json({ ok: true, email });
}

async function handleUncompleteOrder(id, env) {
  await env.DB.prepare("UPDATE orders SET is_completed=0, completed_at=NULL WHERE id=?").bind(id).run();
  await reconcileOrderById(env, id); // 取消結案 → 扣回回饋點數
  return json({ ok: true });
}

async function handleExport(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const { results } = await env.DB.prepare(
    "SELECT * FROM orders WHERE strftime('%Y-%m', created_at) = ? ORDER BY created_at ASC"
  )
    .bind(month)
    .all();

  const toTaipeiTime = (dateStr) => {
    if (!dateStr) return "";
    const isoStr = String(dateStr).replace(" ", "T") + "Z";
    return new Date(isoStr).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
  };

  const PM_LABEL = { transfer: "轉帳", store_barcode: "超商條碼", taiwan_pay: "TWQR" };
  const STATUS_LABEL = {
    pending_method: "待選付款方式",
    awaiting_payment: "等待轉帳付款",
    awaiting_barcode: "待上傳條碼",
    ready_to_pay: "已可付款(條碼)",
    paid: "已完成付款",
    expired: "已過期",
    cancelled: "已取消",
  };

  const header = ["訂單編號", "建立時間", "會員/客人", "儲值平台", "儲值帳號", "儲值密碼", "原始金額", "優惠碼", "折抵金額", "使用點數", "點數折抵", "實付金額", "預計獲得幣數", "付款方式", "狀態", "訂單完成(結案)", "付款證明末幾碼", "付款方式選擇時間", "完成付款時間", "到期時間", "備註"];
  const rows = results.map((o) => [
    formatOrderNo(o.id),
    toTaipeiTime(o.created_at),
    o.member_name_snapshot,
    PLATFORM_LABEL[o.platform] || "未指定",
    o.platform_account || "",
    o.platform_password || "",
    o.original_amount != null ? o.original_amount : "",
    o.coupon_code || "",
    o.coupon_discount != null ? o.coupon_discount : "",
    o.points_used || "",
    o.points_discount != null ? o.points_discount : "",
    o.amount,
    o.coins != null ? o.coins : "",
    PM_LABEL[o.payment_method] || "",
    STATUS_LABEL[o.status] || o.status,
    o.is_completed ? "是" : "否",
    o.proof_last_digits || "",
    toTaipeiTime(o.method_selected_at),
    toTaipeiTime(o.paid_at),
    toTaipeiTime(o.expires_at),
    o.admin_note || "",
  ]);

  const csvLines = [header, ...rows].map((row) =>
    row
      .map((cell) => {
        const s = String(cell ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(",")
  );
  const csv = "\uFEFF" + csvLines.join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders_${month}.csv"`,
    },
  });
}

async function handleMonthlyStats(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const { results } = await env.DB.prepare(
    `SELECT COALESCE(member_id, -1) as member_key, member_name_snapshot as member_name,
            COUNT(*) as count, SUM(amount) as total
     FROM orders
     WHERE status='paid' AND strftime('%Y-%m', paid_at) = ?
     GROUP BY member_key, member_name
     ORDER BY total DESC`
  )
    .bind(month)
    .all();
  return json(results.map((r) => ({ member_name: r.member_name, count: r.count, total: r.total })));
}

// ---- Public order endpoints ----

async function handleGetOrderPublic(token, env) {
  let order = await env.DB.prepare("SELECT * FROM orders WHERE token=?").bind(token).first();
  if (!order) return json({ error: "找不到此訂單，連結可能有誤" }, 404);
  if (isLinkHardExpired(order, linkHardExpireHours(env))) {
    return json({ error: "此付款連結已失效，請洽店家重新開立" }, 410);
  }
  order = await expireIfNeeded(env.DB, order);
  return json(publicOrderView(order));
}

async function handleSelectMethod(token, request, env) {
  const body = await request.json().catch(() => ({}));
  const { method } = body;
  if (!PAYMENT_METHODS.has(method)) return json({ error: "付款方式不正確" }, 400);
  const store = method === "store_barcode" ? String(body.store || "") : null;
  if (method === "store_barcode" && !CVS_STORES[store]) return json({ error: "請先選擇超商（7-11、全家或萊爾富）" }, 400);

  let order = await env.DB.prepare("SELECT * FROM orders WHERE token=?").bind(token).first();
  if (!order) return json({ error: "找不到此訂單" }, 404);
  if (isLinkHardExpired(order, linkHardExpireHours(env))) {
    return json({ error: "此付款連結已失效，請洽店家重新開立" }, 410);
  }
  order = await expireIfNeeded(env.DB, order);
  if (order.status === "expired") return json({ error: "此連結已過期" }, 400);
  if (order.status === "paid" || order.status === "cancelled") return json({ error: "此訂單無法選擇付款方式" }, 400);
  if (order.payment_method) return json({ error: "已選擇過付款方式，無法變更" }, 400);
  if (method === "store_barcode" && order.amount > CVS_LIMIT) {
    return json({ error: `金額超過 $${CVS_LIMIT.toLocaleString()}，無法使用超商條碼，請分筆訂單` }, 400);
  }

  let newStatus = "awaiting_barcode";
  let bankFields = {
    bank_name: order.bank_name,
    bank_account_number: order.bank_account_number,
    bank_account_holder: order.bank_account_holder,
  };
  if (method === "transfer") {
    newStatus = "awaiting_payment";
    const settings = await getSettingsObj(env);
    bankFields = {
      bank_name: settings.bank_name || null,
      bank_account_number: settings.bank_account_number || null,
      bank_account_holder: settings.bank_account_holder || null,
    };
  }

  await env.DB.prepare(
    `UPDATE orders SET payment_method=?, status=?, method_selected_at=?,
      bank_name=?, bank_account_number=?, bank_account_holder=?, store_brand=? WHERE token=? AND payment_method IS NULL`
  )
    .bind(method, newStatus, nowIso(), bankFields.bank_name, bankFields.bank_account_number, bankFields.bank_account_holder, store, token)
    .run();

  const updated = await env.DB.prepare("SELECT * FROM orders WHERE token=?").bind(token).first();
  return json(publicOrderView(updated));
}

async function handleUploadProof(token, request, env) {
  const body = await request.json().catch(() => ({}));
  const { last_digits } = body;
  const image_base64 = normalizeImageDataUrl(body.image_base64);
  const hasImage = image_base64 && String(image_base64).startsWith("data:image");
  const digits = last_digits && last_digits.trim() ? last_digits.trim().slice(0, 20) : null;
  if (!hasImage && !digits) return json({ error: "請上傳截圖或填寫帳號末幾碼" }, 400);

  let order = await env.DB.prepare("SELECT * FROM orders WHERE token=?").bind(token).first();
  if (!order) return json({ error: "找不到此訂單" }, 404);
  if (isLinkHardExpired(order, linkHardExpireHours(env))) {
    return json({ error: "此付款連結已失效，請洽店家重新開立" }, 410);
  }
  order = await expireIfNeeded(env.DB, order);
  if (order.status === "expired") return json({ error: "此連結已過期" }, 400);
  if (order.status === "cancelled") return json({ error: "此訂單已取消" }, 400);
  if (!PROOF_ELIGIBLE_METHODS.has(order.payment_method)) {
    return json({ error: "此付款方式不需要上傳付款證明" }, 400);
  }

  await env.DB.prepare(
    `UPDATE orders SET
      proof_image = COALESCE(?, proof_image),
      proof_last_digits = COALESCE(?, proof_last_digits),
      proof_uploaded_at = ?
     WHERE token=?`
  )
    .bind(hasImage ? image_base64 : null, digits, nowIso(), token)
    .run();

  const updated = await env.DB.prepare("SELECT * FROM orders WHERE token=?").bind(token).first();
  return json(publicOrderView(updated));
}

// ---- Member self-service ----

async function handleMemberLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const { account, password } = body;
  if (!account || !password) return json({ error: "請輸入帳號與密碼" }, 400);
  const member = await env.DB.prepare("SELECT * FROM members WHERE account=?").bind(account.trim()).first();
  if (!member || !member.password_hash) {
    return json({ error: "帳號或密碼錯誤，或此帳號尚未開通登入功能，請洽店家" }, 401);
  }
  const valid = await verifyPassword(password, member.password_hash);
  if (!valid) return json({ error: "帳號或密碼錯誤" }, 401);
  const ttlHours = parseInt(env.SESSION_TTL_HOURS || "12", 10);
  const session = await signSession(
    { memberId: member.id, account: member.account, exp: Date.now() + ttlHours * 3600 * 1000 },
    env.ADMIN_SESSION_SECRET
  );
  return json({ ok: true }, 200, { "Set-Cookie": setCookieHeader("member_session", session, ttlHours * 3600) });
}

async function handleMemberLogout() {
  return json({ ok: true }, 200, { "Set-Cookie": clearCookieHeader("member_session") });
}

async function handleMemberMe(session, env) {
  const member = await env.DB.prepare("SELECT id, name, account, phone, email, email_verified_at, created_at, referral_code, tiktok_id FROM members WHERE id=?").bind(session.memberId).first();
  if (!member) return json({ error: "會員不存在，請重新登入" }, 401, { "Set-Cookie": clearCookieHeader("member_session") });
  if (!member.referral_code) member.referral_code = await ensureMemberReferralCode(env, member);
  member.email_verify = emailVerifyEnabled(env);
  return json(member);
}

const EMAIL_TAKEN_MSG = "此信箱已註冊過會員，請直接登入；如需協助請聯絡店家";
async function emailAlreadyRegistered(env, emailLower) {
  const row = await env.DB.prepare("SELECT id FROM members WHERE LOWER(email)=? LIMIT 1").bind(emailLower).first();
  return !!row;
}

// ---- 信箱驗證碼：寄送 ----
const EMAIL_CODE_TTL_MIN = 10;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const EMAIL_RESEND_COOLDOWN_SEC = 60;

// 寄出信箱驗證碼（含同信箱 / 同 IP 的寄送頻率限制），註冊與會員修改信箱共用。
async function issueEmailCode(request, env, emailClean, { subject, intro }) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  await env.DB.prepare("DELETE FROM email_send_log WHERE created_at < datetime('now','-1 day')").run();
  const byEmail = await env.DB.prepare(
    `SELECT COUNT(*) AS c, MIN(CAST((julianday('now') - julianday(created_at)) * 86400 AS INTEGER)) AS since
     FROM email_send_log WHERE email=? AND created_at > datetime('now','-1 hour')`
  ).bind(emailClean).first();
  if (byEmail.c > 0 && byEmail.since < EMAIL_RESEND_COOLDOWN_SEC) {
    return json({ error: `請稍候 ${EMAIL_RESEND_COOLDOWN_SEC - byEmail.since} 秒後再重新寄送` }, 429);
  }
  if (byEmail.c >= 5) return json({ error: "這個信箱寄送次數過多，請 1 小時後再試" }, 429);
  const byIp = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM email_send_log WHERE ip=? AND created_at > datetime('now','-1 hour')"
  ).bind(ip).first();
  if (byIp.c >= 10) return json({ error: "寄送次數過多，請稍後再試" }, 429);

  const plain = generateNumericCode(6);
  const hash = await hashEmailCode(env, emailClean, plain);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO email_codes (email, code_hash, expires_at, attempts)
     VALUES (?, ?, datetime('now','+${EMAIL_CODE_TTL_MIN} minutes'), 0)`
  ).bind(emailClean, hash).run();

  try {
    await sendEmail(env, {
      to: emailClean,
      subject,
      text: `你的驗證碼是 ${plain}，${EMAIL_CODE_TTL_MIN} 分鐘內有效。如果不是你本人操作，請忽略這封信。`,
      html: `<div style="font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;max-width:420px;margin:auto;padding:20px;">
        <p>${intro}</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0;">${plain}</p>
        <p style="color:#767B8C;font-size:13px;">${EMAIL_CODE_TTL_MIN} 分鐘內有效。如果不是你本人操作，請忽略這封信。</p></div>`,
    });
  } catch (err) {
    await env.DB.prepare("DELETE FROM email_codes WHERE email=?").bind(emailClean).run();
    console.error("send email code failed:", String(err.message || err));
    if (String(err.message) === "EMAIL_NOT_CONFIGURED") {
      return json({ error: "寄信服務尚未設定完成，請聯絡店家" }, 500);
    }
    return json({ error: "驗證信寄送失敗，請稍後再試或聯絡店家" }, 502);
  }
  await env.DB.prepare("INSERT INTO email_send_log (email, ip) VALUES (?, ?)").bind(emailClean, ip).run();
  return json({ ok: true, cooldown: EMAIL_RESEND_COOLDOWN_SEC });
}

async function handleSendEmailCode(request, env) {
  if (!emailVerifyEnabled(env)) return json({ error: "目前未啟用信箱驗證" }, 400);
  const body = await request.json().catch(() => ({}));
  const emailClean = String(body.email || "").trim().toLowerCase();
  if (!emailClean || !EMAIL_RE.test(emailClean)) return json({ error: "請輸入正確的電子信箱格式" }, 400);
  if (!isAllowedEmailDomain(emailClean)) {
    return json({ error: "目前僅接受常見信箱（Gmail、Outlook、Hotmail、Yahoo、iCloud 等）" }, 400);
  }
  // 要先填對推薦碼才能寄信，避免有人拿這個端點亂寄信給別人
  const code = String(body.referral_code || "").trim().toUpperCase();
  if (!code) return json({ error: "請先填寫推薦碼" }, 400);
  const referrer = await env.DB.prepare("SELECT id FROM members WHERE UPPER(referral_code)=?").bind(code).first();
  if (!referrer) return json({ error: "推薦碼不正確，請確認後再試" }, 400);
  if (await emailAlreadyRegistered(env, emailClean)) return json({ error: EMAIL_TAKEN_MSG }, 400);

  return issueEmailCode(request, env, emailClean, {
    subject: "【會員註冊】信箱驗證碼",
    intro: "你好，你正在註冊會員，驗證碼如下：",
  });
}

// 隱藏連結自行註冊：一定要填對某位會員的推薦碼才能建立帳號
async function handleMemberRegister(request, env) {
  const body = await request.json().catch(() => ({}));
  const { name, account, password, phone, email, referral_code } = body;
  if (!name || !name.trim()) return json({ error: "請輸入姓名" }, 400);
  if (!account || !account.trim()) return json({ error: "請輸入帳號" }, 400);
  if (!password || password.length < 6) return json({ error: "密碼至少需要 6 碼" }, 400);
  if (!referral_code || !referral_code.trim()) return json({ error: "請輸入推薦碼" }, 400);
  // 只接受台灣手機：09 開頭共 10 碼（+886 / 886 開頭會自動換成 0）
  const phoneClean = String(phone || "").replace(/[\s-]/g, "").replace(/^(\+886|886)/, "0");
  if (!phoneClean) return json({ error: "請輸入手機號碼" }, 400);
  if (!/^09[0-9]{8}$/.test(phoneClean)) return json({ error: "請輸入正確的台灣手機號碼（09 開頭共 10 碼）" }, 400);

  // 自助註冊：電子信箱必填
  const emailClean = String(email || "").trim().toLowerCase();
  if (!emailClean) return json({ error: "請輸入電子信箱" }, 400);
  if (!EMAIL_RE.test(emailClean)) return json({ error: "請輸入正確的電子信箱格式" }, 400);
  if (!isAllowedEmailDomain(emailClean)) {
    return json({ error: "目前僅接受常見信箱（Gmail、Outlook、Hotmail、Yahoo、iCloud 等），請改用這類信箱註冊" }, 400);
  }

  const code = referral_code.trim().toUpperCase();
  const referrer = await env.DB.prepare("SELECT id, name FROM members WHERE UPPER(referral_code)=?").bind(code).first();
  if (!referrer) return json({ error: "推薦碼不正確，請確認後再試" }, 400);

  // 一個信箱只能註冊一次（不分大小寫）
  if (await emailAlreadyRegistered(env, emailClean)) return json({ error: EMAIL_TAKEN_MSG }, 400);

  // 信箱驗證碼（EMAIL_VERIFY_ENABLED 預設開啟）
  let emailVerifiedAt = null;
  if (emailVerifyEnabled(env)) {
    const emailCode = String(body.email_code || "").trim();
    if (!/^[0-9]{6}$/.test(emailCode)) return json({ error: "請輸入 6 位數的信箱驗證碼" }, 400);
    const row = await env.DB.prepare(
      "SELECT code_hash, attempts, CASE WHEN expires_at < datetime('now') THEN 1 ELSE 0 END AS expired FROM email_codes WHERE email=?"
    ).bind(emailClean).first();
    if (!row) return json({ error: "請先按「寄送驗證碼」取得驗證碼" }, 400);
    if (row.expired || row.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
      await env.DB.prepare("DELETE FROM email_codes WHERE email=?").bind(emailClean).run();
      return json({ error: row.expired ? "驗證碼已過期，請重新寄送" : "錯誤次數過多，請重新寄送驗證碼" }, 400);
    }
    const ok = (await hashEmailCode(env, emailClean, emailCode)) === row.code_hash;
    if (!ok) {
      await env.DB.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE email=?").bind(emailClean).run();
      const left = EMAIL_CODE_MAX_ATTEMPTS - row.attempts - 1;
      return json({ error: left > 0 ? `驗證碼不正確（還可以再試 ${left} 次）` : "驗證碼錯誤次數過多，請重新寄送驗證碼" }, 400);
    }
    emailVerifiedAt = nowIso();
  }

  const passwordHash = await hashPassword(password);
  for (let attempt = 0; attempt < 5; attempt++) {
    const myCode = generateReferralCode();
    try {
      const r = await env.DB.prepare(
        "INSERT INTO members (name, account, password_hash, phone, email, email_verified_at, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(name.trim(), account.trim(), passwordHash, phoneClean, emailClean, emailVerifiedAt, myCode, referrer.id)
        .run();

      if (emailVerifiedAt) await env.DB.prepare("DELETE FROM email_codes WHERE email=?").bind(emailClean).run();

      const ttlHours = parseInt(env.SESSION_TTL_HOURS || "12", 10);
      const session = await signSession(
        { memberId: r.meta.last_row_id, account: account.trim(), exp: Date.now() + ttlHours * 3600 * 1000 },
        env.ADMIN_SESSION_SECRET
      );
      return json(
        { ok: true, referred_by: referrer.name },
        200,
        { "Set-Cookie": setCookieHeader("member_session", session, ttlHours * 3600) }
      );
    } catch (err) {
      const msg = String(err.message || "");
      if (msg.includes("members.account")) return json({ error: "此帳號已被使用，請換一個" }, 400);
      if (msg.includes("referral_code")) continue; // 推薦碼恰好撞號，重新產生再試
      if (msg.includes("UNIQUE")) return json({ error: "此帳號已被使用，請換一個" }, 400);
      throw err;
    }
  }
  return json({ error: "註冊失敗，請再試一次" }, 500);
}

// ---- 會員自行修改個人資料（手機、信箱；信箱要驗證）----
function normalizePhone(raw) {
  return String(raw || "").replace(/[\s-]/g, "").replace(/^(\+886|886)/, "0");
}

async function handleMemberProfileSendCode(session, request, env) {
  if (!emailVerifyEnabled(env)) return json({ error: "目前未啟用信箱驗證" }, 400);
  const body = await request.json().catch(() => ({}));
  const emailClean = String(body.email || "").trim().toLowerCase();
  if (!emailClean || !EMAIL_RE.test(emailClean)) return json({ error: "請輸入正確的電子信箱格式" }, 400);
  if (!isAllowedEmailDomain(emailClean)) {
    return json({ error: "目前僅接受常見信箱（Gmail、Outlook、Hotmail、Yahoo、iCloud 等）" }, 400);
  }
  const me = await env.DB.prepare("SELECT email FROM members WHERE id=?").bind(session.memberId).first();
  if (!me) return json({ error: "會員不存在，請重新登入" }, 401);
  if (me.email && me.email.toLowerCase() === emailClean) return json({ error: "這已經是你目前使用的信箱" }, 400);
  const taken = await env.DB.prepare("SELECT id FROM members WHERE LOWER(email)=? AND id<>? LIMIT 1").bind(emailClean, session.memberId).first();
  if (taken) return json({ error: EMAIL_TAKEN_MSG }, 400);
  return issueEmailCode(request, env, emailClean, {
    subject: "【會員資料】更改信箱驗證碼",
    intro: "你好，你正在更改會員的電子信箱，驗證碼如下：",
  });
}

async function handleMemberUpdateProfile(session, request, env) {
  const body = await request.json().catch(() => ({}));
  const me = await env.DB.prepare("SELECT id, phone, email FROM members WHERE id=?").bind(session.memberId).first();
  if (!me) return json({ error: "會員不存在，請重新登入" }, 401);

  const sets = [];
  const binds = [];
  let consumeCodeFor = null;

  // 手機
  if (body.phone !== undefined) {
    const phoneClean = normalizePhone(body.phone);
    if (!phoneClean) return json({ error: "請輸入手機號碼" }, 400);
    if (!/^09[0-9]{8}$/.test(phoneClean)) return json({ error: "請輸入正確的台灣手機號碼（09 開頭共 10 碼）" }, 400);
    if (phoneClean !== (me.phone || "")) {
      sets.push("phone=?");
      binds.push(phoneClean);
    }
  }

  // 信箱：和目前不同才處理；啟用驗證時一定要有正確的驗證碼
  if (body.email !== undefined) {
    const emailClean = String(body.email || "").trim().toLowerCase();
    if (!emailClean) return json({ error: "請輸入電子信箱" }, 400);
    if (!EMAIL_RE.test(emailClean)) return json({ error: "請輸入正確的電子信箱格式" }, 400);
    if (emailClean !== String(me.email || "").toLowerCase()) {
      if (!isAllowedEmailDomain(emailClean)) {
        return json({ error: "目前僅接受常見信箱（Gmail、Outlook、Hotmail、Yahoo、iCloud 等）" }, 400);
      }
      const taken = await env.DB.prepare("SELECT id FROM members WHERE LOWER(email)=? AND id<>? LIMIT 1").bind(emailClean, me.id).first();
      if (taken) return json({ error: EMAIL_TAKEN_MSG }, 400);

      let verifiedAt = null;
      if (emailVerifyEnabled(env)) {
        const emailCode = String(body.email_code || "").trim();
        if (!/^[0-9]{6}$/.test(emailCode)) return json({ error: "請輸入 6 位數的信箱驗證碼" }, 400);
        const row = await env.DB.prepare(
          "SELECT code_hash, attempts, CASE WHEN expires_at < datetime('now') THEN 1 ELSE 0 END AS expired FROM email_codes WHERE email=?"
        ).bind(emailClean).first();
        if (!row) return json({ error: "請先按「寄送驗證碼」取得驗證碼" }, 400);
        if (row.expired || row.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
          await env.DB.prepare("DELETE FROM email_codes WHERE email=?").bind(emailClean).run();
          return json({ error: row.expired ? "驗證碼已過期，請重新寄送" : "錯誤次數過多，請重新寄送驗證碼" }, 400);
        }
        const ok = (await hashEmailCode(env, emailClean, emailCode)) === row.code_hash;
        if (!ok) {
          await env.DB.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE email=?").bind(emailClean).run();
          const left = EMAIL_CODE_MAX_ATTEMPTS - row.attempts - 1;
          return json({ error: left > 0 ? `驗證碼不正確（還可以再試 ${left} 次）` : "驗證碼錯誤次數過多，請重新寄送驗證碼" }, 400);
        }
        verifiedAt = nowIso();
        consumeCodeFor = emailClean;
      }
      sets.push("email=?", "email_verified_at=?");
      binds.push(emailClean, verifiedAt);
    }
  }

  if (!sets.length) return json({ error: "沒有任何變更" }, 400);
  binds.push(me.id);
  try {
    await env.DB.prepare(`UPDATE members SET ${sets.join(", ")} WHERE id=?`).bind(...binds).run();
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) return json({ error: EMAIL_TAKEN_MSG }, 400);
    throw err;
  }
  if (consumeCodeFor) await env.DB.prepare("DELETE FROM email_codes WHERE email=?").bind(consumeCodeFor).run();

  const fresh = await env.DB.prepare("SELECT phone, email, email_verified_at FROM members WHERE id=?").bind(me.id).first();
  return json({ ok: true, ...fresh });
}

// 會員自己綁定 TikTok 帳號（直播留言「A201+1」會依這個帳號自動歸戶）。
// 只能綁一次：綁定後鎖定，要更換請店家到後台「會員管理」處理（TikTok 沒有帳號歸屬驗證，鎖定可避免亂綁／搶單）。
async function handleMemberBindTiktok(session, request, env) {
  const body = await request.json().catch(() => ({}));
  const raw = body.tiktok_id && String(body.tiktok_id).trim() ? String(body.tiktok_id).trim() : "";
  if (!raw) return json({ error: "請輸入 TikTok 帳號" }, 400);
  const tiktok = normalizeTiktokId(raw);
  if (!tiktok) return json({ error: "TikTok 帳號格式不正確（只能英文、數字、底線、句點）" }, 400);

  const me = await env.DB.prepare("SELECT id, tiktok_id FROM members WHERE id=?").bind(session.memberId).first();
  if (!me) return json({ error: "會員不存在，請重新登入" }, 401);
  if (me.tiktok_id) {
    if (me.tiktok_id === tiktok) return json({ ok: true, tiktok_id: tiktok, matched: 0 });
    return json({ error: "你已綁定 @" + me.tiktok_id + "，如需更換請聯絡店家" }, 400);
  }
  const taken = await env.DB.prepare("SELECT id FROM members WHERE tiktok_id=? AND id<>?").bind(tiktok, me.id).first();
  if (taken) return json({ error: "此 TikTok 帳號已被其他會員綁定，如有疑問請聯絡店家" }, 400);

  let changed;
  try {
    // tiktok_id IS NULL 條件確保「只能綁一次」，同時避免兩個請求同時綁定
    changed = await env.DB.prepare("UPDATE members SET tiktok_id=? WHERE id=? AND tiktok_id IS NULL").bind(tiktok, me.id).run();
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) return json({ error: "此 TikTok 帳號已被其他會員綁定，如有疑問請聯絡店家" }, 400);
    throw err;
  }
  if (!changed.meta || !changed.meta.changes) return json({ error: "你已綁定 TikTok 帳號，如需更換請聯絡店家" }, 400);

  // 進行中（尚未結標）的場次裡，這個帳號先前「未綁定」的留言，自動歸戶（等同後台的「重新比對會員」）
  let matched = 0;
  try {
    const r = await env.DB.prepare(
      "UPDATE live_comments SET status='ok', member_id=? WHERE tiktok_id=? AND status='unbound' AND round_id IN (SELECT id FROM live_rounds WHERE status='open')"
    ).bind(me.id, tiktok).run();
    matched = (r.meta && r.meta.changes) || 0;
  } catch (e) { /* 歸戶失敗不影響綁定；店家可在後台按「重新比對會員」 */ }
  return json({ ok: true, tiktok_id: tiktok, matched });
}

async function handleMemberOrders(session, request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  let query =
    "SELECT id, token, amount, platform, payment_method, status, is_completed, created_at, paid_at, expires_at, original_amount, coupon_code, coupon_discount, coins, points_used, points_discount FROM orders WHERE member_id=?";
  const binds = [session.memberId];
  if (month) {
    query += " AND strftime('%Y-%m', created_at) = ?";
    binds.push(month);
  }
  query += " ORDER BY created_at DESC LIMIT 200";
  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json(results.map((o) => ({ ...o, order_no: formatOrderNo(o.id) })));
}

async function handleMemberCreateOrder(session, request, env) {
  const body = await request.json().catch(() => ({}));
  const amt = parseFloat(body.amount);
  if (!amt || amt <= 0) return json({ error: "金額不正確" }, 400);
  if (amt < MIN_ORDER_AMOUNT) return json({ error: `訂單金額不可低於 ${MIN_ORDER_AMOUNT} 元` }, 400);
  const platform = body.platform;
  if (!platform || !PLATFORMS.has(platform)) return json({ error: "請選擇要儲值的平台" }, 400);
  const platformAccount = typeof body.platform_account === "string" ? body.platform_account.trim() : "";
  const platformPassword = typeof body.platform_password === "string" ? body.platform_password : "";
  if (!platformAccount) return json({ error: "請輸入帳號/ID" }, 400);
  if (!platformPassword && PLATFORMS_REQUIRE_PASSWORD.has(platform)) return json({ error: "請輸入密碼" }, 400);

  const member = await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(session.memberId).first();
  if (!member) return json({ error: "會員不存在，請重新登入" }, 404);

  let finalAmount = amt;
  let couponResult = null;
  if (body.coupon_code && body.coupon_code.trim()) {
    couponResult = await applyCouponToAmount(env, body.coupon_code, amt);
    if (!couponResult.ok) return json({ error: couponResult.error }, 400);
    finalAmount = couponResult.finalAmount;
  }

  // 點數折抵：一律以伺服器端的餘額與設定驗證，不採信前端算的數字
  let pointsUsed = 0;
  let pointsDiscount = 0;
  const reqPoints = Math.floor(Number(body.use_points) || 0);
  if (reqPoints > 0) {
    const pcfg = await getPointsConfig(env);
    if (!pcfg.discountEnabled) return json({ error: "目前未開放點數折抵" }, 400);
    const balance = await getBalance(env, member.id);
    if (reqPoints > balance) return json({ error: `點數不足（目前餘額 ${balance} 點）` }, 400);
    const maxPoints = Math.floor((finalAmount * pcfg.maxPercent) / 100 / pcfg.redeemValue);
    if (reqPoints > maxPoints) return json({ error: `此訂單最多可使用 ${maxPoints} 點（折抵上限 ${pcfg.maxPercent}%）` }, 400);
    pointsUsed = reqPoints;
    pointsDiscount = reqPoints * pcfg.redeemValue;
    finalAmount = finalAmount - pointsDiscount;
  }
  const hasDiscount = !!couponResult || pointsUsed > 0;

  // 訂單完成通知信：顧客可勾選，並可改填「這筆訂單專用」的信箱（沒填就用會員資料中的信箱）。
  // 在建立訂單「之前」先驗證完，格式不對就直接擋下，避免訂單建立後才報錯。
  const notifyEmail = body.notify_email === true;
  let notifyAddr = null; // NULL = 用會員資料中的信箱
  if (notifyEmail) {
    const typed = typeof body.notify_email_addr === "string" ? body.notify_email_addr.trim().toLowerCase() : "";
    const profile = member.email ? String(member.email).trim().toLowerCase() : "";
    if (!typed && !profile) return json({ error: "請填寫要接收通知的電子信箱" }, 400);
    if (typed && typed !== profile) {
      if (!EMAIL_RE.test(typed)) return json({ error: "通知信箱格式不正確" }, 400);
      if (!isAllowedEmailDomain(typed)) return json({ error: "目前僅接受常見信箱（Gmail、Outlook、Hotmail、Yahoo、iCloud 等）" }, 400);
      notifyAddr = typed;
    }
  }

  // 預計獲得幣數：以優惠碼折抵前的金額（amt）+ 下單當下的費率試算。
  // TikTok 用自己的一組費率，快手/小紅書/陸抖 共用另一組。
  // 一律由伺服器端計算，不採信前端送來的數字，避免被竄改。
  const rateRules = await getRateRules(env, getRateGroupForPlatform(platform));
  const coinsResult = calcCoins(rateRules, amt);
  const coins = coinsResult ? coinsResult.coins : null;

  const token = randomToken(24);
  const ttlHours = parseInt(env.LINK_TTL_HOURS || "3", 10);
  const expiresAt = addHours(new Date(), ttlHours).toISOString().replace("T", " ").slice(0, 19);

  const inserted = await env.DB.prepare(
    `INSERT INTO orders (token, amount, member_id, member_name_snapshot, status, expires_at,
      original_amount, coupon_code, coupon_discount, platform, platform_account, platform_password, coins,
      points_used, points_discount)
     VALUES (?, ?, ?, ?, 'pending_method', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      token,
      finalAmount,
      member.id,
      member.name,
      expiresAt,
      hasDiscount ? amt : null,
      couponResult ? couponResult.coupon.code : null,
      couponResult ? couponResult.discount : null,
      platform,
      platformAccount,
      platformPassword,
      coins,
      pointsUsed,
      pointsUsed > 0 ? pointsDiscount : null
    )
    .run();

  // 先下單、再原子性扣點；若這一瞬間餘額被別的請求用掉了，就撤銷這筆訂單
  if (pointsUsed > 0) {
    const okSpend = await spendAtomic(env, {
      memberId: member.id,
      points: pointsUsed,
      type: "spend",
      orderId: inserted.meta.last_row_id,
      note: `訂單 ${formatOrderNo(inserted.meta.last_row_id)} 折抵`,
    });
    if (!okSpend) {
      await env.DB.prepare("DELETE FROM orders WHERE id=?").bind(inserted.meta.last_row_id).run();
      return json({ error: "點數不足，請重新整理後再試" }, 400);
    }
  }

  if (couponResult) await incrementCouponUsage(env, couponResult.coupon.id);

  // 顧客勾選「訂單完成寄信通知我」：需要有信箱才記錄（沒有信箱就忽略，避免之後完成時寄不出去）
  if (notifyEmail) {
    await env.DB.prepare("UPDATE orders SET notify_email=1, notify_email_addr=? WHERE id=?").bind(notifyAddr, inserted.meta.last_row_id).run();
  }

  await notifyAdminsOfNewOrder(env, { id: inserted.meta.last_row_id, member_name_snapshot: member.name, amount: finalAmount });

  const url = new URL(request.url);
  const link = `${url.origin}/pay/${token}`;
  return json({
    ok: true,
    token,
    link,
    expires_at: expiresAt,
    amount: finalAmount,
    discount: couponResult ? couponResult.discount : 0,
    points_used: pointsUsed,
    points_discount: pointsUsed > 0 ? pointsDiscount : 0,
    coins,
    order_no: formatOrderNo(inserted.meta.last_row_id),
  });
}

// ---- 點數系統 ----

// 會員：查看自己的點數（餘額、明細、可兌換商品、兌換紀錄、規則）
async function handleMemberPoints(session, env) {
  const cfg = await getPointsConfig(env);
  await reconcileMemberSpends(env, session.memberId);
  const balance = await getBalance(env, session.memberId);
  const ledger = await env.DB.prepare(
    "SELECT id, delta, type, order_id, note, created_at FROM points_ledger WHERE member_id=? ORDER BY id DESC LIMIT 100"
  )
    .bind(session.memberId)
    .all();
  const items = await env.DB.prepare(
    "SELECT id, name, description, cost, stock FROM points_items WHERE is_active=1 AND (stock IS NULL OR stock>0) ORDER BY cost ASC, id ASC"
  ).all();
  const redemptions = await env.DB.prepare(
    "SELECT id, item_name, cost, status, member_note, admin_note, created_at, processed_at FROM points_redemptions WHERE member_id=? ORDER BY id DESC LIMIT 50"
  )
    .bind(session.memberId)
    .all();
  return json({
    earn_enabled: cfg.earnEnabled,
    discount_enabled: cfg.discountEnabled,
    shop_enabled: cfg.shopEnabled,
    balance,
    config: { earn_per: cfg.earnPer, redeem_value: cfg.redeemValue, max_percent: cfg.maxPercent },
    ledger: ledger.results,
    items: items.results,
    redemptions: redemptions.results,
  });
}

// 會員：用點數兌換商城商品
async function handleMemberRedeem(session, request, env) {
  const cfg = await getPointsConfig(env);
  if (!cfg.shopEnabled) return json({ error: "目前未開放點數兌換" }, 400);
  const body = await request.json().catch(() => ({}));
  const itemId = parseInt(body.item_id, 10);
  if (!itemId) return json({ error: "請選擇要兌換的商品" }, 400);
  const memberNote = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";

  const item = await env.DB.prepare("SELECT * FROM points_items WHERE id=?").bind(itemId).first();
  if (!item || !item.is_active) return json({ error: "此商品已下架" }, 400);

  // 1) 先扣庫存（有庫存限制時，條件式更新避免超賣）
  const stockRes = await env.DB.prepare(
    "UPDATE points_items SET stock = CASE WHEN stock IS NULL THEN NULL ELSE stock-1 END WHERE id=? AND is_active=1 AND (stock IS NULL OR stock>0)"
  )
    .bind(itemId)
    .run();
  if (stockRes.meta.changes === 0) return json({ error: "此商品已兌換完畢" }, 400);

  const restock = async () => {
    await env.DB.prepare("UPDATE points_items SET stock = CASE WHEN stock IS NULL THEN NULL ELSE stock+1 END WHERE id=?").bind(itemId).run();
  };

  // 2) 建立兌換單、原子性扣點
  const ins = await env.DB.prepare(
    "INSERT INTO points_redemptions (member_id, item_id, item_name, cost, status, member_note) VALUES (?, ?, ?, ?, 'pending', ?)"
  )
    .bind(session.memberId, item.id, item.name, item.cost, memberNote || null)
    .run();
  const redemptionId = ins.meta.last_row_id;
  const okSpend = await spendAtomic(env, {
    memberId: session.memberId,
    points: item.cost,
    type: "redeem",
    refId: redemptionId,
    note: `兌換「${item.name}」`,
  });
  if (!okSpend) {
    await env.DB.prepare("DELETE FROM points_redemptions WHERE id=?").bind(redemptionId).run();
    await restock();
    const balance = await getBalance(env, session.memberId);
    return json({ error: `點數不足（需要 ${item.cost} 點，目前 ${balance} 點）` }, 400);
  }
  return json({ ok: true, balance: await getBalance(env, session.memberId) });
}

// 後台：點數設定
async function handleGetPointsConfigAdmin(env) {
  const cfg = await getPointsConfig(env);
  return json({
    earn_enabled: cfg.earnEnabled,
    discount_enabled: cfg.discountEnabled,
    shop_enabled: cfg.shopEnabled,
    earn_per: cfg.earnPer,
    redeem_value: cfg.redeemValue,
    max_percent: cfg.maxPercent,
  });
}

async function handleSavePointsConfigAdmin(request, env) {
  const body = await request.json().catch(() => ({}));
  const r = await savePointsConfig(env, body);
  if (!r.ok) return json({ error: r.error }, 400);
  return json({ ok: true });
}

// 後台：所有會員的點數餘額
async function handleAdminPointsMembers(env) {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.name, m.account, m.phone, m.email,
            COALESCE((SELECT SUM(delta) FROM points_ledger WHERE member_id=m.id), 0) AS balance,
            COALESCE((SELECT SUM(delta) FROM points_ledger WHERE member_id=m.id AND delta>0), 0) AS earned_total
     FROM members m ORDER BY balance DESC, m.id ASC`
  ).all();
  return json(results);
}

async function handleAdminPointsLedger(request, env) {
  const memberId = parseInt(new URL(request.url).searchParams.get("member_id"), 10);
  if (!memberId) return json({ error: "缺少會員" }, 400);
  const { results } = await env.DB.prepare(
    "SELECT id, delta, type, order_id, note, created_at FROM points_ledger WHERE member_id=? ORDER BY id DESC LIMIT 200"
  )
    .bind(memberId)
    .all();
  return json(results);
}

// 後台：手動加減點
async function handleAdminPointsAdjust(request, env) {
  const body = await request.json().catch(() => ({}));
  const memberId = parseInt(body.member_id, 10);
  const delta = Math.trunc(Number(body.delta));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";
  if (!memberId) return json({ error: "請選擇會員" }, 400);
  if (!delta) return json({ error: "請輸入要加或扣的點數（不可為 0）" }, 400);
  if (Math.abs(delta) > 1000000) return json({ error: "單次調整點數過大" }, 400);
  if (!note) return json({ error: "請填寫調整原因" }, 400);
  const m = await env.DB.prepare("SELECT id FROM members WHERE id=?").bind(memberId).first();
  if (!m) return json({ error: "找不到此會員" }, 404);

  if (delta > 0) {
    await addLedger(env, { memberId, delta, type: "admin", note });
  } else {
    const ok = await spendAtomic(env, { memberId, points: -delta, type: "admin", note });
    if (!ok) return json({ error: "該會員點數不足，無法扣除這麼多" }, 400);
  }
  return json({ ok: true, balance: await getBalance(env, memberId) });
}

// 後台：商城商品
async function handleAdminListPointItems(env) {
  const { results } = await env.DB.prepare("SELECT * FROM points_items ORDER BY is_active DESC, cost ASC, id ASC").all();
  return json(results);
}

function parseItemBody(body, partial = false) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "請輸入商品名稱" };
    out.name = name.slice(0, 100);
  }
  if (!partial || body.description !== undefined) out.description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  if (!partial || body.cost !== undefined) {
    const cost = parseInt(body.cost, 10);
    if (!cost || cost < 1) return { error: "所需點數必須是 1 以上的整數" };
    out.cost = cost;
  }
  if (!partial || body.stock !== undefined) {
    if (body.stock === null || body.stock === "" || body.stock === undefined) out.stock = null;
    else {
      const st = parseInt(body.stock, 10);
      if (isNaN(st) || st < 0) return { error: "庫存必須是 0 以上的整數，不限請留空" };
      out.stock = st;
    }
  }
  if (body.is_active !== undefined) out.is_active = body.is_active ? 1 : 0;
  return out;
}

async function handleAdminCreatePointItem(request, env) {
  const body = await request.json().catch(() => ({}));
  const v = parseItemBody(body);
  if (v.error) return json({ error: v.error }, 400);
  await env.DB.prepare("INSERT INTO points_items (name, description, cost, stock, is_active) VALUES (?, ?, ?, ?, 1)")
    .bind(v.name, v.description, v.cost, v.stock)
    .run();
  return json({ ok: true });
}

async function handleAdminUpdatePointItem(id, request, env) {
  const existing = await env.DB.prepare("SELECT id FROM points_items WHERE id=?").bind(id).first();
  if (!existing) return json({ error: "找不到此商品" }, 404);
  const body = await request.json().catch(() => ({}));
  const v = parseItemBody(body, true);
  if (v.error) return json({ error: v.error }, 400);
  const keys = Object.keys(v);
  if (!keys.length) return json({ error: "沒有要更新的內容" }, 400);
  await env.DB.prepare(`UPDATE points_items SET ${keys.map((k) => k + "=?").join(", ")} WHERE id=?`)
    .bind(...keys.map((k) => v[k]), id)
    .run();
  return json({ ok: true });
}

async function handleAdminDeletePointItem(id, env) {
  await env.DB.prepare("DELETE FROM points_items WHERE id=?").bind(id).run();
  return json({ ok: true });
}

// 後台：兌換單
async function handleAdminListRedemptions(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const { page, size, offset } = parsePage(url, 10);
  let where = "";
  const binds = [];
  if (status && ["pending", "fulfilled", "rejected"].includes(status)) {
    where = " WHERE r.status=?";
    binds.push(status);
  }
  const totalRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM points_redemptions r" + where).bind(...binds).first();
  const total = totalRow ? totalRow.c : 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const { results } = await env.DB.prepare(
    "SELECT r.*, m.name AS member_name, m.account AS member_account, m.phone AS member_phone FROM points_redemptions r LEFT JOIN members m ON m.id=r.member_id" +
      where +
      " ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.id DESC LIMIT ? OFFSET ?"
  )
    .bind(...binds, size, offset)
    .all();
  return json({ rows: results, total, page: Math.min(page, pages), pages, size });
}

async function handleAdminProcessRedemption(id, action, request, env) {
  const body = await request.json().catch(() => ({}));
  const adminNote = typeof body.admin_note === "string" ? body.admin_note.trim().slice(0, 300) : "";
  const newStatus = action === "fulfill" ? "fulfilled" : "rejected";
  const r = await env.DB.prepare("UPDATE points_redemptions SET status=?, admin_note=?, processed_at=? WHERE id=? AND status='pending'")
    .bind(newStatus, adminNote || null, nowIso(), id)
    .run();
  if (r.meta.changes === 0) return json({ error: "找不到此兌換單，或已經處理過了" }, 400);
  if (newStatus === "rejected") {
    const red = await env.DB.prepare("SELECT * FROM points_redemptions WHERE id=?").bind(id).first();
    await addLedger(env, {
      memberId: red.member_id,
      delta: red.cost,
      type: "refund",
      refId: red.id,
      note: `兌換「${red.item_name}」未成立，退回點數${adminNote ? "（" + adminNote + "）" : ""}`,
    });
    if (red.item_id) {
      await env.DB.prepare("UPDATE points_items SET stock = CASE WHEN stock IS NULL THEN NULL ELSE stock+1 END WHERE id=?").bind(red.item_id).run();
    }
  }
  return json({ ok: true });
}

// ---- 後台推播通知 ----

async function handlePushPublicKey(env) {
  const { publicKeyB64 } = await getOrCreateVapidKeys(env);
  return json({ publicKey: publicKeyB64 });
}

async function handlePushSubscribe(session, request, env) {
  const body = await request.json().catch(() => ({}));
  const { endpoint, keys } = body;
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return json({ error: "訂閱資料不正確" }, 400);
  }
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (admin_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET admin_id=excluded.admin_id, p256dh=excluded.p256dh, auth=excluded.auth`
  )
    .bind(session.adminId, endpoint, keys.p256dh, keys.auth)
    .run();
  return json({ ok: true });
}

async function handlePushUnsubscribe(request, env) {
  const body = await request.json().catch(() => ({}));
  const { endpoint } = body;
  if (!endpoint) return json({ error: "缺少 endpoint" }, 400);
  await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").bind(endpoint).run();
  return json({ ok: true });
}

// ================= Pages Functions entrypoint =================

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // ---- 放行 Service Worker 靜態檔案 ----
    if (path === "/sw.js") return next();

    // ---- 動態生成 Favicon (SVG 圖標) ----
    if (path === "/favicon.svg" || path === "/favicon.ico") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3D2314"/>
      <stop offset="100%" stop-color="#1A0D07"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F3A152"/>
      <stop offset="100%" stop-color="#C67C26"/>
    </linearGradient>
    <linearGradient id="steamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <rect x="16" y="16" width="480" height="480" rx="96" fill="none" stroke="#D4A373" stroke-width="4" stroke-opacity="0.3"/>
  <g filter="url(#dropShadow)">
    <g transform="rotate(-12, 230, 260)">
      <rect x="110" y="160" width="260" height="160" rx="16" fill="url(#cardGrad)"/>
      <path d="M 110 210 Q 240 230 370 190" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-opacity="0.4"/>
      <circle cx="330" cy="280" r="14" fill="#FFE5B4" fill-opacity="0.8"/>
      <polygon points="330,270 333,277 340,278 335,283 336,290 330,286 324,290 325,283 320,278 327,277" fill="#C67C26"/>
    </g>
    <g transform="translate(40, 20)">
      <path d="M 180 200 L 200 400 Q 200 416 216 416 L 296 416 Q 312 416 312 400 L 332 200 Z" fill="#FFFDF9"/>
      <path d="M 187 270 L 195 340 L 317 340 L 325 270 Z" fill="#D4A373"/>
      <path d="M 240 292 L 246 308 L 256 296 L 266 308 L 272 292 L 270 318 L 242 318 Z" fill="#3D2314"/>
      <path d="M 170 184 C 170 176, 176 170, 184 170 L 328 170 C 336 170, 342 176, 342 184 L 346 200 L 166 200 Z" fill="#2B170D"/>
      <rect x="236" y="160" width="40" height="12" rx="4" fill="#2B170D"/>
    </g>
    <path d="M 230 140 Q 220 110 240 80 T 230 20" fill="none" stroke="url(#steamGrad)" stroke-width="8" stroke-linecap="round"/>
    <path d="M 280 150 Q 290 120 270 90 T 280 30" fill="none" stroke="url(#steamGrad)" stroke-width="8" stroke-linecap="round"/>
  </g>
</svg>`;

      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    // ---- Public pages ----
    if (path === "/admin" || path === "/admin/") return html(adminHtml());
    if (path.startsWith("/pay/")) return html(payHtml());
    if (path === "/member" || path === "/member/") return html(memberHtml());
    if (path === "/member/register" || path === "/member/register/") return html(memberRegisterHtml({ emailVerify: emailVerifyEnabled(env) }));
    if (path === "/") return html(homeHtml());

    // ---- Public API ----
    if (path === "/api/setup-status" && method === "GET") return handleSetupStatus(env);
    if (path === "/api/setup-admin" && method === "POST") return handleSetupAdmin(request, env);
    if (path === "/api/admin/login" && method === "POST") return handleLogin(request, env);
    if (path === "/api/admin/logout" && method === "POST") return handleLogout();

    if (path === "/api/rates" && method === "GET") return handlePublicRates(env);

    // 優惠碼試算：結帳櫃檯(admin，已登入才看得到畫面)跟會員自助下單(member)都會呼叫到，
    // 這裡只回傳「這個碼折多少錢」，不會洩漏其他優惠碼資訊，所以不需要另外驗證登入身份。
    if (path === "/api/coupons/preview" && method === "POST") return handleCouponPreview(request, env);

    if (path === "/api/member/login" && method === "POST") return handleMemberLogin(request, env);
    if (path === "/api/member/send-email-code" && method === "POST") return handleSendEmailCode(request, env);
    if (path === "/api/member/register" && method === "POST") return handleMemberRegister(request, env);
    if (path === "/api/member/logout" && method === "POST") return handleMemberLogout();

    const orderTokenMatch = path.match(/^\/api\/order\/([a-f0-9]+)$/);
    if (orderTokenMatch && method === "GET") return handleGetOrderPublic(orderTokenMatch[1], env);

    const selectMethodMatch = path.match(/^\/api\/order\/([a-f0-9]+)\/select-method$/);
    if (selectMethodMatch && method === "POST") return handleSelectMethod(selectMethodMatch[1], request, env);

    const proofMatch = path.match(/^\/api\/order\/([a-f0-9]+)\/proof$/);
    if (proofMatch && method === "POST") return handleUploadProof(proofMatch[1], request, env);

    // ---- Member API ----
    if (path.startsWith("/api/member/")) {
      const session = await requireMember(request, env);
      if (!session) return json({ error: "未登入或登入已過期" }, 401);
      if (path === "/api/member/me" && method === "GET") return handleMemberMe(session, env);
      if (path === "/api/member/orders" && method === "GET") return handleMemberOrders(session, request, env);
      if (path === "/api/member/orders" && method === "POST") return handleMemberCreateOrder(session, request, env);
      if (path === "/api/member/announcement" && method === "GET") return handleMemberAnnouncement(env);
      if (path === "/api/member/profile" && method === "POST") return handleMemberUpdateProfile(session, request, env);
      if (path === "/api/member/tiktok" && method === "POST") return handleMemberBindTiktok(session, request, env);
      if (path === "/api/member/profile/send-email-code" && method === "POST") return handleMemberProfileSendCode(session, request, env);
      if (path === "/api/member/points" && method === "GET") return handleMemberPoints(session, env);
      if (path === "/api/member/points/redeem" && method === "POST") return handleMemberRedeem(session, request, env);
      return json({ error: "Not found" }, 404);
    }

    // ---- Admin API ----
    if (path.startsWith("/api/admin/")) {
      const session = await requireAdmin(request, env);
      if (!session) return json({ error: "未登入或登入已過期" }, 401);

      if (path === "/api/admin/me" && method === "GET") return handleMe(session);

      if (path === "/api/admin/staff" && method === "GET") return handleListStaff(env);
      if (path === "/api/admin/staff" && method === "POST") return handleAddStaff(request, env);

      const staffPasswordMatch = path.match(/^\/api\/admin\/staff\/(\d+)\/password$/);
      if (staffPasswordMatch && method === "POST") return handleResetStaffPassword(staffPasswordMatch[1], request, env);

      const staffDeleteMatch = path.match(/^\/api\/admin\/staff\/(\d+)$/);
      if (staffDeleteMatch && method === "DELETE") return handleDeleteStaff(staffDeleteMatch[1], session, env);

      if (path === "/api/admin/members" && method === "GET") return handleListMembers(env);
      if (path === "/api/admin/members" && method === "POST") return handleAddMember(request, env);

      const memberDeleteMatch = path.match(/^\/api\/admin\/members\/(\d+)$/);
      if (memberDeleteMatch && method === "DELETE") return handleDeleteMember(memberDeleteMatch[1], env);

      const memberPasswordMatch = path.match(/^\/api\/admin\/members\/(\d+)\/password$/);
      if (memberPasswordMatch && method === "POST") return handleSetMemberPassword(memberPasswordMatch[1], request, env);

      if (memberDeleteMatch && method === "PATCH") return handleUpdateMember(memberDeleteMatch[1], request, env);

      if (path === "/api/admin/settings" && method === "GET") return handleGetSettings(env);
      if (path === "/api/admin/settings" && method === "POST") return handleSaveSettings(request, env);

      if (path === "/api/admin/announcement" && method === "GET") return handleGetAnnouncement(env);
      if (path === "/api/admin/announcement" && method === "POST") return handleSaveAnnouncement(request, env);

      if (path === "/api/admin/rates" && method === "GET") return handleGetRates(request, env);
      if (path === "/api/admin/rates" && method === "POST") return handleSaveRates(request, env);

      if (path === "/api/admin/coupons" && method === "GET") return handleListCoupons(env);
      if (path === "/api/admin/coupons" && method === "POST") return handleCreateCoupon(request, env);

      const couponMatch = path.match(/^\/api\/admin\/coupons\/(\d+)$/);
      if (couponMatch && method === "PATCH") return handleUpdateCoupon(couponMatch[1], request, env);
      if (couponMatch && method === "DELETE") return handleDeleteCoupon(couponMatch[1], env);

      if (path === "/api/admin/orders" && method === "POST") return handleCreateOrder(request, env);
      if (path === "/api/admin/orders" && method === "GET") return handleListOrders(request, env);

      const barcodeMatch = path.match(/^\/api\/admin\/orders\/(\d+)\/barcode$/);
      if (barcodeMatch && method === "POST") return handleUploadBarcode(barcodeMatch[1], request, env);

      const markPaidMatch = path.match(/^\/api\/admin\/orders\/(\d+)\/mark-paid$/);
      if (markPaidMatch && method === "POST") return handleMarkPaid(markPaidMatch[1], env);

      const cancelMatch = path.match(/^\/api\/admin\/orders\/(\d+)\/cancel$/);
      if (cancelMatch && method === "POST") return handleCancelOrder(cancelMatch[1], env);

      const correctMatch = path.match(/^\/api\/admin\/orders\/(\d+)$/);
      if (correctMatch && method === "PATCH") return handleCorrectOrder(correctMatch[1], request, env);
      if (correctMatch && method === "DELETE") return handleDeleteOrder(correctMatch[1], env);

      const completeMatch = path.match(/^\/api\/admin\/orders\/(\d+)\/complete$/);
      if (completeMatch && method === "POST") return handleCompleteOrder(completeMatch[1], request, env);

      const uncompleteMatch = path.match(/^\/api\/admin\/orders\/(\d+)\/uncomplete$/);
      if (uncompleteMatch && method === "POST") return handleUncompleteOrder(uncompleteMatch[1], env);

      const noteMatch = path.match(/^\/api\/admin\/orders\/(\d+)\/note$/);
      if (noteMatch && method === "PATCH") return handleUpdateOrderNote(noteMatch[1], request, env);

      if (path === "/api/admin/points/config" && method === "GET") return handleGetPointsConfigAdmin(env);
      if (path === "/api/admin/points/config" && method === "POST") return handleSavePointsConfigAdmin(request, env);
      if (path === "/api/admin/points/members" && method === "GET") return handleAdminPointsMembers(env);
      if (path === "/api/admin/points/ledger" && method === "GET") return handleAdminPointsLedger(request, env);
      if (path === "/api/admin/points/adjust" && method === "POST") return handleAdminPointsAdjust(request, env);
      if (path === "/api/admin/points/items" && method === "GET") return handleAdminListPointItems(env);
      if (path === "/api/admin/points/items" && method === "POST") return handleAdminCreatePointItem(request, env);
      const pointItemMatch = path.match(/^\/api\/admin\/points\/items\/(\d+)$/);
      if (pointItemMatch && method === "PATCH") return handleAdminUpdatePointItem(pointItemMatch[1], request, env);
      if (pointItemMatch && method === "DELETE") return handleAdminDeletePointItem(pointItemMatch[1], env);
      if (path === "/api/admin/points/redemptions" && method === "GET") return handleAdminListRedemptions(request, env);
      const redemptionMatch = path.match(/^\/api\/admin\/points\/redemptions\/(\d+)\/(fulfill|reject)$/);
      if (redemptionMatch && method === "POST") return handleAdminProcessRedemption(redemptionMatch[1], redemptionMatch[2], request, env);

      // ---- 直播下單 ----
      if (path === "/api/admin/live/rounds" && method === "GET") return handleLiveListRounds(env);
      if (path === "/api/admin/live/rounds" && method === "POST") return handleLiveCreateRound(request, env);
      const liveRoundMatch = path.match(/^\/api\/admin\/live\/rounds\/(\d+)$/);
      if (liveRoundMatch && method === "GET") return handleLiveGetRound(liveRoundMatch[1], env);
      if (liveRoundMatch && method === "PATCH") return handleLiveUpdateRound(liveRoundMatch[1], request, env);
      if (liveRoundMatch && method === "DELETE") return handleLiveDeleteRound(liveRoundMatch[1], env);
      const liveRoundSub = path.match(/^\/api\/admin\/live\/rounds\/(\d+)\/(items|comments|rematch|create-orders)$/);
      if (liveRoundSub && method === "POST") {
        const rid = liveRoundSub[1];
        if (liveRoundSub[2] === "items") return handleLiveAddItem(rid, request, env);
        if (liveRoundSub[2] === "comments") return handleLiveAddComments(rid, request, env);
        if (liveRoundSub[2] === "rematch") return handleLiveRematch(rid, env);
        if (liveRoundSub[2] === "create-orders") return handleLiveCreateOrders(rid, request, env, handleCreateOrder);
      }
      const liveItemMatch = path.match(/^\/api\/admin\/live\/items\/(\d+)$/);
      if (liveItemMatch && method === "PATCH") return handleLiveUpdateItem(liveItemMatch[1], request, env);
      if (liveItemMatch && method === "DELETE") return handleLiveDeleteItem(liveItemMatch[1], env);
      const liveCommentMatch = path.match(/^\/api\/admin\/live\/comments\/(\d+)$/);
      if (liveCommentMatch && method === "DELETE") return handleLiveDeleteComment(liveCommentMatch[1], env);
      const liveCommentAct = path.match(/^\/api\/admin\/live\/comments\/(\d+)\/(bind|guest|promote)$/);
      if (liveCommentAct && method === "POST") {
        if (liveCommentAct[2] === "bind") return handleLiveBindComment(liveCommentAct[1], request, env);
        if (liveCommentAct[2] === "guest") return handleLiveGuestComment(liveCommentAct[1], env);
        if (liveCommentAct[2] === "promote") return handleLivePromoteComment(liveCommentAct[1], env);
      }

      if (path === "/api/admin/export" && method === "GET") return handleExport(request, env);
      if (path === "/api/admin/stats/monthly" && method === "GET") return handleMonthlyStats(request, env);

      if (path === "/api/admin/push/public-key" && method === "GET") return handlePushPublicKey(env);
      if (path === "/api/admin/push/subscribe" && method === "POST") return handlePushSubscribe(session, request, env);
      if (path === "/api/admin/push/unsubscribe" && method === "POST") return handlePushUnsubscribe(request, env);

      return json({ error: "Not found" }, 404);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: "系統錯誤: " + err.message }, 500);
  }
}
