// 直播下單：後台貼上 TikTok 直播留言（例如「@xiaoming A201+1」），依商品代號解析、歸戶、建立訂單。
// 不連線 TikTok，也不需要常駐程式；留言由後台貼上或手動輸入。
import { jsonRes as json, formatOrderNo } from "./helpers.js";

const CODE_RE = /^[A-Z]{1,4}[0-9]{1,6}$/;
// 計入庫存的狀態（候補、無效不計）
const STOCK_STATUSES = "'ok','guest','unbound','ordered'";

export function normalizeTiktokId(raw) {
  const s = String(raw == null ? "" : raw)
    .normalize("NFKC")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  return /^[a-z0-9._]{1,40}$/.test(s) ? s : "";
}

// 解析貼上的文字：一行一則留言。
// 行內格式：「TikTok帳號 代號+數量」，例如 @xiaoming A201+1、xiaoming: a201 +2、@ahua A201+1 A202+2
export function parseLiveText(text, defaultTiktokId) {
  const out = [];
  const lines = String(text || "").split(/\r?\n/);
  for (const rawLine of lines) {
    const raw = rawLine.trim();
    if (!raw) continue;
    const line = raw.normalize("NFKC");
    const re = /([A-Za-z]{1,4}[0-9]{1,6})\s*\+\s*([0-9]{1,3})/g;
    const items = [];
    let first = -1;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (first < 0) first = m.index;
      items.push({ code: m[1].toUpperCase(), qty: parseInt(m[2], 10) });
    }
    if (!items.length) {
      out.push({ raw, tiktok_id: "", items: [], error: "找不到「代號+數量」格式（例如 A201+1）" });
      continue;
    }
    // 代號前面的文字就是 TikTok 帳號：優先取 @ 開頭的詞，否則取最後一個詞
    const before = line.slice(0, first).replace(/[:：,，\-–—]+\s*$/, "").trim();
    let idPart = "";
    if (before) {
      const tokens = before.split(/\s+/);
      idPart = tokens.find((t) => t.startsWith("@")) || tokens[tokens.length - 1];
      idPart = idPart.replace(/[:：,，]+$/, "");
    }
    let tiktok = normalizeTiktokId(idPart);
    if (!tiktok && defaultTiktokId) tiktok = normalizeTiktokId(defaultTiktokId);
    if (!tiktok) {
      out.push({ raw, tiktok_id: "", items, error: "缺少 TikTok 帳號" });
      continue;
    }
    out.push({ raw, tiktok_id: tiktok, items, error: null });
  }
  return out;
}

async function getRound(env, id) {
  return env.DB.prepare("SELECT * FROM live_rounds WHERE id=?").bind(id).first();
}

export async function handleLiveListRounds(env) {
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.name, r.status, r.created_at,
       (SELECT COUNT(*) FROM live_items i WHERE i.round_id = r.id) AS item_count,
       (SELECT COUNT(*) FROM live_comments c WHERE c.round_id = r.id) AS comment_count,
       (SELECT COUNT(*) FROM live_comments c WHERE c.round_id = r.id AND c.status='ordered') AS ordered_count
     FROM live_rounds r ORDER BY r.id DESC LIMIT 100`
  ).all();
  return json(results);
}

export async function handleLiveCreateRound(request, env) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 60);
  if (!name) return json({ error: "請輸入場次名稱" }, 400);
  const r = await env.DB.prepare("INSERT INTO live_rounds (name) VALUES (?)").bind(name).run();
  const id = r.meta.last_row_id;
  const copyFrom = parseInt(body.copy_items_from, 10);
  if (copyFrom) {
    await env.DB.prepare(
      `INSERT INTO live_items (round_id, code, name, price, stock, is_active)
       SELECT ?, code, name, price, stock, is_active FROM live_items WHERE round_id=?`
    )
      .bind(id, copyFrom)
      .run();
  }
  return json({ ok: true, id });
}

export async function handleLiveUpdateRound(id, request, env) {
  const round = await getRound(env, id);
  if (!round) return json({ error: "找不到此場次" }, 404);
  const body = await request.json().catch(() => ({}));
  const name = body.name !== undefined ? String(body.name).trim().slice(0, 60) : round.name;
  if (!name) return json({ error: "場次名稱不可為空白" }, 400);
  const status = body.status !== undefined ? body.status : round.status;
  if (status !== "open" && status !== "closed") return json({ error: "狀態不正確" }, 400);
  await env.DB.prepare("UPDATE live_rounds SET name=?, status=? WHERE id=?").bind(name, status, id).run();
  return json({ ok: true });
}

export async function handleLiveDeleteRound(id, env) {
  // 只刪場次資料，已建立的訂單不受影響
  await env.DB.prepare("DELETE FROM live_comments WHERE round_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM live_items WHERE round_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM live_rounds WHERE id=?").bind(id).run();
  return json({ ok: true });
}

export async function handleLiveGetRound(id, env) {
  const round = await getRound(env, id);
  if (!round) return json({ error: "找不到此場次" }, 404);
  const { results: items } = await env.DB.prepare(
    `SELECT i.*, COALESCE((SELECT SUM(c.qty) FROM live_comments c
        WHERE c.round_id = i.round_id AND c.item_code = i.code AND c.status IN (${STOCK_STATUSES})), 0) AS used
     FROM live_items i WHERE i.round_id=? ORDER BY i.code`
  )
    .bind(id)
    .all();
  const { results: comments } = await env.DB.prepare(
    `SELECT c.id, c.tiktok_id, c.raw, c.item_code, c.qty, c.member_id, c.status, c.error, c.order_id, c.created_at,
            m.name AS member_name, o.token AS order_token
     FROM live_comments c
     LEFT JOIN members m ON m.id = c.member_id
     LEFT JOIN orders o ON o.id = c.order_id
     WHERE c.round_id=? ORDER BY c.id`
  )
    .bind(id)
    .all();
  for (const c of comments) c.order_no = c.order_id ? formatOrderNo(c.order_id) : null;
  return json({ round, items, comments });
}

function parseItemFields(body, partial) {
  const out = {};
  if (!partial || body.code !== undefined) {
    const code = String(body.code || "").normalize("NFKC").trim().toUpperCase();
    if (!CODE_RE.test(code)) return { error: "商品代號格式不正確（1～4 個英文字母加上數字，例如 A201）" };
    out.code = code;
  }
  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim().slice(0, 80);
    if (!name) return { error: "請輸入商品名稱" };
    out.name = name;
  }
  if (!partial || body.price !== undefined) {
    const price = parseFloat(body.price);
    if (!(price > 0)) return { error: "單價必須大於 0" };
    out.price = price;
  }
  if (!partial || body.stock !== undefined) {
    if (body.stock === "" || body.stock === null || body.stock === undefined) out.stock = null;
    else {
      const stock = parseInt(body.stock, 10);
      if (!(stock >= 0)) return { error: "庫存必須是 0 以上的整數，或留空表示不限量" };
      out.stock = stock;
    }
  }
  if (body.is_active !== undefined) out.is_active = body.is_active ? 1 : 0;
  return { fields: out };
}

export async function handleLiveAddItem(roundId, request, env) {
  const round = await getRound(env, roundId);
  if (!round) return json({ error: "找不到此場次" }, 404);
  const body = await request.json().catch(() => ({}));
  const p = parseItemFields(body, false);
  if (p.error) return json({ error: p.error }, 400);
  const f = p.fields;
  try {
    await env.DB.prepare("INSERT INTO live_items (round_id, code, name, price, stock) VALUES (?, ?, ?, ?, ?)")
      .bind(roundId, f.code, f.name, f.price, f.stock)
      .run();
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) return json({ error: "此場次已有相同的商品代號" }, 400);
    throw err;
  }
  return json({ ok: true });
}

export async function handleLiveUpdateItem(id, request, env) {
  const item = await env.DB.prepare("SELECT * FROM live_items WHERE id=?").bind(id).first();
  if (!item) return json({ error: "找不到此商品" }, 404);
  const body = await request.json().catch(() => ({}));
  const p = parseItemFields(body, true);
  if (p.error) return json({ error: p.error }, 400);
  const f = p.fields;
  if (f.code && f.code !== item.code) {
    const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM live_comments WHERE round_id=? AND item_code=?")
      .bind(item.round_id, item.code)
      .first();
    if (used && used.n > 0) return json({ error: "已有留言使用此代號，不能修改代號；請新增另一個商品" }, 400);
  }
  const merged = {
    code: f.code ?? item.code,
    name: f.name ?? item.name,
    price: f.price ?? item.price,
    stock: "stock" in f ? f.stock : item.stock,
    is_active: f.is_active ?? item.is_active,
  };
  try {
    await env.DB.prepare("UPDATE live_items SET code=?, name=?, price=?, stock=?, is_active=? WHERE id=?")
      .bind(merged.code, merged.name, merged.price, merged.stock, merged.is_active, id)
      .run();
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) return json({ error: "此場次已有相同的商品代號" }, 400);
    throw err;
  }
  return json({ ok: true });
}

export async function handleLiveDeleteItem(id, env) {
  const item = await env.DB.prepare("SELECT * FROM live_items WHERE id=?").bind(id).first();
  if (!item) return json({ error: "找不到此商品" }, 404);
  const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM live_comments WHERE round_id=? AND item_code=?")
    .bind(item.round_id, item.code)
    .first();
  if (used && used.n > 0) return json({ error: "已有留言使用此商品，不能刪除；可以改成「停用」" }, 400);
  await env.DB.prepare("DELETE FROM live_items WHERE id=?").bind(id).run();
  return json({ ok: true });
}

// 貼上留言 → 解析 → 寫入 live_comments
export async function handleLiveAddComments(roundId, request, env) {
  const round = await getRound(env, roundId);
  if (!round) return json({ error: "找不到此場次" }, 404);
  if (round.status !== "open") return json({ error: "此場次已結標，請先重新開啟" }, 400);
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "");
  if (!text.trim()) return json({ error: "請貼上留言內容" }, 400);
  if (text.length > 50000) return json({ error: "一次貼上的內容太多，請分批" }, 400);

  const parsed = parseLiveText(text, body.tiktok_id);
  const { results: itemRows } = await env.DB.prepare(
    `SELECT i.*, COALESCE((SELECT SUM(c.qty) FROM live_comments c
        WHERE c.round_id = i.round_id AND c.item_code = i.code AND c.status IN (${STOCK_STATUSES})), 0) AS used
     FROM live_items i WHERE i.round_id=?`
  )
    .bind(roundId)
    .all();
  const items = new Map(itemRows.map((i) => [i.code, i]));
  const memberCache = new Map();
  async function memberOf(tiktok) {
    if (!memberCache.has(tiktok)) {
      memberCache.set(tiktok, await env.DB.prepare("SELECT id FROM members WHERE tiktok_id=?").bind(tiktok).first());
    }
    return memberCache.get(tiktok);
  }

  const summary = { ok: 0, unbound: 0, waitlist: 0, invalid: 0 };
  const insert = env.DB.prepare(
    "INSERT INTO live_comments (round_id, tiktok_id, raw, item_code, qty, member_id, status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const batch = [];
  for (const p of parsed) {
    if (p.error) {
      batch.push(insert.bind(roundId, p.tiktok_id || null, p.raw, null, null, null, "invalid", p.error));
      summary.invalid++;
      continue;
    }
    const member = await memberOf(p.tiktok_id);
    for (const it of p.items) {
      const item = items.get(it.code);
      if (!item || !item.is_active) {
        const why = !item ? "此場次沒有代號 " + it.code : "商品 " + it.code + " 已停用";
        batch.push(insert.bind(roundId, p.tiktok_id, p.raw, it.code, it.qty, null, "invalid", why));
        summary.invalid++;
        continue;
      }
      if (!(it.qty > 0)) {
        batch.push(insert.bind(roundId, p.tiktok_id, p.raw, it.code, it.qty, null, "invalid", "數量必須大於 0"));
        summary.invalid++;
        continue;
      }
      let status = member ? "ok" : "unbound";
      if (item.stock != null && item.used + it.qty > item.stock) {
        status = "waitlist";
        summary.waitlist++;
      } else {
        item.used += it.qty;
        summary[member ? "ok" : "unbound"]++;
      }
      batch.push(insert.bind(roundId, p.tiktok_id, p.raw, it.code, it.qty, member ? member.id : null, status, null));
    }
  }
  if (batch.length) await env.DB.batch(batch);
  return json({ ok: true, lines: parsed.length, rows: batch.length, summary });
}

async function getComment(env, id) {
  return env.DB.prepare("SELECT * FROM live_comments WHERE id=?").bind(id).first();
}

// 把未綁定的留言歸給指定會員；save_binding 為真時，順便把這個 TikTok 帳號記到會員資料，同場次同帳號的未綁定留言一併歸戶
export async function handleLiveBindComment(id, request, env) {
  const c = await getComment(env, id);
  if (!c) return json({ error: "找不到此留言" }, 404);
  if (c.status === "ordered") return json({ error: "此留言已建立訂單" }, 400);
  const body = await request.json().catch(() => ({}));
  const member = await env.DB.prepare("SELECT id, tiktok_id FROM members WHERE id=?").bind(body.member_id).first();
  if (!member) return json({ error: "找不到指定會員" }, 400);

  let bound = 0;
  if (body.save_binding && c.tiktok_id) {
    if (member.tiktok_id && member.tiktok_id !== c.tiktok_id) {
      return json({ error: "此會員已綁定另一個 TikTok 帳號（@" + member.tiktok_id + "），請先到會員管理修改" }, 400);
    }
    const other = await env.DB.prepare("SELECT id FROM members WHERE tiktok_id=? AND id<>?").bind(c.tiktok_id, member.id).first();
    if (other) return json({ error: "此 TikTok 帳號已綁定其他會員" }, 400);
    await env.DB.prepare("UPDATE members SET tiktok_id=? WHERE id=?").bind(c.tiktok_id, member.id).run();
    const r = await env.DB.prepare(
      "UPDATE live_comments SET member_id=?, status='ok' WHERE tiktok_id=? AND status IN ('unbound','guest')"
    )
      .bind(member.id, c.tiktok_id)
      .run();
    bound = r.meta.changes || 0;
  }
  // 不論有沒有記住，這一筆一定歸給該會員（候補維持候補）
  const newStatus = c.status === "waitlist" ? "waitlist" : "ok";
  await env.DB.prepare("UPDATE live_comments SET member_id=?, status=? WHERE id=?").bind(member.id, newStatus, id).run();
  return json({ ok: true, bound });
}

export async function handleLiveGuestComment(id, env) {
  const c = await getComment(env, id);
  if (!c) return json({ error: "找不到此留言" }, 404);
  if (c.status !== "unbound") return json({ error: "只有「未綁定」的留言可以改成非會員" }, 400);
  // 同場次同帳號的未綁定留言一併改成非會員，才會合併成同一張訂單
  await env.DB.prepare("UPDATE live_comments SET status='guest', member_id=NULL WHERE round_id=? AND tiktok_id=? AND status='unbound'")
    .bind(c.round_id, c.tiktok_id)
    .run();
  return json({ ok: true });
}

export async function handleLivePromoteComment(id, env) {
  const c = await getComment(env, id);
  if (!c) return json({ error: "找不到此留言" }, 404);
  if (c.status !== "waitlist") return json({ error: "只有「候補」的留言可以改為正式" }, 400);
  const member = c.tiktok_id ? await env.DB.prepare("SELECT id FROM members WHERE tiktok_id=?").bind(c.tiktok_id).first() : null;
  await env.DB.prepare("UPDATE live_comments SET status=?, member_id=? WHERE id=?")
    .bind(member ? "ok" : "unbound", member ? member.id : null, id)
    .run();
  return json({ ok: true });
}

export async function handleLiveDeleteComment(id, env) {
  const c = await getComment(env, id);
  if (!c) return json({ error: "找不到此留言" }, 404);
  if (c.status === "ordered") return json({ error: "此留言已建立訂單，請到訂單列表處理" }, 400);
  await env.DB.prepare("DELETE FROM live_comments WHERE id=?").bind(id).run();
  return json({ ok: true });
}

// 重新比對：會員資料補上 TikTok 帳號之後，把未綁定的留言歸戶
export async function handleLiveRematch(roundId, env) {
  const r = await env.DB.prepare(
    `UPDATE live_comments SET status='ok',
       member_id=(SELECT m.id FROM members m WHERE m.tiktok_id = live_comments.tiktok_id)
     WHERE round_id=? AND status='unbound'
       AND EXISTS (SELECT 1 FROM members m WHERE m.tiktok_id = live_comments.tiktok_id)`
  )
    .bind(roundId)
    .run();
  return json({ ok: true, matched: r.meta.changes || 0 });
}

// 建立訂單：待建單（會員）與非會員的留言，同一人合併成一張訂單；沿用原本的建單邏輯與 3 小時連結
export async function handleLiveCreateOrders(roundId, request, env, createOrderFn) {
  const round = await getRound(env, roundId);
  if (!round) return json({ error: "找不到此場次" }, 404);
  const { results: rows } = await env.DB.prepare(
    `SELECT c.id, c.tiktok_id, c.member_id, c.item_code, c.qty, c.status, i.price
     FROM live_comments c JOIN live_items i ON i.round_id = c.round_id AND i.code = c.item_code
     WHERE c.round_id=? AND c.status IN ('ok','guest') ORDER BY c.id`
  )
    .bind(roundId)
    .all();
  if (!rows.length) return json({ error: "沒有可以建立訂單的留言" }, 400);

  const groups = new Map();
  for (const r of rows) {
    const key = r.status === "ok" && r.member_id ? "m" + r.member_id : "g" + r.tiktok_id;
    if (!groups.has(key)) groups.set(key, { member_id: r.status === "ok" ? r.member_id : null, tiktok_id: r.tiktok_id, rows: [], total: 0, parts: new Map() });
    const g = groups.get(key);
    g.rows.push(r);
    g.total += r.price * r.qty;
    g.parts.set(r.item_code, (g.parts.get(r.item_code) || 0) + r.qty);
  }

  const origin = new URL(request.url).origin;
  const created = [];
  const failed = [];
  for (const g of groups.values()) {
    const payload = { amount: g.total };
    if (g.member_id) payload.member_id = g.member_id;
    else payload.non_member_name = "@" + g.tiktok_id;
    const fakeReq = new Request(origin + "/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    try {
      const res = await createOrderFn(fakeReq, env);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "建單失敗");
      const orderRow = await env.DB.prepare("SELECT id FROM orders WHERE token=?").bind(data.token).first();
      const note = "直播「" + round.name + "」@" + g.tiktok_id + "：" + Array.from(g.parts).map(([code, q]) => code + "×" + q).join("、");
      await env.DB.prepare("UPDATE orders SET admin_note=? WHERE token=?").bind(note, data.token).run();
      const ids = g.rows.map((r) => r.id);
      await env.DB.prepare(
        "UPDATE live_comments SET status='ordered', order_id=? WHERE id IN (" + ids.map(() => "?").join(",") + ")"
      )
        .bind(orderRow ? orderRow.id : null, ...ids)
        .run();
      created.push({ tiktok_id: g.tiktok_id, member_id: g.member_id, amount: data.amount, order_no: data.order_no, link: data.link });
    } catch (err) {
      failed.push({ tiktok_id: g.tiktok_id, error: String(err.message || err) });
    }
  }
  const skipped = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM live_comments WHERE round_id=? AND status IN ('unbound','waitlist')"
  )
    .bind(roundId)
    .first();
  return json({ ok: true, created, failed, skipped: skipped ? skipped.n : 0 });
}
