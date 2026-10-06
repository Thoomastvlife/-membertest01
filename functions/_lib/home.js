// ===== 首頁（/）=====
// 會員儲值平台入口：即時查價 → 一鍵帶入「自助下單」。
// 想改店名、客服資訊、金額快選，只需要改下面 HOME_CONFIG。
// 注意：這個檔案的 HTML 是放在 JS 樣板字串裡，所以內容裡不要出現「反引號」與「$ 加大括號」，也不要用反斜線。
import { THEME_HEAD, THEME_TOGGLE_HTML, TOGGLE_CSS } from "./theme.js";

export const HOME_CONFIG = {
  shopName: "自助儲值",
  tagline: "選平台、輸入金額，馬上知道可以拿到多少幣",
  amountChips: [200, 300, 500, 1000],
  minAmount: 200,
  maxAmount: 50000,
  contact: "", // 例如："客服時間：週一至週五 09:00–18:00"，留空就不顯示
};

export function homeHtml() {
  const cfgJson = JSON.stringify(HOME_CONFIG).replace(/</g, "\\u003c");
  const name = HOME_CONFIG.shopName;
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/favicon.svg" />
<title>${name}｜首頁</title>
<meta name="description" content="${HOME_CONFIG.tagline}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet">
${THEME_HEAD}
<style>
  :root{
    --bg:#EEF0F6; --card:#fff; --line:#E2E4ED;
    --ink:#181B2E; --muted:#6A6F81;
    --accent:#B8842E; --accent-ink:#54390F; --accent-soft:#F6ECD8;
    --navy:#181B2E; --navy-2:#23274A; --on-navy:#F3F4F9; --on-navy-muted:#A9AEC4;
    --gold:#E7B65A; --ok:#1E7A56; --danger:#B8433A;
    --radius:16px;
  }
  html[data-theme="dark"]{
    --bg:#12141A; --card:#1B1E27; --line:#2D3140;
    --ink:#E6E8EE; --muted:#9AA1B2;
    --accent:#E0A94F; --accent-ink:#F6E3BC; --accent-soft:#2E2615;
    --navy:#0C0E14; --navy-2:#1A1E34;
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;line-height:1.65;-webkit-text-size-adjust:100%}
  a{color:inherit;text-decoration:none}
  button{font:inherit;color:inherit;cursor:pointer}
  :focus-visible{outline:3px solid var(--gold);outline-offset:2px}
  .wrap{max-width:1180px;margin:0 auto;padding:0 20px}
  .num{font-family:"Space Grotesk","Noto Sans TC",sans-serif;font-variant-numeric:tabular-nums}
  ${TOGGLE_CSS}

  /* ---- 頁首 ---- */
  .top{background:var(--navy);color:var(--on-navy);position:sticky;top:0;z-index:30}
  .top .wrap{display:flex;align-items:center;gap:20px;height:60px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:900;font-size:19px;letter-spacing:.02em;white-space:nowrap}
  .brand img{width:32px;height:32px;border-radius:9px}
  .top nav{display:flex;gap:4px;margin-left:12px}
  .top nav a{padding:8px 14px;border-radius:9px;color:var(--on-navy-muted);font-weight:500;font-size:15px}
  .top nav a:hover{background:rgba(255,255,255,.08);color:var(--on-navy)}
  .top .acts{margin-left:auto;display:flex;gap:8px;align-items:center}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid transparent;border-radius:11px;padding:9px 18px;font-weight:700;font-size:15px;line-height:1.2;white-space:nowrap}
  .btn-gold{background:var(--gold);color:#181B2E}
  .btn-gold:hover{filter:brightness(1.06)}
  .btn-ghost{border-color:rgba(255,255,255,.28);color:var(--on-navy)}
  .btn-ghost:hover{background:rgba(255,255,255,.1)}
  .btn-line{border-color:var(--line);background:var(--card);color:var(--ink)}
  .btn-line:hover{border-color:var(--accent)}
  .btn-block{width:100%}

  /* ---- 首屏 ---- */
  .hero{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;margin-top:22px;align-items:stretch}
  .calc{background:linear-gradient(160deg,var(--navy-2),var(--navy));color:var(--on-navy);border-radius:22px;padding:34px 38px 32px;position:relative;overflow:hidden}
  .calc h1{margin:0 0 6px;font-size:clamp(26px,3.4vw,38px);line-height:1.25;font-weight:900;letter-spacing:.01em}
  .calc .sub{margin:0 0 22px;color:var(--on-navy-muted);font-size:16px}
  .lbl{display:block;font-size:14px;color:var(--on-navy-muted);margin:0 0 8px;font-weight:500}
  .seg{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
  .seg input{position:absolute;opacity:0;pointer-events:none}
  .seg label{padding:9px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.22);cursor:pointer;font-weight:700;font-size:15px;transition:background .15s,border-color .15s}
  .seg label:hover{border-color:rgba(255,255,255,.5)}
  .seg input:checked + label{background:var(--gold);border-color:var(--gold);color:#181B2E}
  .seg input:focus-visible + label{outline:3px solid var(--gold);outline-offset:2px}
  .amt{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
  .amt button{padding:9px 18px;border-radius:11px;border:1px solid rgba(255,255,255,.22);background:transparent;font-weight:700;font-size:15px}
  .amt button:hover{border-color:rgba(255,255,255,.5)}
  .amt button[aria-pressed="true"]{background:rgba(231,182,90,.18);border-color:var(--gold);color:var(--gold)}
  .amt-input{display:flex;align-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22);border-radius:11px;padding:0 14px;max-width:260px;margin-bottom:22px}
  .amt-input:focus-within{border-color:var(--gold);box-shadow:0 0 0 3px rgba(231,182,90,.35)}
  .amt-input span{color:var(--on-navy-muted);margin-right:6px}
  .amt-input input{flex:1;min-width:0;background:transparent;border:0;color:var(--on-navy);font:inherit;font-size:20px;font-weight:600;padding:10px 0;font-family:"Space Grotesk",sans-serif}
  .amt-input input:focus-visible{outline:none}
  .result{border-top:1px dashed rgba(255,255,255,.2);padding-top:20px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
  .result .k{font-size:14px;color:var(--on-navy-muted)}
  .result .v{font-size:clamp(44px,7vw,68px);line-height:1.05;font-weight:700;color:var(--gold);letter-spacing:-.01em}
  .result .v small{font-size:.38em;margin-left:8px;color:var(--on-navy);font-weight:500;letter-spacing:0}
  .result .rate{font-size:14px;color:var(--on-navy-muted);margin-top:4px;min-height:1.65em}
  .result .rate.warn{color:#FFB4A8}
  .calc .btn-gold{padding:14px 26px;font-size:17px;border-radius:13px}
  .calc .btn-gold[aria-disabled="true"]{opacity:.45;pointer-events:none}

  /* ---- 會員側欄 ---- */
  .side{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:24px;display:flex;flex-direction:column;gap:14px}
  .side h2{margin:0;font-size:21px;line-height:1.3}
  .side .hint{margin:0;color:var(--muted);font-size:14px}
  .side .row{display:flex;gap:8px;flex-wrap:wrap}
  .pts{background:var(--accent-soft);border-radius:14px;padding:12px 16px}
  .pts .k{font-size:13px;color:var(--accent-ink)}
  .pts .v{font-size:28px;font-weight:700;color:var(--accent-ink);line-height:1.2}
  .perks{list-style:none;margin:6px 0 0;padding:16px 0 0;border-top:1px solid var(--line);display:grid;gap:12px;font-size:14px}
  .perks li{display:flex;gap:12px;align-items:flex-start}
  .perks .ic{flex:none;width:34px;height:34px;border-radius:50%;background:var(--accent-soft);display:grid;place-items:center;font-size:16px}
  .perks b{display:block;font-size:14.5px}
  .perks span.d{color:var(--muted);font-size:13px}

  /* ---- 區塊 ---- */
  section{margin-top:44px}
  .sec-h{display:flex;align-items:baseline;gap:14px;margin:0 0 16px;flex-wrap:wrap}
  .sec-h h2{margin:0;font-size:24px;font-weight:900}
  .sec-h p{margin:0;color:var(--muted);font-size:15px}
  .plat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
  .plat{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:20px;display:flex;flex-direction:column;gap:14px}
  .plat h3{margin:0;font-size:20px;display:flex;align-items:center;gap:10px}
  .plat h3 i{width:34px;height:34px;border-radius:10px;background:var(--navy);color:var(--gold);display:grid;place-items:center;font-style:normal;font-size:15px;font-weight:900}
  .tiers{margin:0;padding:0;list-style:none;font-size:14px;color:var(--muted);display:grid;gap:4px;min-height:48px}
  .tiers li{display:flex;justify-content:space-between;gap:10px}
  .tiers b{color:var(--ink);font-weight:700}
  .quick{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto}
  .quick a{border:1px solid var(--line);border-radius:11px;padding:8px 10px;text-align:center;font-size:14px;line-height:1.35}
  .quick a:hover{border-color:var(--accent);background:var(--accent-soft)}
  .quick a b{display:block;font-size:16px}
  .quick a span{color:var(--muted);font-size:12.5px}
  .steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;counter-reset:s}
  .step{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px 22px;position:relative}
  .step::before{counter-increment:s;content:counter(s);font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:15px;width:30px;height:30px;border-radius:50%;background:var(--navy);color:var(--gold);display:grid;place-items:center;margin-bottom:12px}
  .step h3{margin:0 0 4px;font-size:18px}
  .step p{margin:0;color:var(--muted);font-size:14.5px}
  .loading{color:var(--muted);font-size:14px}
  footer{margin-top:56px;background:var(--navy);color:var(--on-navy-muted);padding:30px 0 90px;font-size:14px}
  footer .wrap{display:flex;gap:24px;flex-wrap:wrap;align-items:center;justify-content:space-between}
  footer a{color:var(--on-navy)}
  footer a:hover{text-decoration:underline}

  @media (max-width:980px){
    .hero{grid-template-columns:1fr}
    .top nav{display:none}
  }
  @media (max-width:600px){
    .wrap{padding:0 14px}
    .calc{padding:26px 20px 24px;border-radius:18px}
    .side{border-radius:18px}
    .brand span{font-size:17px}
    .top .btn{padding:8px 13px;font-size:14px}
    .result{align-items:stretch}
    .calc .btn-gold{width:100%}
  }
  @media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>

<header class="top">
  <div class="wrap">
    <a class="brand" href="/" aria-label="${name} 首頁"><img src="/favicon.svg" alt="" /><span>${name}</span></a>
    <nav aria-label="頁面導覽">
      <a href="#calc">即時查價</a>
      <a href="#rates">各平台費率</a>
      <a href="#steps">下單流程</a>
    </nav>
    <div class="acts" id="topActs">
      <a class="btn btn-ghost" href="/member">登入</a>
      <a class="btn btn-gold" href="/member/register">免費註冊</a>
    </div>
  </div>
</header>

<main class="wrap">
  <div class="hero">
    <div class="calc" id="calc">
      <h1>輸入金額，馬上算出可得幣數</h1>
      <p class="sub">${HOME_CONFIG.tagline}</p>

      <span class="lbl" id="platLbl">儲值平台</span>
      <div class="seg" role="radiogroup" aria-labelledby="platLbl" id="seg"></div>

      <span class="lbl" id="amtLbl">金額</span>
      <div class="amt" id="chips" role="group" aria-labelledby="amtLbl"></div>
      <div class="amt-input"><span class="num">$</span><input id="amt" class="num" type="number" inputmode="numeric" min="${HOME_CONFIG.minAmount}" max="${HOME_CONFIG.maxAmount}" step="1" placeholder="其他金額" aria-label="自訂金額" /></div>

      <div class="result">
        <div aria-live="polite">
          <div class="k">預估可獲得</div>
          <div class="v num" id="coins">—<small>幣</small></div>
          <div class="rate" id="rateLine"></div>
        </div>
        <a class="btn btn-gold" id="go" href="/member" aria-disabled="true">登入並下單</a>
      </div>
    </div>

    <aside class="side" aria-label="會員專區" id="side">
      <h2 id="sideTitle">歡迎回來</h2>
      <p class="hint" id="sideHint">登入後就能直接下單、查看訂單進度。</p>
      <div class="row" id="sideActs">
        <a class="btn btn-gold" href="/member">登入</a>
        <a class="btn btn-line" href="/member/register">免費註冊</a>
      </div>
      <div class="pts" id="pts" hidden><div class="k">我的點數</div><div class="v num" id="ptsV">0</div></div>
      <ul class="perks">
        <li><span class="ic" aria-hidden="true">🎟️</span><span><b>優惠碼</b><span class="d">下單時輸入優惠碼，自動折抵</span></span></li>
        <li><span class="ic" aria-hidden="true">📬</span><span><b>完成通知信</b><span class="d">訂單完成時寄信告訴你</span></span></li>
        <li><span class="ic" aria-hidden="true">🔄</span><span><b>進度即時更新</b><span class="d">會員頁自動刷新訂單狀態</span></span></li>
      </ul>
    </aside>
  </div>

  <section id="rates" aria-labelledby="ratesH">
    <div class="sec-h"><h2 id="ratesH">各平台費率</h2><p>費率依金額分級，以下為目前的最新設定</p></div>
    <div class="plat-grid" id="platGrid"><p class="loading">費率載入中…</p></div>
  </section>

  <section id="steps" aria-labelledby="stepsH">
    <div class="sec-h"><h2 id="stepsH">下單流程</h2></div>
    <div class="steps">
      <div class="step"><h3>選平台與金額</h3><p>在上方查價，確認可獲得的幣數，按「下單」帶入會員頁。</p></div>
      <div class="step"><h3>建立訂單並付款</h3><p>填入平台帳號、建立訂單後，依付款頁的指示在時限內完成付款。</p></div>
      <div class="step"><h3>等待處理並收到通知</h3><p>會員頁會顯示最新進度；勾選通知信的話，完成時會寄信給你。</p></div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <div id="contact"></div>
    <div><a href="/member">會員登入</a>　<a href="/member/register">免費註冊</a></div>
  </div>
</footer>

${THEME_TOGGLE_HTML}

<script>
(function(){
  var CFG = ${cfgJson};
  var PLATS = [
    {key:"tiktok", label:"TikTok", group:"tiktok", mark:"T"},
    {key:"kuaishou", label:"快手", group:"other", mark:"快"},
    {key:"xiaohongshu", label:"小紅書", group:"other", mark:"書"},
    {key:"douyin", label:"陸抖", group:"other", mark:"抖"}
  ];
  var state = {platform:"tiktok", amount:500, rates:null, member:null};
  var $ = function(id){ return document.getElementById(id); };

  function fmt(n){ return Number(n).toLocaleString("en-US", {maximumFractionDigits:2}); }
  function rateFor(groupKey, amount){
    if (!state.rates || !state.rates[groupKey]) return null;
    var rules = state.rates[groupKey].slice().sort(function(a,b){ return b.min - a.min; });
    for (var i = 0; i < rules.length; i++){ if (amount >= rules[i].min) return Number(rules[i].rate); }
    return null;
  }
  function groupOf(key){ for (var i=0;i<PLATS.length;i++){ if (PLATS[i].key===key) return PLATS[i].group; } return "other"; }
  function orderUrl(platform, amount){
    var q = "?platform=" + encodeURIComponent(platform);
    if (amount) q += "&amount=" + encodeURIComponent(amount);
    return "/member" + q;
  }

  /* ---- 平台選擇 ---- */
  var seg = $("seg");
  PLATS.forEach(function(p){
    var id = "p_" + p.key;
    var inp = document.createElement("input");
    inp.type = "radio"; inp.name = "plat"; inp.id = id; inp.value = p.key; inp.checked = (p.key === state.platform);
    var lab = document.createElement("label"); lab.htmlFor = id; lab.textContent = p.label;
    inp.addEventListener("change", function(){ state.platform = p.key; render(); });
    seg.appendChild(inp); seg.appendChild(lab);
  });

  /* ---- 金額快選 ---- */
  var chips = $("chips"), amtInput = $("amt");
  CFG.amountChips.forEach(function(a){
    var b = document.createElement("button");
    b.type = "button"; b.textContent = "$" + a.toLocaleString("en-US"); b.dataset.a = a;
    b.addEventListener("click", function(){ state.amount = a; amtInput.value = ""; render(); });
    chips.appendChild(b);
  });
  amtInput.addEventListener("input", function(){
    var v = parseFloat(amtInput.value);
    state.amount = isNaN(v) ? null : v;
    render();
  });

  /* ---- 重新計算 ---- */
  function render(){
    var amt = state.amount, g = groupOf(state.platform);
    var btns = chips.querySelectorAll("button");
    for (var i=0;i<btns.length;i++){ btns[i].setAttribute("aria-pressed", String(!amtInput.value && Number(btns[i].dataset.a) === amt)); }

    var coinsEl = $("coins"), rateEl = $("rateLine"), go = $("go");
    rateEl.className = "rate";
    var ok = false;
    if (!state.rates){
      coinsEl.innerHTML = "—<small>幣</small>"; rateEl.textContent = "費率載入中…";
    } else if (amt == null){
      coinsEl.innerHTML = "—<small>幣</small>"; rateEl.textContent = "請選擇或輸入金額";
    } else if (amt < CFG.minAmount){
      coinsEl.innerHTML = "—<small>幣</small>"; rateEl.textContent = "金額最低 " + CFG.minAmount + " 元"; rateEl.className = "rate warn";
    } else if (amt > CFG.maxAmount){
      coinsEl.innerHTML = "—<small>幣</small>"; rateEl.textContent = "超過 " + fmt(CFG.maxAmount) + " 元請私訊客服"; rateEl.className = "rate warn";
    } else {
      var r = rateFor(g, amt);
      if (!r){ coinsEl.innerHTML = "—<small>幣</small>"; rateEl.textContent = "目前查不到這個金額的費率"; rateEl.className = "rate warn"; }
      else {
        coinsEl.innerHTML = fmt(amt * r) + "<small>幣</small>";
        rateEl.textContent = "目前費率：每 1 元 " + fmt(r) + " 幣";
        ok = true;
      }
    }
    go.setAttribute("aria-disabled", String(!ok));
    go.href = ok ? orderUrl(state.platform, amt) : "/member";
    go.textContent = state.member ? (ok ? "用 $" + fmt(amt) + " 下單" : "前往下單") : (ok ? "登入並用 $" + fmt(amt) + " 下單" : "登入並下單");
  }

  /* ---- 各平台費率卡 ---- */
  function renderPlatforms(){
    var wrap = $("platGrid");
    wrap.innerHTML = "";
    PLATS.forEach(function(p){
      var card = document.createElement("div"); card.className = "plat";
      var h = document.createElement("h3");
      var i = document.createElement("i"); i.textContent = p.mark; i.setAttribute("aria-hidden","true");
      h.appendChild(i); h.appendChild(document.createTextNode(p.label));
      card.appendChild(h);

      var ul = document.createElement("ul"); ul.className = "tiers";
      var rules = (state.rates && state.rates[p.group]) ? state.rates[p.group].slice().sort(function(a,b){ return a.min - b.min; }) : [];
      if (!rules.length){ var li0 = document.createElement("li"); li0.textContent = "費率暫時無法顯示"; ul.appendChild(li0); }
      rules.forEach(function(r){
        var li = document.createElement("li");
        var a = document.createElement("span"); a.textContent = r.min > 0 ? ("滿 $" + fmt(r.min) + " 起") : "一般金額";
        var b = document.createElement("b"); b.className = "num"; b.textContent = fmt(r.rate) + " 幣／元";
        li.appendChild(a); li.appendChild(b); ul.appendChild(li);
      });
      card.appendChild(ul);

      var q = document.createElement("div"); q.className = "quick";
      CFG.amountChips.forEach(function(a){
        var rate = rateFor(p.group, a);
        var link = document.createElement("a"); link.href = orderUrl(p.key, a);
        var b = document.createElement("b"); b.className = "num"; b.textContent = "$" + a.toLocaleString("en-US");
        var s = document.createElement("span"); s.textContent = rate ? ("約 " + fmt(a * rate) + " 幣") : "查看";
        link.appendChild(b); link.appendChild(s); q.appendChild(link);
      });
      card.appendChild(q);
      wrap.appendChild(card);
    });
  }

  /* ---- 會員狀態 ---- */
  function showMember(me){
    state.member = me;
    $("sideTitle").textContent = (me.name || "會員") + "，你好";
    $("sideHint").textContent = "帳號：" + (me.account || "");
    var acts = $("sideActs"); acts.innerHTML = "";
    var a1 = document.createElement("a"); a1.className = "btn btn-gold"; a1.href = "/member"; a1.textContent = "前往會員中心";
    acts.appendChild(a1);
    var top = $("topActs"); top.innerHTML = "";
    var t1 = document.createElement("a"); t1.className = "btn btn-gold"; t1.href = "/member"; t1.textContent = "會員中心";
    top.appendChild(t1);
    render();
  }
  function loadMember(){
    fetch("/api/member/me", {credentials:"same-origin"}).then(function(r){
      if (!r.ok) return null; return r.json();
    }).then(function(me){
      if (!me || !me.account) return;
      showMember(me);
      return fetch("/api/member/points", {credentials:"same-origin"}).then(function(r){ return r.ok ? r.json() : null; }).then(function(p){
        if (p && (p.earn_enabled || p.discount_enabled || p.shop_enabled)){
          $("ptsV").textContent = fmt(p.balance || 0); $("pts").hidden = false;
        }
      });
    }).catch(function(){});
  }

  /* ---- 費率 ---- */
  function loadRates(){
    fetch("/api/rates").then(function(r){ if(!r.ok) throw new Error(); return r.json(); }).then(function(d){
      state.rates = d.groups || null; renderPlatforms(); render();
    }).catch(function(){
      $("platGrid").innerHTML = "";
      var p = document.createElement("p"); p.className = "loading"; p.textContent = "費率載入失敗，請重新整理頁面。";
      $("platGrid").appendChild(p);
      $("rateLine").textContent = "費率載入失敗，請重新整理頁面"; $("rateLine").className = "rate warn";
    });
  }

  if (CFG.contact){ $("contact").textContent = CFG.contact; } else { $("contact").textContent = "© " + new Date().getFullYear() + " ${name}"; }
  render(); loadRates(); loadMember();
})();
</script>
</body>
</html>`;
}
