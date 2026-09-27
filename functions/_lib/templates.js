export function adminHtml() {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/favicon.svg" />
<title>後台管理系統</title>
<style>
  :root{--bg:#f5f6f8;--card:#fff;--border:#e2e4e8;--text:#1f2430;--muted:#6b7280;--accent:#2f6fed;--danger:#e0453c;--ok:#1f9d55;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;background:var(--bg);color:var(--text);}
  header{background:var(--card);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;justify-content:space-between;align-items:center;}
  header h1{font-size:18px;margin:0;}
  nav{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap;}
  nav button{border:1px solid var(--border);background:var(--card);padding:8px 14px;border-radius:8px 8px 0 0;cursor:pointer;font-size:14px;}
  nav button.active{background:var(--accent);color:#fff;border-color:var(--accent);}
  main{padding:20px;max-width:1000px;margin:0 auto;}
  .card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:18px;margin-bottom:16px;}
  .card h2{margin-top:0;font-size:16px;}
  label{display:block;font-size:13px;color:var(--muted);margin:10px 0 4px;}
  input,select,textarea{width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:6px;font-size:14px;}
  button.btn{background:var(--accent);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:14px;margin-top:12px;}
  button.btn.secondary{background:#fff;color:var(--accent);border:1px solid var(--accent);}
  button.btn.danger{background:var(--danger);}
  button.btn:disabled{opacity:.5;cursor:not-allowed;}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;}
  th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--border);}
  .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;color:#fff;}
  .b-pending{background:#9ca3af;} .b-await{background:#f59e0b;} .b-ready{background:#2f6fed;}
  .b-paid{background:var(--ok);} .b-expired{background:#6b7280;} .b-cancel{background:var(--danger);}
  .b-completed{background:#7c3aed;}
  .msg{font-size:13px;margin-top:8px;}
  .msg.err{color:var(--danger);} .msg.ok{color:var(--ok);}
  .link-box{display:flex;gap:8px;margin-top:10px;}
  .link-box input{flex:1;background:#f0f2f5;}
  .hidden{display:none;}
  #loginView{max-width:360px;margin:80px auto;}
  small.hint{color:var(--muted);}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px;}
  .total-row td{font-weight:700;background:#f8f9fb;}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px;}
  .modal-overlay.hidden{display:none;}
  .modal-box{background:#fff;border-radius:10px;padding:20px;max-width:380px;width:100%;max-height:90vh;overflow:auto;}
  .modal-box h2{margin-top:0;font-size:16px;}
  img.proof-thumb{max-width:56px;max-height:40px;border-radius:4px;border:1px solid var(--border);cursor:pointer;display:block;}
  .filter-row{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:13px;color:var(--muted);}
  button.btn.small{padding:5px 10px;font-size:12px;margin:2px;}

  .member-picker{position:relative;}
  .member-picker-input{width:100%;padding:9px 28px 9px 10px;border:1px solid var(--border);border-radius:6px;font-size:14px;background:#fff;}
  .member-picker-input.is-selected{background:#eef3ff;border-color:var(--accent);}
  .member-picker-clear{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:transparent;color:var(--muted);font-size:16px;line-height:1;cursor:pointer;padding:4px 6px;display:none;}
  .member-picker-clear.show{display:block;}
  .member-picker-dropdown{position:absolute;left:0;right:0;top:calc(100% + 4px);background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.12);max-height:220px;overflow-y:auto;z-index:60;}
  .member-picker-dropdown.hidden{display:none;}
  .member-picker-option{padding:10px 12px;font-size:14px;cursor:pointer;border-bottom:1px solid var(--border);}
  .member-picker-option:last-child{border-bottom:none;}
  .member-picker-option:hover,.member-picker-option.active{background:#eef3ff;}
  .member-picker-option .mp-sub{color:var(--muted);font-size:12px;margin-top:2px;}
  .member-picker-option.mp-nonmember{color:var(--muted);font-style:italic;}
  .member-picker-empty{padding:10px 12px;font-size:13px;color:var(--muted);}

  @media (max-width:700px){
    header{padding:10px 12px;flex-wrap:wrap;gap:8px;}
    header h1{font-size:16px;}
    nav{padding:8px 8px 0;gap:4px;overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;}
    nav button{flex:0 0 auto;padding:8px 12px;font-size:13px;white-space:nowrap;}
    main{padding:10px;}
    .card{padding:12px;border-radius:8px;}
    .grid2{grid-template-columns:1fr;gap:0;}
    input,select,textarea{font-size:16px;}
    .modal-box{padding:14px;border-radius:8px;max-width:100%;}

    table thead{display:none;}
    table, table tbody, table tr, table td{display:block;width:100%;}
    table{border:none;}
    table tr{border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:10px;background:#fff;}
    table tr.total-row{background:#f8f9fb;}
    table td{border-bottom:1px dashed var(--border);padding:6px 2px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 10px;text-align:right;}
    table td:last-child{border-bottom:none;}
    table td::before{content:attr(data-label);font-weight:600;color:var(--muted);text-align:left;flex:0 0 auto;font-size:12px;padding-right:10px;}
    table td:not([data-label])::before{content:none;}
    table td[colspan]{display:block;text-align:center;}
    table td .btn.small{margin:2px 0 2px 6px;}
  }
</style>
</head>
<body>

<div id="loginView" class="card">
  <h2>管理員登入</h2>
  <div id="setupNotice" class="msg hidden"><small class="hint">尚未建立任何管理員帳號，請先設定第一組帳號密碼：</small></div>
  <label>帳號</label>
  <input id="loginUser" />
  <label>密碼</label>
  <input id="loginPass" type="password" />
  <button class="btn" id="loginBtn" onclick="doLogin()">登入</button>
  <div id="loginMsg" class="msg"></div>
</div>

<div id="appView" class="hidden">
  <header>
    <h1>會員結帳後台</h1>
    <div><span id="whoami" style="margin-right:12px;color:var(--muted);font-size:13px;"></span>
      <button class="btn secondary" id="pushBtn" onclick="togglePush()" style="margin-right:8px;">🔔 開啟通知</button>
      <button class="btn secondary" onclick="doLogout()">登出</button></div>
  </header>
  <nav>
    <button data-tab="checkout" onclick="showTab('checkout')">結帳櫃檯</button>
    <button data-tab="orders" onclick="showTab('orders')">訂單列表</button>
    <button data-tab="members" onclick="showTab('members')">會員管理</button>
    <button data-tab="stats" onclick="showTab('stats')">儲值統計</button>
    <button data-tab="settings" onclick="showTab('settings')">付款設定</button>
    <button data-tab="announcement" onclick="showTab('announcement')">系統公告</button>
    <button data-tab="export" onclick="showTab('export')">資料匯出</button>
    <button data-tab="staff" onclick="showTab('staff')">員工帳號</button>
    <button data-tab="rates" onclick="showTab('rates')">費率設定</button>
  </nav>
  <main>

    <section id="tab-checkout" class="tab">
      <div class="card">
        <h2>建立結帳連結</h2>
        <label>金額</label>
        <input id="co_amount" type="number" min="1" step="1" />
        <label>會員</label>
        <div class="member-picker" id="co_member_picker">
          <input type="text" id="co_member_search" class="member-picker-input" placeholder="輸入姓名／帳號／電話搜尋，留空表示非會員" autocomplete="off" />
          <button type="button" class="member-picker-clear" id="co_member_clear" onclick="clearMemberPicker('co')">&times;</button>
          <input type="hidden" id="co_member" value="" />
          <div class="member-picker-dropdown hidden" id="co_member_dropdown"></div>
        </div>
        <div id="co_nonmember_wrap">
          <label>非會員名稱（選填，方便辨識）</label>
          <input id="co_nonmember_name" placeholder="例如：現場客人" />
        </div>
        <label>付款方式（選填，不指定則由前台客人自行選擇）</label>
        <select id="co_method">
          <option value="">-- 不指定 --</option>
          <option value="transfer">轉帳</option>
          <option value="store_barcode">超商條碼</option>
          <option value="taiwan_pay">台灣Pay</option>
        </select>
        <button class="btn" onclick="createOrder()">產生前台連結（3 小時內有效）</button>
        <div id="co_result" class="hidden">
          <div class="link-box">
            <input id="co_link" readonly />
            <button class="btn secondary" onclick="copyLink()">複製</button>
          </div>
        </div>
        <div id="co_msg" class="msg"></div>
      </div>
    </section>

    <section id="tab-orders" class="tab hidden">
      <div class="card">
        <h2>訂單列表</h2>
        <label>月份</label>
        <input id="ord_month" type="month" />
        <button class="btn secondary" onclick="loadOrders()">查詢</button>
        <div class="filter-row">
          <input type="checkbox" id="ord_hide_completed" onchange="renderOrders()" />
          <label for="ord_hide_completed" style="margin:0;">隱藏已結案訂單</label>
        </div>
        <table id="ord_table">
          <thead><tr><th>ID</th><th>建立時間</th><th>會員</th><th>金額</th><th>付款方式</th><th>狀態</th><th>結案</th><th>核對資訊</th><th>操作</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section id="tab-members" class="tab hidden">
      <div class="card">
        <h2>新增會員</h2>
        <div class="grid2">
          <div><label>姓名 *</label><input id="mem_name" /></div>
          <div><label>電話</label><input id="mem_phone" /></div>
        </div>
        <div class="grid2">
          <div><label>帳號（選填）</label><input id="mem_account" /></div>
          <div><label>密碼（選填）</label><input id="mem_password" type="password" /></div>
        </div>
        <label>備註</label><input id="mem_note" />
        <button class="btn" id="mem_submit_btn" onclick="submitMember()">新增</button>
        <button class="btn secondary hidden" id="mem_cancel_btn" onclick="cancelEditMember()">取消編輯</button>
        <div id="mem_msg" class="msg"></div>
      </div>
      <div class="card">
        <h2>會員列表</h2>
        <table id="mem_table">
          <thead><tr><th>ID</th><th>姓名</th><th>帳號</th><th>電話</th><th>備註</th><th>推薦碼</th><th>推薦人</th><th>操作</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section id="tab-stats" class="tab hidden">
      <div class="card">
        <h2>會員儲值統計（依月份，統計已完成付款金額）</h2>
        <label>月份</label>
        <input id="stat_month" type="month" />
        <button class="btn secondary" onclick="loadStats()">查詢</button>
        <table id="stat_table">
          <thead><tr><th>會員 / 客人</th><th>儲值筆數</th><th>儲值金額合計</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section id="tab-settings" class="tab hidden">
      <div class="card">
        <h2>轉帳帳戶設定（客人選「轉帳」時顯示）</h2>
        <label>銀行名稱</label><input id="set_bank_name" />
        <label>帳號</label><input id="set_bank_account" />
        <label>戶名</label><input id="set_bank_holder" />
        <button class="btn" onclick="saveSettings()">儲存</button>
        <div id="set_msg" class="msg"></div>
      </div>
    </section>

    <section id="tab-announcement" class="tab hidden">
      <div class="card">
        <h2>系統公告（會員登入 /member 時彈出）</h2>
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="ann_enabled" style="width:auto;margin:0;" />
          啟用公告彈窗
        </label>
        <label>公告標題（選填）</label>
        <input id="ann_title" placeholder="例如：系統維護通知" maxlength="100" />
        <label>公告類型</label>
        <select id="ann_type" onchange="updateAnnouncementTypeView()">
          <option value="text">文字公告</option>
          <option value="image">圖片輪播</option>
        </select>

        <div id="ann_text_wrap">
          <label>公告內容</label>
          <textarea id="ann_text" rows="5" maxlength="2000" placeholder="輸入要顯示給會員看的公告文字"></textarea>
        </div>

        <div id="ann_image_wrap" class="hidden">
          <label>公告圖片（可上傳多張，將自動輪播；建議單張小於 500KB，最多 10 張）</label>
          <input type="file" id="ann_image_input" accept="image/*" multiple onchange="addAnnouncementImages(this)" />
          <div id="ann_image_list" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;"></div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn" onclick="saveAnnouncement()">儲存</button>
          <button class="btn secondary" onclick="previewAnnouncement()">預覽</button>
        </div>
        <div id="ann_msg" class="msg"></div>
        <small class="hint">會員看過公告後選「今天不再顯示」，當天就不會再彈出；只要這裡重新按「儲存」，不論選過什麼，下次登入都會再顯示一次。</small>
      </div>
    </section>

    <section id="tab-export" class="tab hidden">
      <div class="card">
        <h2>匯出當月資料（CSV，可用 Excel 開啟）</h2>
        <label>月份</label>
        <input id="exp_month" type="month" />
        <button class="btn" onclick="exportCsv()">下載訂單 CSV</button>
      </div>
    </section>

    <section id="tab-staff" class="tab hidden">
      <div class="card">
        <h2>新增員工帳號</h2>
        <small class="hint">員工帳號登入後跟目前帳號權限相同，可以操作整個後台。</small>
        <label>帳號</label><input id="staff_username" autocomplete="off" />
        <label>密碼（至少 6 碼）</label><input id="staff_password" type="password" autocomplete="new-password" />
        <button class="btn" onclick="submitStaff()">新增</button>
        <div id="staff_msg" class="msg"></div>
      </div>
      <div class="card">
        <h2>帳號列表</h2>
        <table id="staff_table">
          <thead><tr><th>ID</th><th>帳號</th><th>建立時間</th><th>操作</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section id="tab-rates" class="tab hidden">
      <div class="card">
        <h2>抖幣費率設定</h2>
        <small class="hint">符合金額 ≥ min 時，套用該 rate。系統會自動由大到小排序。修改後儲存即生效，會員下次登入會看到新費率。</small>
        <div id="rates_list" style="margin-top:14px;"></div>
        <button class="btn secondary" onclick="addRateRow()">➕ 新增一筆</button>
        <button class="btn" onclick="saveRates()">儲存費率</button>
        <button class="btn secondary" onclick="resetRates()">還原預設值</button>
        <div id="rates_msg" class="msg"></div>
      </div>
    </section>

  </main>
</div>

<div id="correctModal" class="modal-overlay hidden">
  <div class="modal-box">
    <h2>更正訂單 #<span id="cor_id"></span></h2>
    <label>金額</label>
    <input id="cor_amount" type="number" min="1" step="1" />
    <label>會員</label>
    <div class="member-picker" id="cor_member_picker">
      <input type="text" id="cor_member_search" class="member-picker-input" placeholder="輸入姓名／帳號／電話搜尋，留空表示非會員" autocomplete="off" />
      <button type="button" class="member-picker-clear" id="cor_member_clear" onclick="clearMemberPicker('cor')">&times;</button>
      <input type="hidden" id="cor_member" value="" />
      <div class="member-picker-dropdown hidden" id="cor_member_dropdown"></div>
    </div>
    <div id="cor_nonmember_wrap">
      <label>非會員名稱</label>
      <input id="cor_nonmember_name" placeholder="例如：現場客人" />
    </div>
    <label>付款方式</label>
    <select id="cor_method">
      <option value="__keep__">-- 不變 --</option>
      <option value="transfer">改為：轉帳</option>
      <option value="store_barcode">改為：超商條碼</option>
      <option value="taiwan_pay">改為：台灣Pay</option>
      <option value="">重設為未選擇（讓客人重新選）</option>
    </select>
    <small class="hint">提醒：變更付款方式會清除已上傳的條碼與付款證明，請確認後再送出。</small>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn" onclick="submitCorrect()">儲存更正</button>
      <button class="btn secondary" onclick="closeCorrect()">取消</button>
    </div>
    <div id="cor_msg" class="msg"></div>
  </div>
</div>

<div id="announcePreviewModal" class="modal-overlay hidden">
  <div class="modal-box" style="max-width:400px;text-align:center;">
    <h2 id="ann_preview_title">公告</h2>
    <div id="ann_preview_body" style="margin-bottom:14px;"></div>
    <button class="btn secondary" onclick="closeAnnouncePreview()">關閉預覽</button>
  </div>
</div>

<script>
const PM_LABEL = {transfer:'轉帳', store_barcode:'超商條碼', taiwan_pay:'台灣Pay'};
const STATUS_LABEL = {
  pending_method:['待選付款方式','b-pending'],
  awaiting_payment:['等待客人付款(轉帳)','b-await'],
  awaiting_barcode:['待上傳條碼','b-await'],
  ready_to_pay:['已可付款(條碼)','b-ready'],
  paid:['已完成付款','b-paid'],
  expired:['已過期','b-expired'],
  cancelled:['已取消','b-cancel'],
};

// === 將 UTC 時間轉為台灣時間 (UTC+8) ===
function toTaipeiTime(dateStr) {
  if (!dateStr) return "";
  const isoStr = String(dateStr).replace(" ", "T") + "Z";
  return new Date(isoStr).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}
// ========================================================

async function api(path, opts={}) {
  const res = await fetch(path, {credentials:'include', headers:{'Content-Type':'application/json'}, ...opts});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || ('錯誤: '+res.status));
  return data;
}

let currentAdminId = null;

async function checkSession(){
  try{
    const me = await api('/api/admin/me');
    currentAdminId = me.id;
    document.getElementById('whoami').textContent = me.username;
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');
    showTab('checkout');
    loadMembersIntoSelect();
    refreshPushButton();
  }catch(e){
    try{
      const s = await api('/api/setup-status');
      if (!s.hasAdmin) document.getElementById('setupNotice').classList.remove('hidden');
    }catch(_){}
  }
}

async function doLogin(){
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const msg = document.getElementById('loginMsg');
  msg.textContent=''; msg.className='msg';
  try{
    const setupNoticeVisible = !document.getElementById('setupNotice').classList.contains('hidden');
    if (setupNoticeVisible) {
      await api('/api/setup-admin', {method:'POST', body: JSON.stringify({username,password})});
    }
    await api('/api/admin/login', {method:'POST', body: JSON.stringify({username,password})});
    checkSession();
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
}

async function doLogout(){
  stopOrdersPolling();
  await api('/api/admin/logout', {method:'POST'});
  location.reload();
}

// ---- 推播通知（Web Push） ----

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getExistingPushSubscription(){
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try{
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  }catch(e){ return null; }
}

async function refreshPushButton(){
  const btn = document.getElementById('pushBtn');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    btn.textContent = '🔕 此瀏覽器不支援通知';
    btn.disabled = true;
    return;
  }
  const sub = await getExistingPushSubscription();
  btn.textContent = sub ? '🔔 通知已開啟' : '🔔 開啟通知';
}

async function togglePush(){
  const btn = document.getElementById('pushBtn');
  const existing = await getExistingPushSubscription();

  if (existing) {
    if (!confirm('確定要關閉這台裝置的訂單通知嗎？')) return;
    try{
      await api('/api/admin/push/unsubscribe', {method:'POST', body: JSON.stringify({endpoint: existing.endpoint})});
      await existing.unsubscribe();
    }catch(e){ alert(e.message); }
    refreshPushButton();
    return;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('此瀏覽器不支援推播通知（iPhone 需先將此網站加入主畫面，用該圖示打開才支援）');
    return;
  }
  try{
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { alert('您拒絕了通知權限，若要開啟請到瀏覽器設定允許此網站的通知'); return; }
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const { publicKey } = await api('/api/admin/push/public-key');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await api('/api/admin/push/subscribe', {method:'POST', body: JSON.stringify(sub.toJSON())});
    refreshPushButton();
  }catch(e){ alert('開啟通知失敗: ' + e.message); }
}

function showTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.add('hidden'));
  document.getElementById('tab-'+name).classList.remove('hidden');
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  if (name==='orders') { loadOrders(); startOrdersPolling(); }
  else { stopOrdersPolling(); }
  if (name==='members') loadMembers();
  if (name==='stats') loadStats();
  if (name==='settings') loadSettings();
  if (name==='announcement') loadAnnouncement();
  if (name==='staff') loadStaff();
  if (name==='rates') loadRates();
}

// ---- 訂單自動更新（輪詢）----
let ordersPollTimer = null;

function startOrdersPolling(){
  stopOrdersPolling();
  ordersPollTimer = setInterval(()=> {
    const tab = document.getElementById('tab-orders');
    const modalOpen = !document.getElementById('correctModal').classList.contains('hidden');
    if (tab && !tab.classList.contains('hidden') && !modalOpen) {
      loadOrders();
    }
  }, 5000);
}

function stopOrdersPolling(){
  if (ordersPollTimer) { clearInterval(ordersPollTimer); ordersPollTimer = null; }
}

let membersCache = [];
let ordersCache = [];
let correctingId = null;
let editingMemberId = null;

async function loadMembersIntoSelect(){
  const list = await api('/api/admin/members');
  membersCache = list;
}

function escapeHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function setupMemberPicker(prefix, onChange){
  const search = document.getElementById(prefix+'_member_search');
  const hidden = document.getElementById(prefix+'_member');
  const dropdown = document.getElementById(prefix+'_member_dropdown');
  const clearBtn = document.getElementById(prefix+'_member_clear');
  let activeIndex = -1;

  function filteredList(q){
    q = (q||'').trim().toLowerCase();
    if (!q) return membersCache;
    return membersCache.filter(m=>
      (m.name||'').toLowerCase().includes(q) ||
      (m.account||'').toLowerCase().includes(q) ||
      (m.phone||'').toLowerCase().includes(q)
    );
  }

  function updateActive(options){
    options.forEach((o,i)=> o.classList.toggle('active', i===activeIndex));
    if (activeIndex>=0 && options[activeIndex]) options[activeIndex].scrollIntoView({block:'nearest'});
  }

  function renderDropdown(q){
    const list = filteredList(q);
    activeIndex = -1;
    let html = '<div class="member-picker-option mp-nonmember" data-id="">-- 非會員 --</div>';
    html += list.length ? list.map(m=>{
      const sub = [m.account?('帳號 '+m.account):'', m.phone||''].filter(Boolean).join(' ・ ');
      return '<div class="member-picker-option" data-id="'+m.id+'" data-name="'+escapeHtml(m.name)+'">'+escapeHtml(m.name)+(sub?'<div class="mp-sub">'+escapeHtml(sub)+'</div>':'')+'</div>';
    }).join('') : '<div class="member-picker-empty">查無符合的會員</div>';
    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
    dropdown.querySelectorAll('.member-picker-option[data-id]').forEach(opt=>{
      opt.addEventListener('mousedown', (e)=>{
        e.preventDefault();
        selectMember(opt.dataset.id, opt.dataset.name || '');
      });
    });
  }

  function closeDropdown(){ dropdown.classList.add('hidden'); }

  function selectMember(id, name){
    hidden.value = id || '';
    search.value = id ? name : '';
    search.classList.toggle('is-selected', !!id);
    clearBtn.classList.toggle('show', !!id);
    closeDropdown();
    if (onChange) onChange(id);
  }

  search.addEventListener('focus', ()=> renderDropdown(search.value));
  search.addEventListener('input', ()=>{
    if (hidden.value){ hidden.value=''; search.classList.remove('is-selected'); clearBtn.classList.remove('show'); if (onChange) onChange(''); }
    renderDropdown(search.value);
  });
  search.addEventListener('blur', ()=>{
    setTimeout(()=>{
      closeDropdown();
      if (!hidden.value) search.value = '';
    }, 150);
  });
  search.addEventListener('keydown', (e)=>{
    if (dropdown.classList.contains('hidden')) return;
    const options = Array.from(dropdown.querySelectorAll('.member-picker-option[data-id]'));
    if (e.key === 'ArrowDown'){ e.preventDefault(); activeIndex = Math.min(activeIndex+1, options.length-1); updateActive(options); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); activeIndex = Math.max(activeIndex-1, -1); updateActive(options); }
    else if (e.key === 'Enter'){ e.preventDefault(); const opt = options[activeIndex] || (options.length===1 ? options[0] : null); if (opt) selectMember(opt.dataset.id, opt.dataset.name); }
    else if (e.key === 'Escape'){ closeDropdown(); }
  });

  return { selectMember, closeDropdown };
}

function clearMemberPicker(prefix){
  const picker = prefix==='co' ? coMemberPicker : corMemberPicker;
  picker.selectMember('', '');
  document.getElementById(prefix+'_member_search').focus();
}

let coMemberPicker, corMemberPicker;

async function createOrder(){
  const amount = parseFloat(document.getElementById('co_amount').value);
  const member_id = document.getElementById('co_member').value || null;
  const non_member_name = document.getElementById('co_nonmember_name').value.trim();
  const payment_method = document.getElementById('co_method').value || null;
  const msg = document.getElementById('co_msg');
  msg.textContent=''; msg.className='msg';
  if (!amount || amount<=0){ msg.textContent='請輸入正確金額'; msg.className='msg err'; return; }
  try{
    const r = await api('/api/admin/orders', {method:'POST', body: JSON.stringify({amount, member_id, non_member_name, payment_method})});
    document.getElementById('co_result').classList.remove('hidden');
    document.getElementById('co_link').value = r.link;
    msg.textContent = '連結已建立，3 小時內有效'; msg.className='msg ok';
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
}

function copyLink(){
  const el = document.getElementById('co_link');
  el.select(); document.execCommand('copy');
}

async function loadOrders(){
  const monthInput = document.getElementById('ord_month');
  if (!monthInput.value) monthInput.value = new Date().toISOString().slice(0,7);
  const month = monthInput.value;
  ordersCache = await api('/api/admin/orders?month='+encodeURIComponent(month));
  renderOrders();
}

function renderOrders(){
  const hideCompleted = document.getElementById('ord_hide_completed').checked;
  const tbody = document.querySelector('#ord_table tbody');
  const list = hideCompleted ? ordersCache.filter(o=>!o.is_completed) : ordersCache;
  tbody.innerHTML = list.map(o=>{
    const st = STATUS_LABEL[o.status] || [o.status,'b-pending'];
    let actions = '';
    actions += \`<button class="btn secondary small" onclick="viewLink('\${o.token}')">查看連結</button>\`;
    if (o.payment_method==='store_barcode' || o.payment_method==='taiwan_pay') {
      if (o.status==='awaiting_barcode' || o.status==='ready_to_pay') {
        actions += \`<input type="file" accept="image/*" style="width:120px" onchange="uploadBarcode(\${o.id}, this)"/> \`;
      }
    }
    if (o.status!=='paid' && o.status!=='cancelled' && o.status!=='expired') {
      actions += \`<button class="btn secondary small" onclick="markPaid(\${o.id})">標記已付款</button>\`;
      actions += \`<button class="btn danger small" onclick="cancelOrder(\${o.id})">取消</button>\`;
    }
    if (o.status!=='cancelled' && !o.is_completed) {
      actions += \`<button class="btn secondary small" onclick="openCorrect(\${o.id})">更正</button>\`;
    }
    if (o.status==='paid' && !o.is_completed) {
      actions += \`<button class="btn small" onclick="completeOrder(\${o.id})">訂單完成</button>\`;
    }
    if (o.is_completed) {
      actions += \`<button class="btn secondary small" onclick="uncompleteOrder(\${o.id})">取消結案</button>\`;
    }
    actions += \`<button class="btn danger small" onclick="deleteOrder(\${o.id}, \${o.status==='paid'})">刪除</button>\`;

    let proofInfo = '';
    if (o.proof_last_digits) proofInfo += \`末碼 \${o.proof_last_digits}<br/>\`;
    if (o.proof_image) proofInfo += \`<img class="proof-thumb" src="\${o.proof_image}" onclick="viewProof(\${o.id})" />\`;
    if (!proofInfo) proofInfo = '<span class="muted" style="color:var(--muted)">-</span>';

    return \`<tr>
      <td data-label="ID">\${o.id}</td>
      <td data-label="建立時間">\${toTaipeiTime(o.created_at)}</td>
      <td data-label="會員">\${o.member_name_snapshot}</td>
      <td data-label="金額">$\${o.amount}</td>
      <td data-label="付款方式">\${PM_LABEL[o.payment_method]||'尚未選擇'}</td>
      <td data-label="狀態"><span class="badge \${st[1]}">\${st[0]}</span></td>
      <td data-label="結案">\${o.is_completed ? '<span class="badge b-completed">已結案</span>' : ''}</td>
      <td data-label="核對資訊">\${proofInfo}</td>
      <td data-label="操作">\${actions}</td>
    </tr>\`;
  }).join('') || '<tr><td colspan="9">本月尚無訂單</td></tr>';
}

function viewLink(token){
  const link = location.origin + '/pay/' + token;
  prompt('付款連結（Ctrl+C 複製，到期時間仍是建立當下算起 3 小時，不會因為查看而改變）：', link);
}

async function deleteOrder(id, isPaid){
  const warn = isPaid
    ? '這筆訂單已經付款完成，刪除後月報表和儲值統計都會少這一筆，且無法復原，確定要刪除嗎？'
    : '確定要永久刪除此訂單嗎？此動作無法復原（如果只是想讓訂單失效，用「取消」即可，記錄還會保留）。';
  if (!confirm(warn)) return;
  try{
    await api('/api/admin/orders/'+id, {method:'DELETE'});
    loadOrders();
  }catch(e){ alert(e.message); }
}

function viewProof(id){
  const o = ordersCache.find(x=>x.id===id);
  if (!o || !o.proof_image) return;
  const w = window.open('');
  if (w) w.document.write('<img src="'+o.proof_image+'" style="max-width:100%">');
}

function openCorrect(id){
  const o = ordersCache.find(x=>x.id===id);
  if (!o) return;
  correctingId = id;
  document.getElementById('cor_id').textContent = id;
  document.getElementById('cor_amount').value = o.amount;
  const member = o.member_id ? membersCache.find(m=>m.id===o.member_id) : null;
  corMemberPicker.selectMember(o.member_id || '', member ? member.name : '');
  document.getElementById('cor_nonmember_name').value = o.member_id ? '' : o.member_name_snapshot;
  document.getElementById('cor_method').value = '__keep__';
  document.getElementById('cor_msg').textContent = '';
  document.getElementById('correctModal').classList.remove('hidden');
}

function closeCorrect(){
  document.getElementById('correctModal').classList.add('hidden');
  correctingId = null;
}

async function submitCorrect(){
  const msg = document.getElementById('cor_msg');
  const amount = parseFloat(document.getElementById('cor_amount').value);
  if (!amount || amount<=0){ msg.textContent='請輸入正確金額'; msg.className='msg err'; return; }
  const memberSel = document.getElementById('cor_member');
  const body = { amount, member_id: memberSel.value || null };
  if (!memberSel.value) body.non_member_name = document.getElementById('cor_nonmember_name').value.trim();
  const methodVal = document.getElementById('cor_method').value;
  if (methodVal !== '__keep__') body.payment_method = methodVal;
  try{
    await api('/api/admin/orders/'+correctingId, {method:'PATCH', body: JSON.stringify(body)});
    closeCorrect();
    loadOrders();
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
}

async function completeOrder(id){
  if (!confirm('確定將此訂單標記為「訂單完成」？（只是結案標記，方便篩選，不影響金流）')) return;
  try{ await api('/api/admin/orders/'+id+'/complete', {method:'POST'}); loadOrders(); }
  catch(e){ alert(e.message); }
}

async function uncompleteOrder(id){
  try{ await api('/api/admin/orders/'+id+'/uncomplete', {method:'POST'}); loadOrders(); }
  catch(e){ alert(e.message); }
}

async function uploadBarcode(orderId, input){
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      await api('/api/admin/orders/'+orderId+'/barcode', {method:'POST', body: JSON.stringify({image_base64: reader.result})});
      loadOrders();
    }catch(e){ alert(e.message); }
  };
  reader.readAsDataURL(file);
}

async function markPaid(id){
  if (!confirm('確定標記為已付款？')) return;
  await api('/api/admin/orders/'+id+'/mark-paid', {method:'POST'});
  loadOrders();
}
async function cancelOrder(id){
  if (!confirm('確定取消此訂單？')) return;
  await api('/api/admin/orders/'+id+'/cancel', {method:'POST'});
  loadOrders();
}

async function loadMembers(){
  const list = await api('/api/admin/members');
  const tbody = document.querySelector('#mem_table tbody');
  tbody.innerHTML = list.map(m=>\`<tr>
    <td data-label="ID">\${m.id}</td><td data-label="姓名">\${m.name}</td><td data-label="帳號">\${m.account||''}</td><td data-label="電話">\${m.phone||''}</td><td data-label="備註">\${m.note||''}</td>
    <td data-label="推薦碼"><code>\${m.referral_code||''}</code> <button class="btn secondary small" onclick="copyReferralLink('\${m.referral_code}')">複製邀請連結</button></td>
    <td data-label="推薦人">\${m.referred_by_name||'-'}</td>
    <td data-label="操作">
      <button class="btn secondary small" onclick="editMember(\${m.id})">編輯</button>
      <button class="btn secondary small" onclick="resetPassword(\${m.id})">設定密碼</button>
      <button class="btn danger small" onclick="deleteMember(\${m.id})">刪除</button>
    </td>
  </tr>\`).join('') || '<tr><td colspan="8">尚無會員</td></tr>';
  loadMembersIntoSelect();
}

function copyReferralLink(code){
  if (!code) { alert('此會員尚無推薦碼'); return; }
  const link = location.origin + '/member/register?code=' + encodeURIComponent(code);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(()=>alert('邀請連結已複製：\\n'+link)).catch(()=>prompt('複製失敗，請手動複製：', link));
  } else {
    prompt('請手動複製邀請連結：', link);
  }
}

async function resetPassword(id){
  const pw = prompt('請輸入新密碼（至少 6 碼）：');
  if (!pw) return;
  try{
    await api('/api/admin/members/'+id+'/password', {method:'POST', body: JSON.stringify({password: pw})});
    alert('已更新密碼');
  }catch(e){ alert(e.message); }
}

function editMember(id){
  const m = membersCache.find(x=>x.id===id);
  if (!m) return;
  editingMemberId = id;
  document.getElementById('mem_name').value = m.name || '';
  document.getElementById('mem_phone').value = m.phone || '';
  document.getElementById('mem_note').value = m.note || '';
  document.getElementById('mem_account').value = m.account || '';
  document.getElementById('mem_password').value = '';
  document.getElementById('mem_password').placeholder = '不填則不變更密碼';
  document.getElementById('mem_submit_btn').textContent = '儲存修改';
  document.getElementById('mem_cancel_btn').classList.remove('hidden');
  document.getElementById('mem_msg').textContent = '正在編輯：' + m.name;
  document.getElementById('mem_msg').className = 'msg';
  document.getElementById('mem_name').scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelEditMember(){
  editingMemberId = null;
  document.getElementById('mem_name').value='';
  document.getElementById('mem_phone').value='';
  document.getElementById('mem_note').value='';
  document.getElementById('mem_account').value='';
  document.getElementById('mem_password').value='';
  document.getElementById('mem_password').placeholder = '';
  document.getElementById('mem_submit_btn').textContent = '新增';
  document.getElementById('mem_cancel_btn').classList.add('hidden');
  document.getElementById('mem_msg').textContent = '';
}

async function submitMember(){
  const name = document.getElementById('mem_name').value.trim();
  const phone = document.getElementById('mem_phone').value.trim();
  const note = document.getElementById('mem_note').value.trim();
  const account = document.getElementById('mem_account').value.trim();
  const password = document.getElementById('mem_password').value;
  const msg = document.getElementById('mem_msg');
  if (!name){ msg.textContent='請輸入姓名'; msg.className='msg err'; return; }
  try{
    if (editingMemberId){
      await api('/api/admin/members/'+editingMemberId, {method:'PATCH', body: JSON.stringify({name,phone,note,account})});
      if (password) await api('/api/admin/members/'+editingMemberId+'/password', {method:'POST', body: JSON.stringify({password})});
      msg.textContent='已儲存修改'; msg.className='msg ok';
      cancelEditMember();
    } else {
      await api('/api/admin/members', {method:'POST', body: JSON.stringify({name,phone,note,account,password})});
      document.getElementById('mem_name').value='';
      document.getElementById('mem_phone').value='';
      document.getElementById('mem_note').value='';
      document.getElementById('mem_account').value='';
      document.getElementById('mem_password').value='';
      msg.textContent='已新增'; msg.className='msg ok';
    }
    loadMembers();
  }catch(e){ msg.textContent=e.message; msg.className='msg err'; }
}

async function deleteMember(id){
  if (!confirm('確定刪除此會員？')) return;
  await api('/api/admin/members/'+id, {method:'DELETE'});
  loadMembers();
}

async function loadStaff(){
  const list = await api('/api/admin/staff');
  const tbody = document.querySelector('#staff_table tbody');
  tbody.innerHTML = list.map(s=>{
    const isSelf = s.id === currentAdminId;
    return \`<tr>
      <td data-label="ID">\${s.id}</td><td data-label="帳號">\${s.username}\${isSelf?'（目前登入）':''}</td><td data-label="建立時間">\${toTaipeiTime(s.created_at)}</td>
      <td data-label="操作">
        <button class="btn secondary small" onclick="resetStaffPassword(\${s.id})">重設密碼</button>
        <button class="btn danger small" \${isSelf?'disabled':''} onclick="deleteStaff(\${s.id})">刪除</button>
      </td>
    </tr>\`;
  }).join('') || '<tr><td colspan="4">尚無帳號</td></tr>';
}

async function submitStaff(){
  const username = document.getElementById('staff_username').value.trim();
  const password = document.getElementById('staff_password').value;
  const msg = document.getElementById('staff_msg');
  if (!username){ msg.textContent='請輸入帳號'; msg.className='msg err'; return; }
  try{
    await api('/api/admin/staff', {method:'POST', body: JSON.stringify({username,password})});
    document.getElementById('staff_username').value='';
    document.getElementById('staff_password').value='';
    msg.textContent='已新增'; msg.className='msg ok';
    loadStaff();
  }catch(e){ msg.textContent=e.message; msg.className='msg err'; }
}

async function resetStaffPassword(id){
  const pw = prompt('請輸入新密碼（至少 6 碼）：');
  if (!pw) return;
  try{
    await api('/api/admin/staff/'+id+'/password', {method:'POST', body: JSON.stringify({password: pw})});
    alert('已更新密碼');
  }catch(e){ alert(e.message); }
}

async function deleteStaff(id){
  if (!confirm('確定刪除此帳號？')) return;
  try{
    await api('/api/admin/staff/'+id, {method:'DELETE'});
    loadStaff();
  }catch(e){ alert(e.message); }
}

async function loadStats(){
  const monthInput = document.getElementById('stat_month');
  if (!monthInput.value) monthInput.value = new Date().toISOString().slice(0,7);
  const month = monthInput.value;
  const list = await api('/api/admin/stats/monthly?month='+encodeURIComponent(month));
  const tbody = document.querySelector('#stat_table tbody');
  let total = 0, totalCount = 0;
  const rows = list.map(r=>{
    total += r.total; totalCount += r.count;
    return \`<tr><td data-label="會員 / 客人">\${r.member_name}</td><td data-label="儲值筆數">\${r.count}</td><td data-label="儲值金額合計">$\${r.total}</td></tr>\`;
  }).join('');
  tbody.innerHTML = (rows || '<tr><td colspan="3">本月尚無儲值紀錄</td></tr>') +
    \`<tr class="total-row"><td data-label="會員 / 客人">合計</td><td data-label="儲值筆數">\${totalCount}</td><td data-label="儲值金額合計">$\${total}</td></tr>\`;
}

async function loadSettings(){
  const s = await api('/api/admin/settings');
  document.getElementById('set_bank_name').value = s.bank_name || '';
  document.getElementById('set_bank_account').value = s.bank_account_number || '';
  document.getElementById('set_bank_holder').value = s.bank_account_holder || '';
}

async function saveSettings(){
  const msg = document.getElementById('set_msg');
  try{
    await api('/api/admin/settings', {method:'POST', body: JSON.stringify({
      bank_name: document.getElementById('set_bank_name').value.trim(),
      bank_account_number: document.getElementById('set_bank_account').value.trim(),
      bank_account_holder: document.getElementById('set_bank_holder').value.trim(),
    })});
    msg.textContent='已儲存'; msg.className='msg ok';
  }catch(e){ msg.textContent=e.message; msg.className='msg err'; }
}

// ---- 系統公告 ----
let annImages = [];

function updateAnnouncementTypeView(){
  const isImage = document.getElementById('ann_type').value === 'image';
  document.getElementById('ann_text_wrap').classList.toggle('hidden', isImage);
  document.getElementById('ann_image_wrap').classList.toggle('hidden', !isImage);
}

function renderAnnouncementImageList(){
  const wrap = document.getElementById('ann_image_list');
  wrap.innerHTML = annImages.map((src, i) => \`
    <div style="position:relative;">
      <img src="\${src}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--border);display:block;">
      <button type="button" onclick="removeAnnouncementImage(\${i})" title="移除" style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px;line-height:1;">✖</button>
      \${i>0 ? \`<button type="button" onclick="moveAnnouncementImage(\${i},-1)" title="往前移" style="position:absolute;bottom:-6px;left:-6px;background:#fff;border:1px solid var(--border);border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px;line-height:1;">◀</button>\` : ''}
      \${i<annImages.length-1 ? \`<button type="button" onclick="moveAnnouncementImage(\${i},1)" title="往後移" style="position:absolute;bottom:-6px;right:-6px;background:#fff;border:1px solid var(--border);border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px;line-height:1;">▶</button>\` : ''}
    </div>
  \`).join('') || '<small class="hint">尚未上傳任何圖片</small>';
}

function removeAnnouncementImage(i){
  annImages.splice(i,1);
  renderAnnouncementImageList();
}

function moveAnnouncementImage(i, dir){
  const j = i + dir;
  if (j < 0 || j >= annImages.length) return;
  [annImages[i], annImages[j]] = [annImages[j], annImages[i]];
  renderAnnouncementImageList();
}

function addAnnouncementImages(input){
  const files = Array.from(input.files || []);
  if (files.length === 0) return;
  let remaining = files.length;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      if (annImages.length < 10) annImages.push(reader.result);
      remaining--;
      if (remaining === 0) { renderAnnouncementImageList(); input.value = ''; }
    };
    reader.readAsDataURL(file);
  });
}

async function loadAnnouncement(){
  const msg = document.getElementById('ann_msg');
  msg.textContent = ''; msg.className = 'msg';
  try{
    const a = await api('/api/admin/announcement');
    document.getElementById('ann_enabled').checked = !!a.enabled;
    document.getElementById('ann_title').value = a.title || '';
    document.getElementById('ann_type').value = a.type === 'image' ? 'image' : 'text';
    document.getElementById('ann_text').value = a.text || '';
    annImages = Array.isArray(a.images) ? a.images.slice() : [];
    renderAnnouncementImageList();
    updateAnnouncementTypeView();
  }catch(e){ msg.textContent = e.message; msg.className = 'msg err'; }
}

async function saveAnnouncement(){
  const msg = document.getElementById('ann_msg');
  msg.textContent = ''; msg.className = 'msg';
  const type = document.getElementById('ann_type').value;
  try{
    await api('/api/admin/announcement', {method:'POST', body: JSON.stringify({
      enabled: document.getElementById('ann_enabled').checked,
      type,
      title: document.getElementById('ann_title').value.trim(),
      text: document.getElementById('ann_text').value,
      images: annImages,
    })});
    msg.textContent = '已儲存，會員下次登入會看到最新公告'; msg.className = 'msg ok';
  }catch(e){ msg.textContent = e.message; msg.className = 'msg err'; }
}

function previewAnnouncement(){
  const type = document.getElementById('ann_type').value;
  const title = document.getElementById('ann_title').value.trim() || '公告';
  document.getElementById('ann_preview_title').textContent = title;
  const body = document.getElementById('ann_preview_body');
  if (type === 'image') {
    if (annImages.length === 0) {
      body.innerHTML = '<small class="hint">尚未上傳圖片</small>';
    } else {
      body.innerHTML = \`<img src="\${annImages[0]}" style="width:100%;max-height:280px;object-fit:contain;border-radius:8px;background:#f4f4f4;">\` +
        (annImages.length > 1 ? \`<div style="margin-top:8px;font-size:12px;color:var(--muted);">共 \${annImages.length} 張，會員畫面會自動輪播</div>\` : '');
    }
  } else {
    const text = document.getElementById('ann_text').value.trim();
    body.innerHTML = \`<p style="white-space:pre-wrap;text-align:left;font-size:14px;">\${text ? text.replace(/</g,'&lt;') : '（尚未輸入公告內容）'}</p>\`;
  }
  document.getElementById('announcePreviewModal').classList.remove('hidden');
}

function closeAnnouncePreview(){
  document.getElementById('announcePreviewModal').classList.add('hidden');
}

function exportCsv(){
  const month = document.getElementById('exp_month').value || new Date().toISOString().slice(0,7);
  window.location.href = '/api/admin/export?month='+encodeURIComponent(month);
}

// ---- 費率設定 ----

let rateRows = [];

async function loadRates() {
  const msg = document.getElementById('rates_msg');
  msg.textContent = '';
  try {
    const data = await api('/api/admin/rates');
    rateRows = data.rules || [];
    renderRateRows();
  } catch (e) {
    msg.textContent = e.message; msg.className = 'msg err';
  }
}

function renderRateRows() {
  const container = document.getElementById('rates_list');
  if (!rateRows.length) {
    container.innerHTML = '<div class="msg">尚無費率，請點「新增一筆」</div>';
    return;
  }
  container.innerHTML = rateRows.map((r, i) => \`
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
      <span style="min-width:80px;font-size:13px;color:var(--muted);">金額 ≥</span>
      <input type="number" value="\${r.min}" onchange="updateRate(\${i},'min',this.value)" style="max-width:140px;">
      <span style="font-size:13px;color:var(--muted);">→ 匯率</span>
      <input type="number" step="0.001" value="\${r.rate}" onchange="updateRate(\${i},'rate',this.value)" style="max-width:120px;">
      <button class="btn danger small" onclick="removeRate(\${i})">刪除</button>
    </div>
  \`).join('');
}

function updateRate(index, field, value) {
  const num = parseFloat(value);
  if (isNaN(num)) return;
  rateRows[index][field] = num;
}

function removeRate(index) {
  rateRows.splice(index, 1);
  renderRateRows();
}

function addRateRow() {
  rateRows.push({ min: 0, rate: 1.0 });
  renderRateRows();
}

async function saveRates() {
  const msg = document.getElementById('rates_msg');
  msg.textContent = '';
  if (!rateRows.length) {
    msg.textContent = '至少需要一筆費率'; msg.className = 'msg err'; return;
  }
  try {
    await api('/api/admin/rates', {method:'POST', body: JSON.stringify({rules: rateRows})});
    msg.textContent = '已儲存，會員下次登入即生效'; msg.className = 'msg ok';
    loadRates();
  } catch (e) { msg.textContent = e.message; msg.className = 'msg err'; }
}

async function resetRates() {
  if (!confirm('確定還原成程式預設的費率嗎？此動作會覆蓋資料庫目前的設定。')) return;
  const msg = document.getElementById('rates_msg');
  try {
    rateRows = [
      { min: 0, rate: 2.500 }
    ];
    renderRateRows();
    await api('/api/admin/rates', {method:'POST', body: JSON.stringify({rules: rateRows})});
    msg.textContent = '已還原預設值'; msg.className = 'msg ok';
  } catch (e) { msg.textContent = e.message; msg.className = 'msg err'; }
}

coMemberPicker = setupMemberPicker('co', (id)=>{ document.getElementById('co_nonmember_wrap').style.display = id ? 'none':'block'; });
corMemberPicker = setupMemberPicker('cor', (id)=>{ document.getElementById('cor_nonmember_wrap').style.display = id ? 'none':'block'; });
checkSession();
</script>
</body>
</html>`;
}

export function payHtml() {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/favicon.svg" />
<title>付款頁面</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0;font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;background:#f5f6f8;color:#1f2430;
    display:flex;justify-content:center;padding:24px 14px;}
  .card{background:#fff;border:1px solid #e2e4e8;border-radius:12px;padding:24px;max-width:420px;width:100%;}
  h1{font-size:18px;margin-top:0;}
  .amount{font-size:32px;font-weight:700;text-align:center;margin:14px 0;}
  .row{display:flex;justify-content:space-between;font-size:14px;color:#6b7280;margin:6px 0;}
  .methods{display:flex;flex-direction:column;gap:10px;margin-top:16px;}
  .methods button{padding:14px;border-radius:8px;border:1px solid #2f6fed;background:#fff;color:#2f6fed;font-size:15px;cursor:pointer;}
  .methods button:hover{background:#eef3ff;}
  .info-box{background:#f0f2f5;border-radius:8px;padding:14px;margin-top:16px;font-size:14px;line-height:1.8;}
  img.barcode{max-width:100%;margin-top:12px;border:1px solid #e2e4e8;border-radius:8px;}
  .center{text-align:center;}
  .muted{color:#6b7280;font-size:13px;}
  .error{color:#e0453c;text-align:center;margin-top:40px;}
  .badge-paid{background:#1f9d55;color:#fff;padding:6px 14px;border-radius:20px;display:inline-block;}
  .proof-box{margin-top:16px;border-top:1px dashed #e2e4e8;padding-top:14px;}
  .proof-box label{display:block;font-size:13px;color:#6b7280;margin:8px 0 4px;}
  .proof-box input[type=text]{width:100%;padding:9px 10px;border:1px solid #e2e4e8;border-radius:6px;font-size:14px;box-sizing:border-box;}
  .proof-box button{width:100%;margin-top:10px;padding:10px;border-radius:8px;border:none;background:#2f6fed;color:#fff;font-size:14px;cursor:pointer;}
  .proof-done{background:#eef9f0;color:#1f9d55;border-radius:8px;padding:10px;margin-top:14px;font-size:13px;text-align:center;}
</style>
</head>
<body>
<div class="card" id="app">載入中...</div>
<script>
const token = location.pathname.split('/').pop();
const PM_LABEL = {transfer:'轉帳', store_barcode:'超商條碼', taiwan_pay:'台灣Pay'};
let pollTimer=null;

// === 將 UTC 時間轉為台灣時間 (UTC+8) ===
function toTaipeiTime(dateStr) {
  if (!dateStr) return "";
  const isoStr = String(dateStr).replace(" ", "T") + "Z";
  return new Date(isoStr).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}
// ========================================================

async function load(){
  const app = document.getElementById('app');
  try{
    const res = await fetch('/api/order/'+token);
    if (!res.ok){
      const d = await res.json().catch(()=>({}));
      app.innerHTML = '<div class="error">'+(d.error||'找不到此訂單')+'</div>';
      return;
    }
    const o = await res.json();
    render(o);
  }catch(e){
    app.innerHTML = '<div class="error">連線發生問題，請重新整理</div>';
  }
}

const PROOF_ELIGIBLE = ['transfer', 'store_barcode'];

function render(o){
  const app = document.getElementById('app');
  let html = '<h1>付款資訊</h1>';
  html += '<div class="amount">$'+o.amount+'</div>';
  html += '<div class="row"><span>付款對象</span><span>'+o.member_name_snapshot+'</span></div>';

  if (o.status === 'expired') {
    if (pollTimer){ clearInterval(pollTimer); pollTimer=null; }
    html += '<div class="error">此連結已過期，請聯絡店家重新開通</div>';
    app.innerHTML = html; return;
  }
  if (o.status === 'cancelled') {
    if (pollTimer){ clearInterval(pollTimer); pollTimer=null; }
    html += '<div class="error">此訂單已取消</div>';
    app.innerHTML = html; return;
  }
  if (o.status === 'paid') {
    if (pollTimer){ clearInterval(pollTimer); pollTimer=null; }
    html += '<div class="center" style="margin-top:20px;"><span class="badge-paid">已完成付款，謝謝您</span></div>';
    app.innerHTML = html; return;
  }

  if (!pollTimer) pollTimer = setInterval(load, 5000);

  html += '<div class="row"><span>到期時間</span><span>'+toTaipeiTime(o.expires_at)+'</span></div>';

  if (!o.payment_method) {
    html += '<div class="muted" style="margin-top:14px;">請選擇付款方式（選擇後將無法變更）</div>';
    html += '<div class="methods">'+
      '<button onclick="selectMethod(\\'transfer\\')">轉帳</button>'+
      '<button onclick="selectMethod(\\'store_barcode\\')">超商條碼</button>'+
      '<button onclick="selectMethod(\\'taiwan_pay\\')">台灣Pay</button>'+
    '</div>';
    app.innerHTML = html;
    return;
  }

  html += '<div class="row"><span>付款方式</span><span>'+PM_LABEL[o.payment_method]+'</span></div>';

  if (o.payment_method === 'transfer') {
    html += '<div class="info-box">'+
      '銀行：'+(o.bank_name||'')+'<br/>'+
      '帳號：'+(o.bank_account_number||'')+'<br/>'+
      '戶名：'+(o.bank_account_holder||'')+
    '</div>';
    html += '<div class="muted" style="margin-top:10px;">完成轉帳後請通知店家核對款項</div>';
  } else {
    if (o.status === 'awaiting_barcode') {
      html += '<div class="info-box center">店家正在準備付款條碼，請稍候（頁面會自動更新）</div>';
    } else if (o.status === 'ready_to_pay' && o.barcode_image) {
      html += '<div class="center"><img class="barcode" src="'+o.barcode_image+'" /></div>';
      html += '<div class="muted center" style="margin-top:8px;">請出示以上條碼給店家掃描付款</div>';
    }
  }

  if (PROOF_ELIGIBLE.includes(o.payment_method)) {
    html += renderProofBox(o);
  }

  app.innerHTML = html;
  const fileInput = document.getElementById('proof_file');
  if (fileInput) fileInput.onchange = ()=> uploadProof();
}

function renderProofBox(o){
  let box = '<div class="proof-box">';
  if (o.proof_uploaded_at) {
    box += '<div class="proof-done">已收到您的付款證明，店家將盡快核對（'+(o.proof_last_digits ? '末碼 '+o.proof_last_digits : '已上傳截圖')+'）</div>';
    box += '<div class="muted center" style="margin-top:6px;">若需要重新上傳，可再次選擇檔案或填寫末幾碼送出</div>';
  } else {
    box += '<div class="muted">完成付款後，可上傳截圖或填寫帳號末幾碼，方便店家核對款項</div>';
  }
  box += '<label>轉帳/繳費帳號末幾碼（選填）</label>';
  box += '<input type="text" id="proof_digits" maxlength="20" placeholder="例如：12345" value="'+(o.proof_last_digits||'')+'" />';
  box += '<label>上傳截圖（選填）</label>';
  box += '<input type="file" id="proof_file" accept="image/*" />';
  box += '<button onclick="uploadProof()">送出付款證明</button>';
  box += '<div id="proof_msg" class="muted center" style="margin-top:6px;"></div>';
  box += '</div>';
  return box;
}

async function uploadProof(){
  const msgEl = document.getElementById('proof_msg');
  const digits = (document.getElementById('proof_digits').value || '').trim();
  const fileInput = document.getElementById('proof_file');
  const file = fileInput && fileInput.files[0];

  const send = async (imageBase64)=>{
    try{
      const res = await fetch('/api/order/'+token+'/proof', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ image_base64: imageBase64 || null, last_digits: digits || null })
      });
      const d = await res.json();
      if (!res.ok){ if (msgEl) msgEl.textContent = d.error||'發生錯誤'; return; }
      render(d);
    }catch(e){ if (msgEl) msgEl.textContent = '連線發生問題，請再試一次'; }
  };

  if (!digits && !file) { if (msgEl) msgEl.textContent = '請上傳截圖或填寫末幾碼'; return; }
  if (msgEl) msgEl.textContent = '上傳中...';

  if (file) {
    const reader = new FileReader();
    reader.onload = ()=> send(reader.result);
    reader.readAsDataURL(file);
  } else {
    send(null);
  }
}

async function selectMethod(method){
  try{
    const res = await fetch('/api/order/'+token+'/select-method', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({method})
    });
    const d = await res.json();
    if (!res.ok){ alert(d.error||'發生錯誤'); return; }
    render(d);
  }catch(e){ alert('發生錯誤，請重新整理再試一次'); }
}

load();
</script>
</body>
</html>`;
}

export function memberHtml() {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/favicon.svg" />
<title>會員查詢</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#EEF0F6; --card:#fff; --line:#E2E4ED;
    --ink:#181B2E; --muted:#767B8C;
    --accent:#B8842E; --accent-ink:#54390F; --accent-soft:#F6ECD8;
    --danger:#B8433A; --danger-soft:#F7E6E4;
    --ok:#1E7A56; --ok-soft:#E1F0E8;
    --wait:#9C6A16; --wait-soft:#FBEEDA;
    --neutral:#5B6072; --neutral-soft:#EAEBF1;
    --violet:#5C4C9E; --violet-soft:#EBE7F6;
    --radius:14px;
    --display:'Space Grotesk',-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;
    --mono:'IBM Plex Mono',ui-monospace,monospace;
  }
  *{box-sizing:border-box;}
  body{margin:0;font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;background:var(--bg);color:var(--ink);}

  header{background:var(--ink);padding:20px 24px;display:flex;justify-content:space-between;align-items:center;position:relative;}
  header::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--accent);}
  header h1{font-family:var(--display);font-size:19px;font-weight:600;margin:0;color:#fff;letter-spacing:.02em;}
  header .who{display:flex;align-items:center;gap:14px;}
  header #whoami{color:#B9BCCC;font-size:13px;}

  main{padding:24px 18px 60px;max-width:640px;margin:0 auto;}

  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:22px;margin-bottom:20px;position:relative;box-shadow:0 1px 2px rgba(24,27,46,.04);}
  .card::before{content:"";position:absolute;left:22px;top:0;width:28px;height:3px;background:var(--accent);}
  .card h2{margin:6px 0 18px;font-family:var(--display);font-size:16px;font-weight:600;padding-top:6px;}

  label{display:block;font-size:12.5px;color:var(--muted);margin:14px 0 5px;}
  input,select{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:8px;font-size:14.5px;background:#FBFBFD;color:var(--ink);transition:border-color .15s;}
  input:focus,select:focus{outline:none;border-color:var(--accent);background:#fff;}
  input.hidden{display:none;}

  .chips{display:flex;flex-wrap:wrap;gap:8px;}
  .chip{font-family:var(--mono);font-size:13.5px;font-weight:600;padding:9px 14px;border-radius:20px;border:1px solid var(--line);background:#FBFBFD;color:var(--ink);cursor:pointer;transition:border-color .15s,background .15s;}
  .chip:hover{border-color:var(--accent);}
  .chip.active{background:var(--ink);border-color:var(--ink);color:#fff;}
  .chip-custom{font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;color:var(--muted);}
  .chip-custom.active{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-ink);}

  button.btn{font-family:var(--display);background:var(--ink);color:#fff;border:none;padding:11px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;margin-top:16px;letter-spacing:.01em;transition:background .15s,transform .1s;}
  button.btn:hover{background:#2A2E48;}
  button.btn:active{transform:translateY(1px);}
  button.btn.secondary{background:transparent;color:var(--ink);border:1px solid var(--line);}
  button.btn.secondary:hover{background:var(--neutral-soft);border-color:var(--neutral);}
  button.btn:disabled{opacity:.5;cursor:default;}

  header button.btn.secondary{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35);margin-top:0;}
  header button.btn.secondary:hover{background:rgba(255,255,255,.1);border-color:#fff;}

  table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:14px;}
  th{text-align:left;padding:8px 6px;border-bottom:1px solid var(--ink);font-weight:600;font-size:12px;color:var(--muted);}
  td{text-align:left;padding:11px 6px;border-bottom:1px dashed var(--line);}
  td:nth-child(2){font-family:var(--mono);}

  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:600;border:1px solid transparent;}
  .b-pending{color:var(--neutral);background:var(--neutral-soft);border-color:#D6D8E2;}
  .b-await{color:var(--wait);background:var(--wait-soft);border-color:#EFD9AE;}
  .b-ready{color:#2648B0;background:#E5EAFB;border-color:#C6D0F2;}
  .b-paid{color:var(--ok);background:var(--ok-soft);border-color:#BFE1CE;}
  .b-expired{color:var(--neutral);background:var(--neutral-soft);border-color:#D6D8E2;}
  .b-cancel{color:var(--danger);background:var(--danger-soft);border-color:#EFC7C2;}
  .b-completed{color:var(--violet);background:var(--violet-soft);border-color:#D3CAEE;}

  .msg{font-size:13px;margin-top:8px;}
  .msg.err{color:var(--danger);} .msg.ok{color:var(--ok);}
  .hidden{display:none;}

  #loginView{max-width:360px;margin:14vh auto 0;padding-top:26px;}
  #loginView .mark{font-family:var(--display);font-weight:700;font-size:15px;color:var(--accent-ink);background:var(--accent-soft);display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;margin-bottom:14px;}
  #loginView h2{padding-top:0;}
  #loginView .hint{margin-top:16px;color:var(--muted);font-size:12.5px;}

  #newOrderResult{margin-top:14px;padding-top:14px;border-top:1px dashed var(--line);}
  #newOrderLink{display:inline-block;text-decoration:none;}

  .total-row td{font-weight:700;background:#f8f9fb;}

  .ref-code-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  .ref-code-row code{font-family:var(--mono);font-size:17px;font-weight:600;letter-spacing:.08em;background:var(--accent-soft);color:var(--accent-ink);padding:8px 14px;border-radius:8px;border:1px solid var(--accent);}
  .ref-code-row .btn{margin-top:0;}

  /* === 查價專區 === */
  .quote-toggle{display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;}
  .quote-toggle h2{margin:0;padding-top:0;}
  .quote-toggle .arrow{transition:transform .2s;color:var(--accent);font-size:16px;}
  .quote-toggle.open .arrow{transform:rotate(180deg);}

  .quote-panel{margin-top:18px;padding-top:18px;border-top:1px dashed var(--line);}
  .quote-inputs{display:flex;flex-direction:column;gap:10px;margin-bottom:12px;}
  .quote-input-row{display:flex;gap:8px;align-items:center;}
  .quote-input-row input{flex:1;}
  .quote-input-row .remove-btn{background:transparent;color:var(--danger);border:1px solid var(--danger-soft);font-size:14px;padding:8px 12px;margin:0;border-radius:8px;cursor:pointer;}
  .quote-input-row .remove-btn:hover{background:var(--danger-soft);}

  .quote-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
  .quote-actions button{margin-top:0;}

  .quote-result{background:linear-gradient(135deg, var(--accent-soft), #FFFBF0);border:1px solid var(--accent);border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;animation:fadeIn .3s ease;}
  .quote-result .info{flex:1;min-width:180px;}
  .quote-result .info .amount{font-family:var(--mono);font-size:15px;font-weight:600;color:var(--ink);}
  .quote-result .info .rate{font-size:12px;color:var(--muted);margin-top:2px;}
  .quote-result .info .coins{font-family:var(--display);font-size:20px;font-weight:700;color:var(--accent-ink);margin-top:4px;}
  .quote-result .select-btn{background:var(--ink);color:#fff;border:none;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin:0;white-space:nowrap;}
  .quote-result .select-btn:hover{background:#2A2E48;}

  @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}

  .estimate-badge{display:inline-block;background:var(--accent-soft);color:var(--accent-ink);font-family:var(--mono);font-size:13px;font-weight:600;padding:6px 12px;border-radius:20px;margin-top:10px;border:1px solid var(--accent);}
  .estimate-badge.hidden{display:none;}

  /* Modal 彈窗 */
  .modal-backdrop{position:fixed;inset:0;background:rgba(24,27,46,.6);display:none;align-items:center;justify-content:center;z-index:100;padding:16px;}
  .modal-backdrop.show{display:flex;}
  .popup{background:#fff;border-radius:14px;padding:26px 30px;max-width:340px;width:100%;text-align:center;position:relative;box-shadow:0 12px 40px rgba(24,27,46,.25);opacity:0;transform:scale(.92);transition:opacity .25s,transform .25s;}
  .popup.show{opacity:1;transform:scale(1);}
  .popup h3{margin:0 0 10px;font-family:var(--display);font-size:16px;color:var(--accent-ink);}
  .popup p{color:var(--muted);font-size:14px;line-height:1.7;margin:0 0 18px;}
  .popup button.btn{width:100%;margin-top:0;}
  #popup-close{position:absolute;top:10px;right:12px;background:transparent;color:var(--muted);font-size:18px;border:none;cursor:pointer;padding:4px 8px;border-radius:50%;width:32px;height:32px;line-height:1;margin:0;}
  #popup-close:hover{background:var(--neutral-soft);}

  /* === 系統公告彈窗 === */
  .announce-popup{max-width:420px;text-align:left;}
  .announce-popup h3{text-align:center;font-size:17px;}
  .announce-carousel{position:relative;width:100%;border-radius:10px;overflow:hidden;margin-bottom:14px;background:#f1f2f6;}
  .announce-track{display:flex;transition:transform .35s ease;}
  .announce-track img{width:100%;flex:0 0 100%;max-height:320px;object-fit:contain;display:block;background:#f1f2f6;}
  .announce-arrow{position:absolute;top:50%;transform:translateY(-50%);background:rgba(24,27,46,.45);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;padding:0;margin:0;}
  .announce-arrow:hover{background:rgba(24,27,46,.7);}
  .announce-arrow.prev{left:8px;} .announce-arrow.next{right:8px;}
  .announce-dots{display:flex;justify-content:center;gap:6px;margin-bottom:14px;}
  .announce-dot{width:7px;height:7px;border-radius:50%;background:var(--line);cursor:pointer;padding:0;border:none;}
  .announce-dot.active{background:var(--accent);}
  .announce-text{color:var(--ink);font-size:14.5px;line-height:1.8;white-space:pre-wrap;text-align:left;margin:0 0 18px;}
  .announce-actions{display:flex;gap:10px;}
  .announce-actions .btn{flex:1;margin-top:0;}
</style>
</head>
<body>

<div id="loginView" class="card">
  <div class="mark">會</div>
  <h2>會員登入查詢</h2>
  <label>帳號</label>
  <input id="loginAccount" />
  <label>密碼</label>
  <input id="loginPass" type="password" />
  <button class="btn" id="loginBtn" onclick="doLogin()">登入</button>
  <div id="loginMsg" class="msg"></div>
  <div class="hint">尚未收到帳號密碼？請洽店家開通。</div>
</div>

<div id="appView" class="hidden">
  <header>
    <h1>會員查詢</h1>
    <div class="who"><span id="whoami"></span>
      <button class="btn secondary" onclick="doLogout()">登出</button></div>
  </header>
  <main>

    <!-- === 我的推薦碼 === -->
    <div class="card">
      <h2>我的推薦碼</h2>
      <div class="ref-code-row">
        <code id="myReferralCode">------</code>
        <button class="btn secondary" onclick="copyMyReferralLink()">複製邀請連結</button>
      </div>
      <div class="msg" style="color:var(--muted);margin-top:8px;">分享此連結給朋友，讓他們自行註冊成為會員</div>
    </div>

    <!-- === 查價專區（可收合） === -->
    <div class="card">
      <div class="quote-toggle" id="quoteToggle" onclick="toggleQuotePanel()">
        <h2>💰 前往查價</h2>
        <span class="arrow">▼</span>
      </div>
      <div class="quote-panel hidden" id="quotePanel">
        <label>輸入金額（可新增多筆）</label>
        <div class="quote-inputs" id="quoteInputs">
          <div class="quote-input-row">
            <input type="number" class="quote-amount" placeholder="輸入金額 (200~50000)" min="200" max="50000" step="1">
          </div>
        </div>
        <div class="quote-actions">
          <button class="btn secondary" onclick="addQuoteInput()">➕ 新增金額</button>
          <button class="btn" onclick="calculateQuotes()">計算抖幣</button>
        </div>
        <div id="quoteResults"></div>
      </div>
    </div>

    <!-- === 自助下單 === -->
    <div class="card">
      <h2>自助下單</h2>
      <div class="msg" style="color:var(--muted);margin-top:0;">單筆訂購金額最低 200 元</div>
      <label>金額</label>
      <div class="chips" id="amountChips">
        <button type="button" class="chip" data-amount="200">$200</button>
        <button type="button" class="chip" data-amount="300">$300</button>
        <button type="button" class="chip" data-amount="500">$500</button>
        <button type="button" class="chip" data-amount="1000">$1000</button>
        <button type="button" class="chip chip-custom" id="chipCustom">其他金額</button>
      </div>
      <input id="new_amount" type="number" min="200" step="1" placeholder="請輸入金額（最低 200 元）" class="hidden" />
      <div class="estimate-badge hidden" id="estimateBadge"></div>
      <button class="btn" id="newOrderBtn" onclick="createOrder()">建立訂單</button>
      <div id="newOrderMsg" class="msg"></div>
      <div id="newOrderResult" class="hidden">
        <div class="msg ok">訂單已建立，請繼續完成付款：</div>
        <a id="newOrderLink" class="btn" target="_blank">前往付款頁</a>
      </div>
    </div>

    <!-- === 我的訂單記錄 === -->
    <div class="card">
      <h2>我的訂單記錄</h2>
      <label>月份（留空查詢全部）</label>
      <input id="ord_month" type="month" />
      <button class="btn secondary" onclick="loadOrders()">查詢</button>
      <table id="ord_table">
        <thead><tr><th>建立時間</th><th>金額</th><th>付款方式</th><th>狀態</th><th>操作</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </main>
</div>

<!-- === Modal 彈窗 === -->
<div class="modal-backdrop" id="modal-backdrop">
  <div class="popup" id="popup">
    <button id="popup-close" onclick="hidePopup()">✖</button>
    <h3 id="popup-title">提醒</h3>
    <p id="popup-message">其他金額請私信</p>
    <button class="btn" onclick="hidePopup()">我知道了</button>
  </div>
</div>

<!-- === 系統公告彈窗（會員登入後顯示） === -->
<div class="modal-backdrop" id="announce-backdrop">
  <div class="popup announce-popup" id="announce-popup">
    <h3 id="announce-title">公告</h3>
    <div class="announce-carousel hidden" id="announce-carousel">
      <div class="announce-track" id="announce-track"></div>
      <button type="button" class="announce-arrow prev hidden" id="announce-prev" onclick="announceNav(-1)">‹</button>
      <button type="button" class="announce-arrow next hidden" id="announce-next" onclick="announceNav(1)">›</button>
    </div>
    <div class="announce-dots hidden" id="announce-dots"></div>
    <p class="announce-text hidden" id="announce-text"></p>
    <div class="announce-actions">
      <button class="btn secondary" onclick="dismissAnnounceToday()">今天不再顯示</button>
      <button class="btn" onclick="closeAnnounce()">了解</button>
    </div>
  </div>
</div>

<script>
const PM_LABEL = {transfer:'轉帳', store_barcode:'超商條碼', taiwan_pay:'台灣Pay'};
const STATUS_LABEL = {
  pending_method:['待選付款方式','b-pending'],
  awaiting_payment:['等待付款(轉帳)','b-await'],
  awaiting_barcode:['待店家準備條碼','b-await'],
  ready_to_pay:['已可付款(條碼)','b-ready'],
  paid:['已完成付款','b-paid'],
  expired:['已過期','b-expired'],
  cancelled:['已取消','b-cancel'],
};

// 最低購買金額（查價與自助下單共用同一個門檻，兩邊要保持一致）
const MIN_QUOTE_AMOUNT = 200;

// === 匯率規則（從 API 讀取） ===
let rateRules = [];

async function loadRates() {
  try {
    const data = await api('/api/rates');
    rateRules = data.rules || [];
  } catch (e) {
    console.warn('讀取費率失敗', e);
    rateRules = [];
  }
}

// 取得對應匯率
function getRate(amount) {
  for (const rule of rateRules) {
    if (amount >= rule.min) return rule.rate;
  }
  return null;
}

// 計算抖幣
function calcCoins(amount) {
  if (isNaN(amount) || amount < MIN_QUOTE_AMOUNT || amount > 50000) return null;
  const rate = getRate(amount);
  if (!rate) return null;
  return { amount, rate, coins: (amount * rate).toFixed(2) };
}

// === 將 UTC 時間轉為台灣時間 (UTC+8) ===
function toTaipeiTime(dateStr) {
  if (!dateStr) return "";
  const isoStr = String(dateStr).replace(" ", "T") + "Z";
  return new Date(isoStr).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

// === Modal 彈窗 ===
function showPopup(title, message) {
  document.getElementById('popup-title').textContent = title;
  document.getElementById('popup-message').textContent = message;
  const backdrop = document.getElementById('modal-backdrop');
  const popup = document.getElementById('popup');
  backdrop.classList.add('show');
  setTimeout(()=>popup.classList.add('show'), 10);
}
function hidePopup() {
  const backdrop = document.getElementById('modal-backdrop');
  const popup = document.getElementById('popup');
  popup.classList.remove('show');
  setTimeout(()=>backdrop.classList.remove('show'), 250);
}

// === 查價專區：展開 / 收合 ===
function toggleQuotePanel() {
  const toggle = document.getElementById('quoteToggle');
  const panel = document.getElementById('quotePanel');
  toggle.classList.toggle('open');
  panel.classList.toggle('hidden');
}

// === 查價專區：新增金額輸入列 ===
function addQuoteInput() {
  const container = document.getElementById('quoteInputs');
  const row = document.createElement('div');
  row.className = 'quote-input-row';
  row.innerHTML = \`
    <input type="number" class="quote-amount" placeholder="輸入金額 (200~50000)" min="200" max="50000" step="1">
    <button type="button" class="remove-btn" onclick="this.parentElement.remove()">✖</button>
  \`;
  container.appendChild(row);
}

// === 查價專區：計算 ===
function calculateQuotes() {
  const inputs = document.querySelectorAll('.quote-amount');
  const results = [];
  let hasInvalid = false;

  inputs.forEach(input => {
    const raw = input.value.trim();
    if (!raw) return;
    const amount = parseFloat(raw);
    const res = calcCoins(amount);
    if (!res) { hasInvalid = true; return; }
    results.push(res);
  });

  if (results.length === 0) {
    if (hasInvalid) {
      showPopup('金額超出範圍', '其他金額請私信');
    } else {
      showPopup('提醒', '請至少輸入一筆金額');
    }
    document.getElementById('quoteResults').innerHTML = '';
    return;
  }

  const container = document.getElementById('quoteResults');
  container.innerHTML = results.map(r => \`
    <div class="quote-result">
      <div class="info">
        <div class="amount">$\${r.amount.toLocaleString()} TWD</div>
        <div class="rate">兌換比例：1 : \${r.rate}</div>
        <div class="coins">🪙 \${Number(r.coins).toLocaleString()} 抖幣</div>
      </div>
      <button class="select-btn" onclick="selectQuote(\${r.amount}, '\${r.coins}')">選擇此金額</button>
    </div>
  \`).join('');

  if (hasInvalid) {
    showPopup('部分金額超出範圍', '超出 '+MIN_QUOTE_AMOUNT+'~50000 的金額請私信');
  }
}

// === 選擇查價結果 → 帶入自助下單金額 ===
function selectQuote(amount, coins) {
  const input = document.getElementById('new_amount');
  input.value = amount;
  document.querySelectorAll('#amountChips .chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('#amountChips .chip').forEach(chip => {
    if (chip.dataset.amount && Number(chip.dataset.amount) === amount) {
      chip.classList.add('active');
    }
  });
  const badge = document.getElementById('estimateBadge');
  badge.textContent = \`預估可獲得 🪙 \${Number(coins).toLocaleString()} 抖幣\`;
  badge.classList.remove('hidden');
  document.getElementById('new_amount').scrollIntoView({behavior:'smooth', block:'center'});
}

// === 金額 chip 點擊 ===
function initAmountChips() {
  const wrap = document.getElementById('amountChips');
  const input = document.getElementById('new_amount');
  const badge = document.getElementById('estimateBadge');
  if (!wrap || !input) return;
  wrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      wrap.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (chip.id === 'chipCustom') {
        input.classList.remove('hidden');
        input.value = '';
        input.focus();
        badge.classList.add('hidden');
      } else {
        input.classList.add('hidden');
        input.value = chip.dataset.amount;
        const res = calcCoins(parseFloat(chip.dataset.amount));
        if (res) {
          badge.textContent = \`預估可獲得 🪙 \${Number(res.coins).toLocaleString()} 抖幣\`;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    });
  });

  input.addEventListener('input', () => {
    const val = parseFloat(input.value);
    const res = calcCoins(val);
    if (res) {
      badge.textContent = \`預估可獲得 🪙 \${Number(res.coins).toLocaleString()} 抖幣\`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  });
}
initAmountChips();

async function api(path, opts={}) {
  const res = await fetch(path, {credentials:'include', headers:{'Content-Type':'application/json'}, ...opts});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || ('錯誤: '+res.status));
  return data;
}

async function checkSession(){
  try{
    const me = await api('/api/member/me');
    document.getElementById('whoami').textContent = me.name + '（' + me.account + '）';
    document.getElementById('myReferralCode').textContent = me.referral_code || '------';
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');
    await loadRates();
    loadOrders();
    startOrdersPolling();
    checkAnnouncement();
  }catch(e){ /* 尚未登入，維持登入畫面 */ }
}

// === 系統公告彈窗 ===
let announceData = null;
let announceIndex = 0;
let announceTimer = null;

function announceTodayStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

async function checkAnnouncement(){
  try{
    const data = await api('/api/member/announcement');
    if (!data.enabled) return;
    const key = 'announce_dismissed_'+(data.version||'')+'_'+announceTodayStr();
    try{ if (localStorage.getItem(key) === '1') return; }catch(e){}
    showAnnounce(data);
  }catch(e){ /* 公告載入失敗不影響其他功能 */ }
}

function showAnnounce(data){
  announceData = data;
  announceIndex = 0;
  document.getElementById('announce-title').textContent = data.title || '公告';
  const carousel = document.getElementById('announce-carousel');
  const dots = document.getElementById('announce-dots');
  const prevBtn = document.getElementById('announce-prev');
  const nextBtn = document.getElementById('announce-next');
  const textEl = document.getElementById('announce-text');

  if (announceTimer) { clearInterval(announceTimer); announceTimer = null; }

  if (data.type === 'image' && Array.isArray(data.images) && data.images.length > 0) {
    textEl.classList.add('hidden');
    carousel.classList.remove('hidden');
    document.getElementById('announce-track').innerHTML = data.images.map(src => \`<img src="\${src}">\`).join('');
    const multi = data.images.length > 1;
    dots.classList.toggle('hidden', !multi);
    prevBtn.classList.toggle('hidden', !multi);
    nextBtn.classList.toggle('hidden', !multi);
    dots.innerHTML = multi ? data.images.map((_, i) => \`<button type="button" class="announce-dot" onclick="announceGoTo(\${i})"></button>\`).join('') : '';
    renderAnnounceSlide();
    if (multi) announceTimer = setInterval(()=>announceNav(1), 4000);
  } else {
    carousel.classList.add('hidden');
    dots.classList.add('hidden');
    prevBtn.classList.add('hidden');
    nextBtn.classList.add('hidden');
    textEl.classList.remove('hidden');
    textEl.textContent = data.text || '';
  }

  const backdrop = document.getElementById('announce-backdrop');
  const popup = document.getElementById('announce-popup');
  backdrop.classList.add('show');
  setTimeout(()=>popup.classList.add('show'), 10);
}

function renderAnnounceSlide(){
  const track = document.getElementById('announce-track');
  track.style.transform = 'translateX(-'+(announceIndex*100)+'%)';
  document.querySelectorAll('#announce-dots .announce-dot').forEach((d,i)=>d.classList.toggle('active', i===announceIndex));
}

function announceNav(dir){
  if (!announceData || !Array.isArray(announceData.images) || announceData.images.length === 0) return;
  const len = announceData.images.length;
  announceIndex = (announceIndex + dir + len) % len;
  renderAnnounceSlide();
}

function announceGoTo(i){
  announceIndex = i;
  renderAnnounceSlide();
}

function hideAnnounce(){
  if (announceTimer) { clearInterval(announceTimer); announceTimer = null; }
  const backdrop = document.getElementById('announce-backdrop');
  const popup = document.getElementById('announce-popup');
  popup.classList.remove('show');
  setTimeout(()=>backdrop.classList.remove('show'), 250);
}

function closeAnnounce(){
  hideAnnounce();
}

function dismissAnnounceToday(){
  if (announceData) {
    const key = 'announce_dismissed_'+(announceData.version||'')+'_'+announceTodayStr();
    try{ localStorage.setItem(key, '1'); }catch(e){}
  }
  hideAnnounce();
}

function copyMyReferralLink(){
  const code = document.getElementById('myReferralCode').textContent.trim();
  if (!code || code === '------') { alert('推薦碼載入中，請稍後再試'); return; }
  const link = location.origin + '/member/register?code=' + encodeURIComponent(code);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(()=>alert('邀請連結已複製：\\n'+link)).catch(()=>prompt('複製失敗，請手動複製：', link));
  } else {
    prompt('請手動複製邀請連結：', link);
  }
}

async function doLogin(){
  const account = document.getElementById('loginAccount').value.trim();
  const password = document.getElementById('loginPass').value;
  const msg = document.getElementById('loginMsg');
  msg.textContent=''; msg.className='msg';
  if (!account || !password){ msg.textContent='請輸入帳號密碼'; msg.className='msg err'; return; }
  try{
    await api('/api/member/login', {method:'POST', body: JSON.stringify({account,password})});
    checkSession();
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
}

async function doLogout(){
  stopOrdersPolling();
  await api('/api/member/logout', {method:'POST'});
  location.reload();
}

async function createOrder(){
  const btn = document.getElementById('newOrderBtn');
  const msg = document.getElementById('newOrderMsg');
  const amount = document.getElementById('new_amount').value;
  msg.textContent=''; msg.className='msg';
  document.getElementById('newOrderResult').classList.add('hidden');
  if (!amount || Number(amount) <= 0){ msg.textContent='請輸入正確的金額'; msg.className='msg err'; return; }
  if (Number(amount) < MIN_QUOTE_AMOUNT){ msg.textContent='訂單金額不可低於 '+MIN_QUOTE_AMOUNT+' 元'; msg.className='msg err'; return; }
  btn.disabled = true;
  try{
    const res = await api('/api/member/orders', {method:'POST', body: JSON.stringify({amount})});
    document.getElementById('new_amount').value = '';
    document.getElementById('new_amount').classList.add('hidden');
    document.getElementById('estimateBadge').classList.add('hidden');
    document.querySelectorAll('#amountChips .chip').forEach(c=>c.classList.remove('active'));
    const linkEl = document.getElementById('newOrderLink');
    linkEl.href = res.link;
    document.getElementById('newOrderResult').classList.remove('hidden');
    loadOrders();
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
  finally{ btn.disabled = false; }
}

// ---- 訂單自動更新（輪詢）----
let ordersPollTimer = null;

function startOrdersPolling(){
  stopOrdersPolling();
  ordersPollTimer = setInterval(()=> {
    const appView = document.getElementById('appView');
    if (appView && !appView.classList.contains('hidden') && !document.hidden) {
      loadOrders();
    }
  }, 5000);
}

function stopOrdersPolling(){
  if (ordersPollTimer) { clearInterval(ordersPollTimer); ordersPollTimer = null; }
}

async function loadOrders(){
  const month = document.getElementById('ord_month').value;
  const qs = month ? ('?month='+encodeURIComponent(month)) : '';
  const list = await api('/api/member/orders'+qs);
  const tbody = document.querySelector('#ord_table tbody');
  const ACTIVE = new Set(['pending_method','awaiting_payment','awaiting_barcode','ready_to_pay']);
  tbody.innerHTML = list.map(o=>{
    const st = STATUS_LABEL[o.status] || [o.status,'b-pending'];
    const completedTag = o.is_completed ? ' <span class="badge b-completed">已結案</span>' : '';
    const action = ACTIVE.has(o.status)
      ? \`<a href="/pay/\${o.token}" target="_blank">前往付款</a>\`
      : \`<a href="/pay/\${o.token}" target="_blank">查看</a>\`;
    return \`<tr>
      <td>\${toTaipeiTime(o.created_at)}</td>
      <td>$\${o.amount}</td>
      <td>\${PM_LABEL[o.payment_method]||'尚未選擇'}</td>
      <td><span class="badge \${st[1]}">\${st[0]}</span>\${completedTag}</td>
      <td>\${action}</td>
    </tr>\`;
  }).join('') || '<tr><td colspan="5">尚無訂單記錄</td></tr>';
}

// 頁面載入時就先抓費率（不管有沒有登入）
loadRates().then(() => {
  checkSession();
});
</script>
</body>
</html>`;
}

// 隱藏的自助註冊頁：不會出現在任何選單或導覽列，只能透過會員分享的推薦連結（帶 ?code=）進入。
// 一定要填對某位既有會員的推薦碼才能建立帳號。
export function memberRegisterHtml() {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<title>會員註冊</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#EEF0F6; --card:#fff; --line:#E2E4ED;
    --ink:#181B2E; --muted:#767B8C;
    --accent:#B8842E; --accent-ink:#54390F; --accent-soft:#F6ECD8;
    --danger:#B8433A; --ok:#1E7A56;
    --display:'Space Grotesk',-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;
  }
  *{box-sizing:border-box;}
  body{margin:0;font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;background:var(--bg);color:var(--ink);}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;position:relative;box-shadow:0 1px 2px rgba(24,27,46,.04);max-width:380px;margin:10vh auto 0;}
  .card::before{content:"";position:absolute;left:22px;top:0;width:28px;height:3px;background:var(--accent);}
  .mark{font-family:var(--display);font-weight:700;font-size:15px;color:var(--accent-ink);background:var(--accent-soft);display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;margin-bottom:14px;}
  h2{margin:0 0 18px;font-family:var(--display);font-size:16px;font-weight:600;}
  label{display:block;font-size:12.5px;color:var(--muted);margin:14px 0 5px;}
  input{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:8px;font-size:14.5px;background:#FBFBFD;color:var(--ink);}
  input:focus{outline:none;border-color:var(--accent);background:#fff;}
  button.btn{font-family:var(--display);width:100%;background:var(--ink);color:#fff;border:none;padding:11px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;margin-top:18px;}
  button.btn:hover{background:#2A2E48;}
  button.btn:disabled{opacity:.5;cursor:default;}
  .msg{font-size:13px;margin-top:10px;}
  .msg.err{color:var(--danger);} .msg.ok{color:var(--ok);}
  .foot{margin-top:16px;text-align:center;font-size:12.5px;color:var(--muted);}
  .foot a{color:var(--accent-ink);}
</style>
</head>
<body>
<div class="card">
  <div class="mark">會</div>
  <h2>會員自助註冊</h2>
  <label>推薦碼</label>
  <input id="reg_code" placeholder="請輸入邀請你的會員推薦碼" style="text-transform:uppercase;" />
  <label>姓名</label>
  <input id="reg_name" />
  <label>帳號</label>
  <input id="reg_account" autocomplete="username" />
  <label>密碼（至少 6 碼）</label>
  <input id="reg_password" type="password" autocomplete="new-password" />
  <label>手機（選填）</label>
  <input id="reg_phone" />
  <button class="btn" id="reg_btn" onclick="doRegister()">建立帳號</button>
  <div id="reg_msg" class="msg"></div>
  <div class="foot">已經有帳號了？<a href="/member">前往登入</a></div>
</div>
<script>
  const params = new URLSearchParams(location.search);
  const prefillCode = params.get('code');
  if (prefillCode) document.getElementById('reg_code').value = prefillCode.toUpperCase();

  async function doRegister(){
    const btn = document.getElementById('reg_btn');
    const msg = document.getElementById('reg_msg');
    msg.textContent=''; msg.className='msg';
    const payload = {
      referral_code: document.getElementById('reg_code').value.trim(),
      name: document.getElementById('reg_name').value.trim(),
      account: document.getElementById('reg_account').value.trim(),
      password: document.getElementById('reg_password').value,
      phone: document.getElementById('reg_phone').value.trim(),
    };
    if (!payload.referral_code || !payload.name || !payload.account || !payload.password){
      msg.textContent = '請完整填寫必填欄位'; msg.className = 'msg err'; return;
    }
    btn.disabled = true;
    try{
      const res = await fetch('/api/member/register', {
        method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || '註冊失敗');
      msg.textContent = '註冊成功！正在為您登入...'; msg.className = 'msg ok';
      setTimeout(()=>{ location.href = '/member'; }, 600);
    }catch(e){
      msg.textContent = e.message; msg.className = 'msg err';
    }finally{
      btn.disabled = false;
    }
  }
</script>
</body>
</html>`;
}
