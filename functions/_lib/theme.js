// ===== 深色模式（後台 / 會員頁 / 註冊頁 / 付款頁 共用）=====
// 規則：
//  - 第一次進站跟隨裝置的深色/淺色設定；按切換按鈕後以手動選擇為準，存在 localStorage（key: theme）。
//  - <html data-theme="dark|light"> 由 <head> 裡的小腳本在畫面繪製前就設好，避免淺色閃一下。
//  - 深色樣式全部掛在 html[data-theme="dark"] 底下，淺色模式完全沿用原本樣式。
//  - 切換按鈕：未登入／註冊／付款頁在右下角顯示「深色模式／淺色模式」按鈕；
//    後台與會員頁登入後，頁首有同樣功能的按鈕（此時右下角那顆自動隱藏）。

// 放進 <head>：在繪製前決定主題
export const THEME_HEAD = `<script>(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>`;

// 切換按鈕的樣式（四個頁面共用）
const TOGGLE_CSS = `
  html[data-theme="light"]{color-scheme:light;}
  html[data-theme="dark"]{color-scheme:dark;--tg-bg:#232736;--tg-fg:#F2D27A;--tg-bd:#3A3F52;}
  .theme-toggle{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:40;height:42px;padding:0 16px 0 12px;gap:8px;border-radius:21px;border:1px solid var(--tg-bd,#D5D8E0);background:var(--tg-bg,#fff);color:var(--tg-fg,#4B5160);display:flex;align-items:center;justify-content:center;cursor:pointer;font:600 14px/1 -apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.2);}
  .js-theme-toggle svg{width:18px;height:18px;display:block;flex:0 0 auto;}
  .js-theme-toggle .i-sun{display:none;}
  html[data-theme="dark"] .js-theme-toggle .i-sun{display:block;}
  html[data-theme="dark"] .js-theme-toggle .i-moon{display:none;}
  .js-theme-toggle .tg-label{white-space:nowrap;}
  .theme-toggle:focus-visible,.js-theme-toggle:focus-visible{outline:2px solid #5B8CFF;outline-offset:2px;}
  body:has(#appView:not(.hidden)) .theme-toggle{display:none;}
  .btn.js-theme-toggle{display:inline-flex;align-items:center;gap:6px;}`;

const ICONS = `<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

// 放進頁首（後台、會員頁）：沿用原本「btn secondary」外觀，帶文字說明
export const THEME_HEADER_BTN = `<button type="button" class="btn secondary js-theme-toggle" aria-label="切換深色／淺色模式">${ICONS}<span class="tg-label">深色模式</span></button>`;

// 放進 </body> 前：右下角按鈕 + 切換腳本（會綁定頁面上所有 .js-theme-toggle）
export const THEME_TOGGLE_HTML = `<button type="button" class="theme-toggle js-theme-toggle" aria-label="切換深色／淺色模式">${ICONS}<span class="tg-label">深色模式</span></button>
<script>(function(){
  var btns=document.querySelectorAll('.js-theme-toggle'); if(!btns.length) return;
  var root=document.documentElement;
  function cur(){return root.getAttribute('data-theme')==='dark'?'dark':'light';}
  function paint(){
    var d=cur()==='dark';var t=d?'切換為淺色模式':'切換為深色模式';var l=d?'淺色模式':'深色模式';
    for(var i=0;i<btns.length;i++){var b=btns[i];b.setAttribute('aria-label',t);b.title=t;b.setAttribute('aria-pressed',d?'true':'false');var s=b.querySelector('.tg-label');if(s)s.textContent=l;}
  }
  function flip(){var n=cur()==='dark'?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem('theme',n);}catch(e){}paint();}
  for(var i=0;i<btns.length;i++)btns[i].addEventListener('click',flip);
  try{
    var mq=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)');
    if(mq){
      var h=function(e){var s=null;try{s=localStorage.getItem('theme');}catch(_){}if(s!=='light'&&s!=='dark'){root.setAttribute('data-theme',e.matches?'dark':'light');paint();}};
      if(mq.addEventListener)mq.addEventListener('change',h);else if(mq.addListener)mq.addListener(h);
    }
  }catch(e){}
  paint();
})();</script>`;

// ---------- 後台 ----------
export const THEME_CSS_ADMIN = `${TOGGLE_CSS}
  html[data-theme="dark"]{--bg:#12141A;--card:#1B1E27;--border:#2D3140;--text:#E6E8EE;--muted:#9AA1B2;--accent:#5B8CFF;--danger:#F0746C;--ok:#4CC38A;}
  html[data-theme="dark"] input,html[data-theme="dark"] select,html[data-theme="dark"] textarea{background:#12141A;color:var(--text);}
  html[data-theme="dark"] nav button{color:var(--text);}
  html[data-theme="dark"] nav button.active{color:#fff;}
  html[data-theme="dark"] button.btn.secondary{background:transparent;color:var(--accent);border-color:var(--accent);}
  html[data-theme="dark"] .link-box input{background:#12141A;}
  html[data-theme="dark"] .total-row td{background:#222633;}
  html[data-theme="dark"] .modal-box{background:var(--card);color:var(--text);}
  html[data-theme="dark"] .member-picker-input{background:#12141A;color:var(--text);}
  html[data-theme="dark"] .member-picker-input.is-selected{background:#1D2740;}
  html[data-theme="dark"] .member-picker-dropdown{background:var(--card);box-shadow:0 6px 18px rgba(0,0,0,.5);}
  html[data-theme="dark"] .member-picker-option:hover,html[data-theme="dark"] .member-picker-option.active{background:#1D2740;}
  @media (max-width:700px){
    html[data-theme="dark"] table tr{background:var(--card);}
    html[data-theme="dark"] table tr.total-row{background:#222633;}
  }`;

// ---------- 付款頁（原本沒用 CSS 變數，逐項覆蓋）----------
export const THEME_CSS_PAY = `${TOGGLE_CSS}
  html[data-theme="dark"] body{background:#12141A;color:#E6E8EE;}
  html[data-theme="dark"] .card{background:#1B1E27;border-color:#2D3140;}
  html[data-theme="dark"] .row,html[data-theme="dark"] .muted{color:#9AA1B2;}
  html[data-theme="dark"] .methods button{background:transparent;border-color:#5B8CFF;color:#8FB0FF;}
  html[data-theme="dark"] .methods button:hover{background:#1D2740;}
  html[data-theme="dark"] .info-box{background:#242836;}
  html[data-theme="dark"] .error{color:#F0746C;}
  html[data-theme="dark"] .proof-box{border-top-color:#2D3140;}
  html[data-theme="dark"] .proof-box label{color:#9AA1B2;}
  html[data-theme="dark"] .proof-box input[type=text]{background:#12141A;color:#E6E8EE;border-color:#2D3140;}
  html[data-theme="dark"] .proof-box button{background:#4A7BEC;}
  html[data-theme="dark"] .proof-done{background:#14301F;color:#4CC38A;}
  html[data-theme="dark"] a[style*="#6b7280"]{color:#9AA1B2 !important;}
  /* 條碼圖片一律墊白底，透明底的條碼在深色背景上會掃不到 */
  img.barcode{background:#fff;}
  html[data-theme="dark"] img.barcode{border-color:#2D3140;}`;

// ---------- 會員頁 + 註冊頁（同一套設計變數）----------
export const THEME_CSS_PORTAL = `${TOGGLE_CSS}
  html[data-theme="dark"]{--bg:#0F1117;--card:#181B26;--line:#2A2E3D;--ink:#E8EAF2;--muted:#9096AA;
    --accent:#D9A441;--accent-ink:#F0D49A;--accent-soft:#3A2E17;
    --danger:#E5857C;--danger-soft:#3A1E1C;--ok:#5FC79A;--ok-soft:#173326;
    --wait:#E3B35E;--wait-soft:#3A2D12;--neutral:#A3A8BA;--neutral-soft:#262A38;
    --violet:#B3A5EA;--violet-soft:#2A2547;}
  /* --ink 在原設計同時當文字色與深色底（標題列、按鈕），深色模式要另外指定 */
  html[data-theme="dark"] header{background:#0B0D13;}
  html[data-theme="dark"] button.btn{background:var(--accent);color:#1A1306;}
  html[data-theme="dark"] button.btn:hover{background:#E8B955;}
  html[data-theme="dark"] button.btn.secondary{background:transparent;color:var(--ink);border:1px solid var(--line);}
  html[data-theme="dark"] button.btn.secondary:hover{background:var(--neutral-soft);border-color:var(--neutral);}
  html[data-theme="dark"] header button.btn.secondary{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35);}
  html[data-theme="dark"] header button.btn.secondary:hover{background:rgba(255,255,255,.1);border-color:#fff;}
  html[data-theme="dark"] .chip{background:#1F2330;}
  html[data-theme="dark"] .chip.active{background:var(--accent);border-color:var(--accent);color:#1A1306;}
  html[data-theme="dark"] input,html[data-theme="dark"] select{background:#12141C;}
  html[data-theme="dark"] input:focus,html[data-theme="dark"] select:focus{background:#161A24;}
  html[data-theme="dark"] button.btn2{background:#1F2330;}
  html[data-theme="dark"] .quote-result{background:linear-gradient(135deg,var(--accent-soft),#2A2214);}
  html[data-theme="dark"] .quote-result .select-btn{background:var(--accent);color:#1A1306;}
  html[data-theme="dark"] .quote-result .select-btn:hover{background:#E8B955;}
  html[data-theme="dark"] .upd-card{background:linear-gradient(0deg,#181B26,#221C10);}
  html[data-theme="dark"] .upd-count{color:#1A1306;}
  html[data-theme="dark"] .popup{background:var(--card);box-shadow:0 12px 40px rgba(0,0,0,.6);}
  html[data-theme="dark"] .announce-carousel,html[data-theme="dark"] .announce-track img{background:#232736;}
  html[data-theme="dark"] .total-row td{background:#222633;}
  html[data-theme="dark"] .b-pending,html[data-theme="dark"] .b-expired{border-color:#383D50;}
  html[data-theme="dark"] .b-await{border-color:#5A4A22;}
  html[data-theme="dark"] .b-ready{color:#8FA8FF;background:#1C2447;border-color:#2C3A73;}
  html[data-theme="dark"] .b-paid{border-color:#245A40;}
  html[data-theme="dark"] .b-cancel{border-color:#5A302C;}
  html[data-theme="dark"] .b-completed{border-color:#463E75;}
  @media (max-width:700px){
    html[data-theme="dark"] #ord_table tr{background:var(--card);}
  }`;
