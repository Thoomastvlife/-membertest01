// 功能一：舊網址 (coffee1688.pages.dev) 顯示「網頁已更新」+ Turnstile 驗證後跳轉到新網址。
// 功能二：新網址 (member.ytgp168.com) 的「會員登入 / 會員註冊 / 寄送驗證碼 / 管理員登入」
//         加上 Turnstile 人機驗證（前端自動注入、後端強制檢查），不需要修改 templates.js 與 [[path]].js。
//
// 需要的環境變數（Pages 專案設定）：
//   TURNSTILE_SITE_KEY  (一般變數)  Turnstile Site key
//   TURNSTILE_SECRET    (Secret)    Turnstile Secret key
// 兩者都設定後新站保護才會啟用；任何一個沒設定就不啟用（避免誤把自己鎖在門外）。
//
// Turnstile 小工具的「網域」要同時加入：coffee1688.pages.dev、member.ytgp168.com、www.member.ytgp168.com

const NEW_ORIGIN = "https://member.ytgp168.com";
const OLD_HOSTS = ["coffee1688.pages.dev"]; // 預覽網址 xxxx.coffee1688.pages.dev 也會一併處理

const isOldHost = (h) => OLD_HOSTS.some((o) => h === o || h.endsWith("." + o));

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function noticePage(siteKey) {
  return `<!DOCTYPE html>
<html lang="zh-Hant"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>網頁已更新</title><meta name="robots" content="noindex">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
<style>
:root{--bg:#f5f6fa;--card:#fff;--text:#1f2430;--sub:#6b7280;--accent:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#12141a;--card:#1c1f27;--text:#eef0f5;--sub:#9aa3b2;--accent:#60a5fa}}
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text);font-family:-apple-system,"Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;padding:20px}
.card{background:var(--card);border-radius:16px;padding:36px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08)}
.spinner{width:44px;height:44px;margin:0 auto 20px;border:4px solid rgba(128,128,128,.25);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:22px;margin:0 0 10px}p{margin:6px 0;color:var(--sub);line-height:1.6}
.url{color:var(--accent);word-break:break-all;font-weight:600}
#ts{margin-top:16px;display:flex;justify-content:center}
.btn{display:inline-block;margin-top:18px;padding:10px 22px;background:var(--accent);color:#fff;border-radius:10px;text-decoration:none;font-weight:600}
</style></head><body>
<div class="card">
  <div class="spinner"></div>
  <h1>此網頁已更新</h1>
  <p>即將進入新網址</p>
  <p class="url">${NEW_ORIGIN}/</p>
  <div id="ts"></div>
  <p id="status">正在驗證…</p>
  <a class="btn" href="${NEW_ORIGIN}/">立即前往</a>
  <div style="margin-top:22px;padding-top:14px;border-top:1px solid rgba(128,128,128,.25);font-size:12px;line-height:1.7;color:var(--sub);text-align:center"><div style="font-weight:600">網頁宣告</div><div>本網站為會員自助查詢與訂單結帳頁面，內容僅供參考，實際以訂單確認內容為準。</div><div>客服信箱：<a href="mailto:shop@shop.ytgp168.com" style="color:inherit;text-decoration:underline">shop@shop.ytgp168.com</a></div></div>
</div>
<script>
var SITE_KEY=${JSON.stringify(siteKey || "")};
var TARGET=${JSON.stringify(NEW_ORIGIN + "/")};
var st=document.getElementById("status");
function go(){var n=3;st.textContent=n+" 秒後自動跳轉…";var t=setInterval(function(){n--;if(n<=0){clearInterval(t);location.replace(TARGET)}else st.textContent=n+" 秒後自動跳轉…"},1000)}
if(!SITE_KEY){go()}else{
  window.addEventListener("load",function w(){
    if(!window.turnstile)return setTimeout(w,100);
    turnstile.render("#ts",{sitekey:SITE_KEY,
      callback:function(token){
        st.textContent="驗證中…";
        fetch("/api/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:token})})
          .then(function(r){return r.json()})
          .then(function(d){if(d&&d.success)go();else{st.textContent="驗證未通過，將自動前往新網址…";setTimeout(go,1500)}})
          .catch(function(){st.textContent="無法連線驗證服務，將自動前往新網址…";setTimeout(go,1500)});
      },
      "error-callback":function(c){st.textContent="驗證失敗"+(c?"（錯誤碼 "+c+"）":"")+"，將自動前往新網址…";setTimeout(go,1500);return true},
      "timeout-callback":function(){go()},
      "unsupported-callback":function(){go()}
    });
  });
}
</script></body></html>`;
}


// ---------- 新站保護 ----------
const PROTECTED_API = [
  "/api/member/login",
  "/api/member/send-email-code",
  "/api/member/register",
  "/api/admin/login",
];
const PROTECTED_PAGES = ["/member", "/member/", "/member/register", "/member/register/", "/admin", "/admin/"];

function buildInjectedScript(siteKey) {
  return `<script>(function(){
var SITE_KEY=${JSON.stringify(siteKey)};
var PROTECTED=${JSON.stringify(PROTECTED_API)};
var origFetch=window.fetch.bind(window);
var scriptP=null,widgetId=null,cur=null,box=null;
function loadTs(){
  if(scriptP)return scriptP;
  scriptP=new Promise(function(res,rej){
    var s=document.createElement("script");
    s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async=true;s.onload=function(){res()};s.onerror=function(){rej(new Error("load"))};
    document.head.appendChild(s);
  });
  return scriptP;
}
function ensureBox(){
  if(box)return box;
  box=document.createElement("div");
  box.style.cssText="position:fixed;left:0;right:0;bottom:16px;display:flex;justify-content:center;z-index:2147483647;pointer-events:none";
  var inner=document.createElement("div");inner.style.pointerEvents="auto";box.appendChild(inner);
  document.body.appendChild(box);box.inner=inner;return box;
}
function fetchToken(){
  return loadTs().then(function(){
    return new Promise(function(resolve,reject){
      var t=setTimeout(function(){cur=null;reject(new Error("timeout"))},60000);
      cur={ok:function(x){clearTimeout(t);resolve(x)},fail:function(e){clearTimeout(t);reject(e)}};
      if(widgetId===null){
        widgetId=turnstile.render(ensureBox().inner,{
          sitekey:SITE_KEY,execution:"execute",appearance:"interaction-only",
          callback:function(x){if(cur){var c=cur;cur=null;c.ok(x)}},
          "error-callback":function(){if(cur){var c=cur;cur=null;c.fail(new Error("error"))}},
          "timeout-callback":function(){if(cur){var c=cur;cur=null;c.fail(new Error("timeout"))}}
        });
      }else{turnstile.reset(widgetId)}
      turnstile.execute(widgetId);
    });
  });
}
var pre=null,preP=null;
function preFresh(){return pre&&Date.now()-pre.t<240000}
function prewarm(){
  if(preP||preFresh())return;
  preP=fetchToken().then(function(x){pre={tok:x,t:Date.now()}},function(){}).then(function(){preP=null});
}
function getToken(){
  function take(){var x=pre.tok;pre=null;setTimeout(prewarm,0);return x}
  if(preFresh())return Promise.resolve(take());
  if(preP)return preP.then(function(){return preFresh()?take():fetchToken()});
  return fetchToken();
}
loadTs().catch(function(){});
function start(){setTimeout(prewarm,200)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
window.fetch=function(input,init){
  var url=typeof input==="string"?input:(input&&input.url)||"";
  var path;try{path=new URL(url,location.href).pathname}catch(e){path=url}
  var method=String((init&&init.method)||(input&&input.method)||"GET").toUpperCase();
  if(method==="POST"&&PROTECTED.indexOf(path)>-1){
    return getToken().then(function(tok){
      init=Object.assign({},init);
      var h=new Headers(init.headers||(input&&input.headers)||{});
      h.set("X-Turnstile-Token",tok);init.headers=h;
      return origFetch(input,init);
    },function(){
      return new Response(JSON.stringify({error:"人機驗證未完成或失敗，請重新整理頁面後再試"}),{status:403,headers:{"Content-Type":"application/json"}});
    });
  }
  return origFetch(input,init);
};
})();</script>`;
}

async function checkToken(token, request, env) {
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  return res.json();
}

async function protectNewHost(context, url) {
  const { request, env } = context;
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET) return context.next(); // 未設定 → 不啟用

  // 後端強制：沒有有效 token 的 POST 一律拒絕
  if (request.method === "POST" && PROTECTED_API.includes(url.pathname)) {
    const token = request.headers.get("X-Turnstile-Token");
    if (!token) return json({ error: "缺少人機驗證，請重新整理頁面後再試" }, 403);
    let out;
    try { out = await checkToken(token, request, env); }
    catch { return json({ error: "人機驗證服務暫時無法使用，請稍後再試" }, 503); }
    if (!out.success) return json({ error: "人機驗證未通過，請重新整理頁面後再試", debug: (out["error-codes"] || []).join(",") }, 403);
    return context.next();
  }

  // 前端注入：只在登入/註冊/後台頁面加上驗證腳本
  if (request.method === "GET" && PROTECTED_PAGES.includes(url.pathname)) {
    const res = await context.next();
    const ct = res.headers.get("Content-Type") || "";
    if (!ct.includes("text/html")) return res;
    const script = buildInjectedScript(env.TURNSTILE_SITE_KEY);
    return new HTMLRewriter()
      .on("head", { element(el) { el.append(script, { html: true }); } })
      .transform(res);
  }

  return context.next();
}

async function verify(request, env) {
  if (request.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);
  if (!env.TURNSTILE_SECRET) return json({ success: false, error: "missing_secret" }, 500);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, error: "bad_json" }, 400); }
  const token = body && body.token;
  if (!token || typeof token !== "string") return json({ success: false, error: "missing_token" }, 400);

  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.append("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const out = await res.json();
  return json({ success: !!out.success, codes: out["error-codes"] || [] });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 新網址：登入/註冊/後台加上 Turnstile 保護，其餘交給原本的程式
  if (!isOldHost(url.hostname)) return protectNewHost(context, url);

  // 舊網址
  if (url.pathname === "/api/verify") return verify(request, env);

  if (url.pathname === "/" && request.method === "GET") {
    return new Response(noticePage(env.TURNSTILE_SITE_KEY), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  // 其他路徑（例如舊的付款連結）：保留路徑與參數，直接轉到新網址
  const status = request.method === "GET" || request.method === "HEAD" ? 302 : 307;
  return Response.redirect(NEW_ORIGIN + url.pathname + url.search, status);
}
