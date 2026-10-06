// TikTok 直播留言監聽程式
// 連上直播間，把符合「代號+數量」（例如 A201+1）的留言送到後台的 /api/live/ingest。
// 設定都用環境變數：TIKTOK_USERNAME、INGEST_URL、INGEST_KEY（選填：EULER_API_KEY）。
// 注意：tiktok-live-connector 是非官方套件，TikTok 改版時可能暫時失效。

const USER = (process.env.TIKTOK_USERNAME || "").replace(/^@/, "").trim();
const INGEST_URL = (process.env.INGEST_URL || "").trim();
const INGEST_KEY = (process.env.INGEST_KEY || "").trim();
const SIGN_KEY = (process.env.EULER_API_KEY || "").trim();

if (!USER || !INGEST_URL || !INGEST_KEY) {
  console.error("缺少設定：請設定環境變數 TIKTOK_USERNAME、INGEST_URL、INGEST_KEY（見 README.md）");
  process.exit(1);
}

const ORDER_RE = /[A-Za-z]{1,4}[0-9]{1,6}\s*\+\s*[0-9]{1,3}/; // 與後台解析規則一致
const BATCH = 40; // 後台一次最多收 40 則
const FLUSH_MS = 2000;
const MAX_BUFFER = 500;

const log = (...a) => console.log(new Date().toLocaleTimeString("zh-TW", { hour12: false }), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let buffer = [];
let flushing = false;
let seq = 0;

function pickChat(data) {
  const user = data?.user?.uniqueId ?? data?.uniqueId ?? "";
  const text = data?.comment ?? "";
  const id = data?.msgId ?? data?.common?.msgId ?? "";
  return { id: id ? String(id) : "", user: String(user), text: String(text) };
}

function onChat(data) {
  const c = pickChat(data);
  if (!c.user || !c.text) return;
  if (!ORDER_RE.test(c.text.normalize("NFKC"))) return; // 一般聊天不送
  if (!c.id) c.id = c.user + "-" + Date.now() + "-" + ++seq; // 沒有編號時自己產生（重試時同一則編號不變）
  buffer.push(c);
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
  log("收到訂購留言：@" + c.user + " " + c.text);
}

async function flush() {
  if (flushing || !buffer.length) return;
  flushing = true;
  try {
    while (buffer.length) {
      const chunk = buffer.slice(0, BATCH);
      const res = await fetch(INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ingest-Key": INGEST_KEY },
        body: JSON.stringify({ comments: chunk }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        buffer.splice(0, chunk.length);
        log("已送出 " + chunk.length + " 則（收下 " + (d.accepted ?? "?") + "、重複 " + (d.duplicate ?? 0) + "）");
      } else if (res.status === 401) {
        buffer.splice(0, chunk.length);
        log("金鑰不正確，請到後台「自動抓取留言」重新複製金鑰；這批留言已丟棄");
      } else if (res.status === 409 || res.status === 400) {
        buffer.splice(0, chunk.length);
        log("後台沒有收：" + (d.error || res.status) + "；這批留言已丟棄");
      } else {
        log("送出失敗 HTTP " + res.status + "，稍後重試");
        break;
      }
    }
  } catch (e) {
    log("連線後台失敗：" + (e?.message || e) + "，稍後重試");
  } finally {
    flushing = false;
  }
}
setInterval(flush, FLUSH_MS);

async function main() {
  const mod = await import("tiktok-live-connector");
  const Conn = mod.TikTokLiveConnection || mod.WebcastPushConnection; // 2.x 與 1.x 的名稱
  if (!Conn) throw new Error("找不到連線類別，請確認 tiktok-live-connector 已安裝");
  const EV_CHAT = mod.WebcastEvent?.CHAT ?? "chat";
  const EV_END = mod.WebcastEvent?.STREAM_END ?? "streamEnd";
  const EV_DISC = mod.ControlEvent?.DISCONNECTED ?? "disconnected";
  const EV_ERR = mod.ControlEvent?.ERROR ?? "error";

  let wait = 5000;
  for (;;) {
    const conn = new Conn(USER, SIGN_KEY ? { signApiKey: SIGN_KEY } : {});
    let finish;
    const ended = new Promise((r) => (finish = r));
    conn.on(EV_CHAT, onChat);
    conn.on(EV_DISC, () => finish("disconnected"));
    conn.on(EV_END, () => finish("streamEnd"));
    conn.on(EV_ERR, (e) => log("連線錯誤：" + (e?.message || e)));
    try {
      await conn.connect();
      log("已連上 @" + USER + " 的直播間，開始監聽留言");
      wait = 5000;
      log("連線結束：" + (await ended));
    } catch (e) {
      log("連不上 @" + USER + " 的直播間（可能還沒開播）：" + (e?.message || e));
    }
    try { conn.disconnect(); } catch {}
    log(Math.round(wait / 1000) + " 秒後重新連線");
    await sleep(wait);
    wait = Math.min(wait * 2, 60000);
  }
}

process.on("unhandledRejection", (e) => log("未處理的錯誤：" + (e?.message || e)));
process.on("SIGINT", async () => { await flush(); process.exit(0); });

main().catch((e) => { console.error(e); process.exit(1); });
