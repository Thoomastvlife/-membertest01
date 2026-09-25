import { adminHtml, payHtml, memberHtml } from "./_lib/templates.js";
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
  PROOF_ELIGIBLE_METHODS,
  publicOrderView,
  expireIfNeeded,
  isLinkHardExpired,
  getSettingsObj,
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

// ---- Staff / admin accounts (由已登入的管理員新增其他員工帳號) ----

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
    "SELECT id, name, account, phone, note, created_at FROM members ORDER BY created_at DESC"
  ).all();
  return json(results);
}

async function handleAddMember(request, env) {
  const body = await request.json().catch(() => ({}));
  const { name, phone, note, account, password } = body;
  if (!name || !name.trim()) return json({ error: "請輸入姓名" }, 400);
  if (password && password.length < 6) return json({ error: "密碼至少需要 6 碼" }, 400);

  const passwordHash = password ? await hashPassword(password) : null;
  try {
    const r = await env.DB.prepare(
      "INSERT INTO members (name, account, password_hash, phone, note) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(name.trim(), account && account.trim() ? account.trim() : null, passwordHash, phone || null, note || null)
      .run();
    return json({ ok: true, id: r.meta.last_row_id });
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) {
      return json({ error: "此帳號已被使用，請換一個" }, 400);
    }
    throw err;
  }
}

async function handleDeleteMember(id, env) {
  await env.DB.prepare("DELETE FROM members WHERE id=?").bind(id).run();
  return json({ ok: true });
}

// 隨時可修改會員資料（姓名／電話／備註／帳號）。密碼修改走另一支 /password 端點。
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

// ---- Orders (admin) ----

async function handleCreateOrder(request, env) {
  const body = await request.json().catch(() => ({}));
  const { amount, member_id, non_member_name, payment_method } = body;

  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return json({ error: "金額不正確" }, 400);
  if (payment_method && !PAYMENT_METHODS.has(payment_method)) return json({ error: "付款方式不正確" }, 400);

  let memberNameSnapshot = non_member_name && non_member_name.trim() ? non_member_name.trim() : "非會員";
  let memberId = null;
  if (member_id) {
    const m = await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(member_id).first();
    if (!m) return json({ error: "找不到指定會員" }, 400);
    memberId = m.id;
    memberNameSnapshot = m.name;
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

  await env.DB.prepare(
    `INSERT INTO orders (token, amount, member_id, member_name_snapshot, payment_method, status,
      bank_name, bank_account_number, bank_account_holder, expires_at, method_selected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      token,
      amt,
      memberId,
      memberNameSnapshot,
      payment_method || null,
      status,
      bankFields.bank_name,
      bankFields.bank_account_number,
      bankFields.bank_account_holder,
      expiresAt,
      methodSelectedAt
    )
    .run();

  const url = new URL(request.url);
  const link = `${url.origin}/pay/${token}`;
  return json({ ok: true, token, link, expires_at: expiresAt });
}

async function handleListOrders(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  let query = "SELECT * FROM orders";
  const binds = [];
  if (month) {
    query += " WHERE strftime('%Y-%m', created_at) = ?";
    binds.push(month);
  }
  query += " ORDER BY created_at DESC";
  const stmt = binds.length ? env.DB.prepare(query).bind(...binds) : env.DB.prepare(query);
  const { results } = await stmt.all();
  return json(results);
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

// 徹底刪除訂單記錄（跟「取消」不同：取消只是改狀態、記錄還在；刪除會把這筆資料整個移除，無法復原）
async function handleDeleteOrder(id, env) {
  const order = await env.DB.prepare("SELECT id FROM orders WHERE id=?").bind(id).first();
  if (!order) return json({ error: "找不到訂單" }, 404);
  await env.DB.prepare("DELETE FROM orders WHERE id=?").bind(id).run();
  return json({ ok: true });
}

// 訂單更正：修正金額 / 會員 / 付款方式打錯的情況。已取消或已結案的訂單不能再更正。
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

  if (body.payment_method !== undefined) {
    const method = body.payment_method || null;
    if (method && !PAYMENT_METHODS.has(method)) return json({ error: "付款方式不正確" }, 400);
    if (method !== order.payment_method) {
      if (!method) {
        // 重設為未選擇，讓客人可以重新選擇付款方式（同時清掉舊的條碼／付款證明）
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

// 訂單完成（結案）：純粹方便篩選哪些訂單已經處理完畢，不影響金流，只有已完成付款的訂單能標記
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

  const PM_LABEL = { transfer: "轉帳", store_barcode: "超商條碼", taiwan_pay: "台灣Pay" };
  const STATUS_LABEL = {
    pending_method: "待選付款方式",
    awaiting_payment: "等待轉帳付款",
    awaiting_barcode: "待上傳條碼",
    ready_to_pay: "已可付款(條碼)",
    paid: "已完成付款",
    expired: "已過期",
    cancelled: "已取消",
  };

  const header = ["訂單編號", "建立時間", "會員/客人", "金額", "付款方式", "狀態", "訂單完成(結案)", "付款證明末幾碼", "付款方式選擇時間", "完成付款時間", "到期時間"];
  const rows = results.map((o) => [
    o.id,
    o.created_at,
    o.member_name_snapshot,
    o.amount,
    PM_LABEL[o.payment_method] || "",
    STATUS_LABEL[o.status] || o.status,
    o.is_completed ? "是" : "否",
    o.proof_last_digits || "",
    o.method_selected_at || "",
    o.paid_at || "",
    o.expires_at,
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

// ---- Monthly top-up stats ----

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

// 客人上傳轉帳截圖 / 填寫帳號末幾碼，方便店家核對款項（轉帳、超商繳費適用）
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

// ---- Member self-service (自助登入查詢) ----

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
  const member = await env.DB.prepare("SELECT id, name, account FROM members WHERE id=?").bind(session.memberId).first();
  if (!member) return json({ error: "會員不存在，請重新登入" }, 404);
  return json(member);
}

async function handleMemberOrders(session, request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  let query =
    "SELECT id, token, amount, payment_method, status, is_completed, created_at, paid_at, expires_at FROM orders WHERE member_id=?";
  const binds = [session.memberId];
  if (month) {
    query += " AND strftime('%Y-%m', created_at) = ?";
    binds.push(month);
  }
  query += " ORDER BY created_at DESC LIMIT 200";
  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json(results);
}

// 會員自助下單：會員登入後自己輸入金額建立訂單，流程跟後台「結帳櫃檯」建立的訂單完全相同，
// 建立後導向 /pay/{token} 選付款方式、上傳證明；member_id 一律鎖定為目前登入的會員，不能填別人。
async function handleMemberCreateOrder(session, request, env) {
  const body = await request.json().catch(() => ({}));
  const amt = parseFloat(body.amount);
  if (!amt || amt <= 0) return json({ error: "金額不正確" }, 400);

  const member = await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(session.memberId).first();
  if (!member) return json({ error: "會員不存在，請重新登入" }, 404);

  const token = randomToken(24);
  const ttlHours = parseInt(env.LINK_TTL_HOURS || "3", 10);
  const expiresAt = addHours(new Date(), ttlHours).toISOString().replace("T", " ").slice(0, 19);

  await env.DB.prepare(
    `INSERT INTO orders (token, amount, member_id, member_name_snapshot, status, expires_at)
     VALUES (?, ?, ?, ?, 'pending_method', ?)`
  )
    .bind(token, amt, member.id, member.name, expiresAt)
    .run();

  const url = new URL(request.url);
  const link = `${url.origin}/pay/${token}`;
  return json({ ok: true, token, link, expires_at: expiresAt });
}

// ================= Pages Functions entrypoint =================

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // ---- Public pages ----
    if (path === "/admin" || path === "/admin/") return html(adminHtml());
    if (path.startsWith("/pay/")) return html(payHtml());
    if (path === "/member" || path === "/member/") return html(memberHtml());
    if (path === "/") return Response.redirect(url.origin + "/member", 302);

    // ---- Public API ----
    if (path === "/api/setup-status" && method === "GET") return handleSetupStatus(env);
    if (path === "/api/setup-admin" && method === "POST") return handleSetupAdmin(request, env);
    if (path === "/api/admin/login" && method === "POST") return handleLogin(request, env);
    if (path === "/api/admin/logout" && method === "POST") return handleLogout();

    if (path === "/api/member/login" && method === "POST") return handleMemberLogin(request, env);
    if (path === "/api/member/logout" && method === "POST") return handleMemberLogout();

    const orderTokenMatch = path.match(/^\/api\/order\/([a-f0-9]+)$/);
    if (orderTokenMatch && method === "GET") return handleGetOrderPublic(orderTokenMatch[1], env);

    const selectMethodMatch = path.match(/^\/api\/order\/([a-f0-9]+)\/select-method$/);
    if (selectMethodMatch && method === "POST") return handleSelectMethod(selectMethodMatch[1], request, env);

    const proofMatch = path.match(/^\/api\/order\/([a-f0-9]+)\/proof$/);
    if (proofMatch && method === "POST") return handleUploadProof(proofMatch[1], request, env);

    // ---- Member API (member session required) ----
    if (path.startsWith("/api/member/")) {
      const session = await requireMember(request, env);
      if (!session) return json({ error: "未登入或登入已過期" }, 401);
      if (path === "/api/member/me" && method === "GET") return handleMemberMe(session, env);
      if (path === "/api/member/orders" && method === "GET") return handleMemberOrders(session, request, env);
      if (path === "/api/member/orders" && method === "POST") return handleMemberCreateOrder(session, request, env);
      return json({ error: "Not found" }, 404);
    }

    // ---- Admin API (session required) ----
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

      return json({ error: "Not found" }, 404);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: "系統錯誤: " + err.message }, 500);
  }
}
