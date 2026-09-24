import { adminHtml, payHtml } from "./_lib/templates.js";
import {
  jsonRes as json,
  htmlRes as html,
  randomToken,
  hashPassword,
  verifyPassword,
  signSession,
  requireAdmin,
  setCookieHeader,
  clearCookieHeader,
  nowIso,
  addHours,
  PAYMENT_METHODS,
  publicOrderView,
  expireIfNeeded,
  getSettingsObj,
} from "./_lib/helpers.js";

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
  return json({ username: session.username });
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

  const header = ["訂單編號", "建立時間", "會員/客人", "金額", "付款方式", "狀態", "付款方式選擇時間", "完成付款時間", "到期時間"];
  const rows = results.map((o) => [
    o.id,
    o.created_at,
    o.member_name_snapshot,
    o.amount,
    PM_LABEL[o.payment_method] || "",
    STATUS_LABEL[o.status] || o.status,
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
  order = await expireIfNeeded(env.DB, order);
  return json(publicOrderView(order));
}

async function handleSelectMethod(token, request, env) {
  const body = await request.json().catch(() => ({}));
  const { method } = body;
  if (!PAYMENT_METHODS.has(method)) return json({ error: "付款方式不正確" }, 400);

  let order = await env.DB.prepare("SELECT * FROM orders WHERE token=?").bind(token).first();
  if (!order) return json({ error: "找不到此訂單" }, 404);
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
    if (path === "/") return Response.redirect(url.origin + "/admin", 302);

    // ---- Public API ----
    if (path === "/api/setup-status" && method === "GET") return handleSetupStatus(env);
    if (path === "/api/setup-admin" && method === "POST") return handleSetupAdmin(request, env);
    if (path === "/api/admin/login" && method === "POST") return handleLogin(request, env);
    if (path === "/api/admin/logout" && method === "POST") return handleLogout();

    const orderTokenMatch = path.match(/^\/api\/order\/([a-f0-9]+)$/);
    if (orderTokenMatch && method === "GET") return handleGetOrderPublic(orderTokenMatch[1], env);

    const selectMethodMatch = path.match(/^\/api\/order\/([a-f0-9]+)\/select-method$/);
    if (selectMethodMatch && method === "POST") return handleSelectMethod(selectMethodMatch[1], request, env);

    // ---- Admin API (session required) ----
    if (path.startsWith("/api/admin/")) {
      const session = await requireAdmin(request, env);
      if (!session) return json({ error: "未登入或登入已過期" }, 401);

      if (path === "/api/admin/me" && method === "GET") return handleMe(session);
      if (path === "/api/admin/members" && method === "GET") return handleListMembers(env);
      if (path === "/api/admin/members" && method === "POST") return handleAddMember(request, env);

      const memberDeleteMatch = path.match(/^\/api\/admin\/members\/(\d+)$/);
      if (memberDeleteMatch && method === "DELETE") return handleDeleteMember(memberDeleteMatch[1], env);

      const memberPasswordMatch = path.match(/^\/api\/admin\/members\/(\d+)\/password$/);
      if (memberPasswordMatch && method === "POST") return handleSetMemberPassword(memberPasswordMatch[1], request, env);

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

      if (path === "/api/admin/export" && method === "GET") return handleExport(request, env);
      if (path === "/api/admin/stats/monthly" && method === "GET") return handleMonthlyStats(request, env);

      return json({ error: "Not found" }, 404);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: "系統錯誤: " + err.message }, 500);
  }
}
