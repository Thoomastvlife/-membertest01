import { adminHtml, payHtml, memberHtml, memberRegisterHtml } from "./_lib/templates.js";
import { getRateRules, saveRateRules, DEFAULT_RATE_RULES, MIN_QUOTE_AMOUNT, calcCoins } from "./_lib/rates.js";

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

async function handleListMembers(env) {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.name, m.account, m.phone, m.note, m.created_at, m.referral_code,
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
  const { name, phone, note, account, password } = body;
  if (!name || !name.trim()) return json({ error: "請輸入姓名" }, 400);
  if (password && password.length < 6) return json({ error: "密碼至少需要 6 碼" }, 400);

  const passwordHash = password ? await hashPassword(password) : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const referralCode = generateReferralCode();
    try {
      const r = await env.DB.prepare(
        "INSERT INTO members (name, account, password_hash, phone, note, referral_code) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(
          name.trim(),
          account && account.trim() ? account.trim() : null,
          passwordHash,
          phone || null,
          note || null,
          referralCode
        )
        .run();
      return json({ ok: true, id: r.meta.last_row_id, referral_code: referralCode });
    } catch (err) {
      const msg = String(err.message || "");
      if (msg.includes("referral_code")) continue; // 推薦碼恰好撞號，重新產生再試
      if (msg.includes("UNIQUE")) return json({ error: "此帳號已被使用，請換一個" }, 400);
      throw err;
    }
  }
  return json({ error: "建立會員失敗，請再試一次" }, 500);
}

async function handleDeleteMember(id, env) {
  await env.DB.prepare("DELETE FROM members WHERE id=?").bind(id).run();
  return json({ ok: true });
}

async function handleUpdateMember(id, request, env) {
  const existing = await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(id).first();
  if (!existing) return json({ error: "找不到此會員" }, 404);

  const body = await request.json().catch(() => ({}));
  const { name, phone, note, account } = body;
  if (name !== undefined && !String(name).trim()) return json({ error: "姓名不可為空白" }, 400);

  const newName = name !== undefined ? name.trim() : existing.name;
  const newPhone = phone !== undefined ? phone || null : existing.phone;
  const newNote = note !== undefined ? note || null : existing.note;
  const newAccount = account !== undefined ? (account && account.trim() ? account.trim() : null) : existing.account;

  try {
    await env.DB.prepare("UPDATE members SET name=?, phone=?, note=?, account=? WHERE id=?")
      .bind(newName, newPhone, newNote, newAccount, id)
      .run();
    return json({ ok: true });
  } catch (err) {
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
  const rules = await getRateRules(env);
  return json({ rules });
}

async function handleGetRates(env) {
  const rules = await getRateRules(env);
  return json({ rules, isDefault: JSON.stringify(rules) === JSON.stringify(DEFAULT_RATE_RULES) });
}

async function handleSaveRates(request, env) {
  const body = await request.json().catch(() => ({}));
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
  await saveRateRules(env, rules);
  return json({ ok: true });
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

  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return json({ error: "金額不正確" }, 400);
  if (payment_method && !PAYMENT_METHODS.has(payment_method)) return json({ error: "付款方式不正確" }, 400);
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

  // 預計獲得幣數：只有指定了儲值平台才試算（跟自助下單邏輯一致，各平台共用同一套費率）
  let coins = null;
  if (platform) {
    const rateRules = await getRateRules(env);
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

async function handleUploadBarcode(id, request, env) {
  const body = await request.json().catch(() => ({}));
  const { image_base64 } = body;
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
  return json({ ok: true });
}

async function handleCancelOrder(id, env) {
  await env.DB.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(id).run();
  return json({ ok: true });
}

async function handleDeleteOrder(id, env) {
  const order = await env.DB.prepare("SELECT id FROM orders WHERE id=?").bind(id).first();
  if (!order) return json({ error: "找不到訂單" }, 404);
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

  if (body.amount !== undefined && body.amount !== null && String(body.amount).trim() !== "") {
    const amt = parseFloat(body.amount);
    if (!amt || amt <= 0) return json({ error: "金額不正確" }, 400);
    fields.push("amount=?");
    binds.push(amt);
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
  return json({ ok: true });
}

async function handleCompleteOrder(id, env) {
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
  if (!order) return json({ error: "找不到訂單" }, 404);
  if (order.status !== "paid") return json({ error: "只有已完成付款的訂單才能標記為訂單完成" }, 400);
  await env.DB.prepare("UPDATE orders SET is_completed=1, completed_at=? WHERE id=?").bind(nowIso(), id).run();
  return json({ ok: true });
}

async function handleUncompleteOrder(id, env) {
  await env.DB.prepare("UPDATE orders SET is_completed=0, completed_at=NULL WHERE id=?").bind(id).run();
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

  const header = ["訂單編號", "建立時間", "會員/客人", "儲值平台", "儲值帳號", "儲值密碼", "原始金額", "優惠碼", "折抵金額", "實付金額", "預計獲得幣數", "付款方式", "狀態", "訂單完成(結案)", "付款證明末幾碼", "付款方式選擇時間", "完成付款時間", "到期時間"];
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
    o.amount,
    o.coins != null ? o.coins : "",
    PM_LABEL[o.payment_method] || "",
    STATUS_LABEL[o.status] || o.status,
    o.is_completed ? "是" : "否",
    o.proof_last_digits || "",
    toTaipeiTime(o.method_selected_at),
    toTaipeiTime(o.paid_at),
    toTaipeiTime(o.expires_at),
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

  let order = await env.DB.prepare("SELECT * FROM orders WHERE token=?").bind(token).first();
  if (!order) return json({ error: "找不到此訂單" }, 404);
  if (isLinkHardExpired(order, linkHardExpireHours(env))) {
    return json({ error: "此付款連結已失效，請洽店家重新開立" }, 410);
  }
  order = await expireIfNeeded(env.DB, order);
  if (order.status === "expired") return json({ error: "此連結已過期" }, 400);
  if (order.status === "paid" || order.status === "cancelled") return json({ error: "此訂單無法選擇付款方式" }, 400);
  if (order.payment_method) return json({ error: "已選擇過付款方式，無法變更" }, 400);

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
      bank_name=?, bank_account_number=?, bank_account_holder=? WHERE token=?`
  )
    .bind(method, newStatus, nowIso(), bankFields.bank_name, bankFields.bank_account_number, bankFields.bank_account_holder, token)
    .run();

  const updated = await env.DB.prepare("SELECT * FROM orders WHERE token=?").bind(token).first();
  return json(publicOrderView(updated));
}

async function handleUploadProof(token, request, env) {
  const body = await request.json().catch(() => ({}));
  const { image_base64, last_digits } = body;
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
  const member = await env.DB.prepare("SELECT id, name, account, referral_code FROM members WHERE id=?").bind(session.memberId).first();
  if (!member) return json({ error: "會員不存在，請重新登入" }, 404);
  if (!member.referral_code) member.referral_code = await ensureMemberReferralCode(env, member);
  return json(member);
}

// 隱藏連結自行註冊：一定要填對某位會員的推薦碼才能建立帳號
async function handleMemberRegister(request, env) {
  const body = await request.json().catch(() => ({}));
  const { name, account, password, phone, referral_code } = body;
  if (!name || !name.trim()) return json({ error: "請輸入姓名" }, 400);
  if (!account || !account.trim()) return json({ error: "請輸入帳號" }, 400);
  if (!password || password.length < 6) return json({ error: "密碼至少需要 6 碼" }, 400);
  if (!referral_code || !referral_code.trim()) return json({ error: "請輸入推薦碼" }, 400);

  const code = referral_code.trim().toUpperCase();
  const referrer = await env.DB.prepare("SELECT id, name FROM members WHERE UPPER(referral_code)=?").bind(code).first();
  if (!referrer) return json({ error: "推薦碼不正確，請確認後再試" }, 400);

  const passwordHash = await hashPassword(password);
  for (let attempt = 0; attempt < 5; attempt++) {
    const myCode = generateReferralCode();
    try {
      const r = await env.DB.prepare(
        "INSERT INTO members (name, account, password_hash, phone, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(name.trim(), account.trim(), passwordHash, phone || null, myCode, referrer.id)
        .run();

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

async function handleMemberOrders(session, request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  let query =
    "SELECT id, token, amount, platform, payment_method, status, is_completed, created_at, paid_at, expires_at, original_amount, coupon_code, coupon_discount, coins FROM orders WHERE member_id=?";
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
  if (!platformPassword) return json({ error: "請輸入密碼" }, 400);

  const member = await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(session.memberId).first();
  if (!member) return json({ error: "會員不存在，請重新登入" }, 404);

  let finalAmount = amt;
  let couponResult = null;
  if (body.coupon_code && body.coupon_code.trim()) {
    couponResult = await applyCouponToAmount(env, body.coupon_code, amt);
    if (!couponResult.ok) return json({ error: couponResult.error }, 400);
    finalAmount = couponResult.finalAmount;
  }

  // 預計獲得幣數：以優惠碼折抵前的金額（amt）+ 下單當下的費率試算，跟平台無關（各平台共用同一套費率）。
  // 一律由伺服器端計算，不採信前端送來的數字，避免被竄改。
  const rateRules = await getRateRules(env);
  const coinsResult = calcCoins(rateRules, amt);
  const coins = coinsResult ? coinsResult.coins : null;

  const token = randomToken(24);
  const ttlHours = parseInt(env.LINK_TTL_HOURS || "3", 10);
  const expiresAt = addHours(new Date(), ttlHours).toISOString().replace("T", " ").slice(0, 19);

  const inserted = await env.DB.prepare(
    `INSERT INTO orders (token, amount, member_id, member_name_snapshot, status, expires_at,
      original_amount, coupon_code, coupon_discount, platform, platform_account, platform_password, coins)
     VALUES (?, ?, ?, ?, 'pending_method', ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      token,
      finalAmount,
      member.id,
      member.name,
      expiresAt,
      couponResult ? amt : null,
      couponResult ? couponResult.coupon.code : null,
      couponResult ? couponResult.discount : null,
      platform,
      platformAccount,
      platformPassword,
      coins
    )
    .run();

  if (couponResult) await incrementCouponUsage(env, couponResult.coupon.id);

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
    coins,
    order_no: formatOrderNo(inserted.meta.last_row_id),
  });
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
    if (path === "/member/register" || path === "/member/register/") return html(memberRegisterHtml());
    if (path === "/") return Response.redirect(url.origin + "/member", 302);

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

      if (path === "/api/admin/rates" && method === "GET") return handleGetRates(env);
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
      if (completeMatch && method === "POST") return handleCompleteOrder(completeMatch[1], env);

      const uncompleteMatch = path.match(/^\/api\/admin\/orders\/(\d+)\/uncomplete$/);
      if (uncompleteMatch && method === "POST") return handleUncompleteOrder(uncompleteMatch[1], env);

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
