import { ALLOWED_EMAIL_DOMAINS } from "./helpers.js";

// ===== 網頁宣告（會員頁 / 註冊頁 / 付款頁 共用）=====
const SUPPORT_EMAIL = "service@ytgp168.com";
const SITE_DISCLAIMER_CSS = `
  .site-disclaimer{width:100%;max-width:420px;margin:22px auto 8px;padding:0 14px;text-align:center;font-size:12.5px;line-height:1.7;color:#767B8C;box-sizing:border-box;}
  .site-disclaimer b{display:block;font-size:13px;margin-bottom:2px;color:inherit;}
  .site-disclaimer a{color:inherit;text-decoration:underline;}`;
const SITE_DISCLAIMER_HTML = `<div class="site-disclaimer"><b>網頁宣告</b>本網站為會員自助查詢與訂單結帳頁面，內容僅供參考，實際以訂單確認內容為準。<br/>客服信箱：<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></div>`;

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
  .pager{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:12px;font-size:13px;color:var(--muted);}
  .pager button.btn{margin-top:0;}

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
    <button data-tab="coupons" onclick="showTab('coupons')">優惠碼</button>
    <button data-tab="points" onclick="showTab('points')">點數系統</button>
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
        <label>儲值平台（選填）</label>
        <select id="co_platform">
          <option value="">-- 不指定 --</option>
          <option value="tiktok">TikTok</option>
          <option value="kuaishou">快手</option>
          <option value="xiaohongshu">小紅書</option>
          <option value="douyin">陸抖</option>
        </select>
        <label>付款方式（選填，不指定則由前台客人自行選擇）</label>
        <select id="co_method" onchange="document.getElementById('co_store_wrap').classList.toggle('hidden', this.value!=='store_barcode')">
          <option value="">-- 不指定 --</option>
          <option value="transfer">轉帳</option>
          <option value="store_barcode">超商條碼</option>
          <option value="taiwan_pay">TWQR</option>
        </select>
        <div id="co_store_wrap" class="hidden">
          <label>超商（選填；單筆上限 $10,000，客人需自付 $15 手續費）</label>
          <select id="co_store">
            <option value="">-- 不指定 --</option>
            <option value="seven">7-11</option>
            <option value="family">全家</option>
            <option value="hilife">萊爾富</option>
          </select>
        </div>
        <label>優惠碼（選填）</label>
        <div style="display:flex;gap:8px;">
          <input id="co_coupon" placeholder="輸入優惠碼" style="text-transform:uppercase;" oninput="document.getElementById('co_coupon_msg').textContent='';" />
          <button type="button" class="btn secondary" style="white-space:nowrap;" onclick="previewCoupon('co')">套用</button>
        </div>
        <div id="co_coupon_msg" class="msg"></div>
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
        <label>訂單編號快速搜尋（例如 TW210007，不分月份都能找到）</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input id="ord_search" placeholder="輸入訂單編號" style="flex:1;min-width:160px;" onkeydown="if(event.key==='Enter')searchOrderByNo();" />
          <button class="btn secondary" onclick="searchOrderByNo()">搜尋</button>
          <button class="btn secondary hidden" id="ord_search_clear" onclick="clearOrderSearch()">清除搜尋，回到本月列表</button>
        </div>
        <label style="margin-top:14px;">月份</label>
        <input id="ord_month" type="month" />
        <button class="btn secondary" onclick="loadOrders()">查詢</button>
        <div class="filter-row">
          <input type="checkbox" id="ord_hide_completed" onchange="renderOrders()" />
          <label for="ord_hide_completed" style="margin:0;">隱藏已結案訂單</label>
        </div>
        <table id="ord_table">
          <thead><tr><th>訂單編號</th><th>建立時間</th><th>會員</th><th>儲值平台</th><th>帳號/密碼</th><th>金額</th><th>預計幣數</th><th>優惠</th><th>付款方式</th><th>狀態</th><th>結案</th><th>核對資訊</th><th>操作</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section id="tab-members" class="tab hidden">
      <div class="card">
        <h2>新增會員</h2>
        <div class="grid2">
          <div><label>姓名 *</label><input id="mem_name" /></div>
          <div><label>電話（選填）</label><input id="mem_phone" /></div>
        </div>
        <div class="grid2">
          <div><label>電子信箱（選填）</label><input id="mem_email" type="email" /></div>
          <div></div>
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
          <thead><tr><th>ID</th><th>姓名</th><th>帳號</th><th>電話</th><th>電子信箱</th><th>備註</th><th>推薦碼</th><th>推薦人</th><th>操作</th></tr></thead>
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
        <h2>TikTok 抖幣費率設定</h2>
        <small class="hint">符合金額 ≥ min 時，套用該 rate。系統會自動由大到小排序。修改後儲存即生效，僅適用於 TikTok 平台的訂單。</small>
        <div id="rates_list_tiktok" style="margin-top:14px;"></div>
        <button class="btn secondary" onclick="addRateRow('tiktok')">➕ 新增一筆</button>
        <button class="btn" onclick="saveRates('tiktok')">儲存費率</button>
        <button class="btn secondary" onclick="resetRates('tiktok')">還原預設值</button>
        <div id="rates_msg_tiktok" class="msg"></div>
      </div>
      <div class="card">
        <h2>快手 / 小紅書 / 陸抖 費率設定</h2>
        <small class="hint">符合金額 ≥ min 時，套用該 rate。系統會自動由大到小排序。修改後儲存即生效，快手、小紅書、陸抖三個平台共用這組費率。</small>
        <div id="rates_list_other" style="margin-top:14px;"></div>
        <button class="btn secondary" onclick="addRateRow('other')">➕ 新增一筆</button>
        <button class="btn" onclick="saveRates('other')">儲存費率</button>
        <button class="btn secondary" onclick="resetRates('other')">還原預設值</button>
        <div id="rates_msg_other" class="msg"></div>
      </div>
    </section>

    <section id="tab-coupons" class="tab hidden">
      <div class="card">
        <h2 id="cp_form_title">新增優惠碼</h2>
        <label>優惠碼 *</label>
        <input id="cp_code" placeholder="例如：WELCOME10" style="text-transform:uppercase;" />
        <label>折扣類型 *</label>
        <select id="cp_type" onchange="updateCouponTypeView()">
          <option value="percent">百分比折扣（例如打 9 折）</option>
          <option value="fixed">直接折抵固定金額（例如折 $50）</option>
        </select>
        <div class="grid2">
          <div id="cp_percent_wrap"><label>折扣百分比 (%) *</label><input id="cp_percent" type="number" min="1" max="100" step="1" placeholder="例如：10" /></div>
          <div id="cp_amount_wrap" class="hidden"><label>折抵金額 ($) *</label><input id="cp_amount" type="number" min="1" step="1" placeholder="例如：50" /></div>
          <div id="cp_max_wrap"><label>最高優惠金額（選填，不限請留空）</label><input id="cp_max" type="number" min="0" step="1" placeholder="不限" /></div>
        </div>
        <div class="grid2">
          <div><label>最低使用金額（訂單金額需達到此金額才可使用，選填）</label><input id="cp_min" type="number" min="0" step="1" placeholder="0（不限）" /></div>
          <div><label>使用次數上限（選填，不限請留空）</label><input id="cp_limit" type="number" min="1" step="1" placeholder="不限" /></div>
        </div>
        <label>到期時間（選填，不設定則永久有效）</label>
        <input id="cp_expires" type="datetime-local" />
        <label>備註（選填）</label>
        <input id="cp_note" placeholder="例如：新會員首購優惠" />
        <button class="btn" id="cp_submit_btn" onclick="submitCoupon()">新增</button>
        <button class="btn secondary hidden" id="cp_cancel_btn" onclick="cancelEditCoupon()">取消編輯</button>
        <div id="cp_msg" class="msg"></div>
      </div>
      <div class="card">
        <h2>優惠碼列表</h2>
        <table id="cp_table">
          <thead><tr><th>代碼</th><th>折扣</th><th>上限/門檻</th><th>使用狀況</th><th>到期時間</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section id="tab-points" class="tab hidden">
      <div class="card">
        <h2>點數規則</h2>
        <small class="hint">三個功能各自獨立，可以只開其中幾個；關閉的功能，下方對應的欄位可以不填。</small>
        <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:10px;">
          <label style="display:flex;align-items:center;gap:8px;color:var(--ink);margin-top:0;"><input id="pt_earn_enabled" type="checkbox" style="width:auto;" /> <b>訂單回饋</b>：訂單標記為「訂單完成」後自動發點（關閉後不再發新點，已發的保留）</label>
          <label>每實付幾元得 1 點</label><input id="pt_earn_per" type="number" min="1" step="1" />
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:10px;">
          <label style="display:flex;align-items:center;gap:8px;color:var(--ink);margin-top:0;"><input id="pt_discount_enabled" type="checkbox" style="width:auto;" /> <b>訂單折抵</b>：會員下單時可用點數折抵金額</label>
          <div class="grid2">
            <div><label>1 點可折抵幾元</label><input id="pt_redeem_value" type="number" min="1" step="1" /></div>
            <div><label>單筆訂單最多折抵幾 %（1～90）</label><input id="pt_max_percent" type="number" min="1" max="90" step="1" /></div>
          </div>
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:10px;">
          <label style="display:flex;align-items:center;gap:8px;color:var(--ink);margin-top:0;"><input id="pt_shop_enabled" type="checkbox" style="width:auto;" /> <b>點數商城</b>：會員可用點數兌換商品</label>
        </div>
        <small class="hint">訂單「已付款」並標記為「訂單完成」時，依實付金額發點（只標已付款不會發）。取消結案、取消或刪除訂單時，點數會自動扣回；要更正金額需先取消結案，重新「訂單完成」後會依新金額重發。</small><br/>
        <button class="btn" onclick="savePointsConfigAdmin()">儲存規則</button>
        <div id="pt_cfg_msg" class="msg"></div>
      </div>

      <div class="card">
        <h2>兌換單</h2>
        <table id="pt_red_table">
          <thead><tr><th>時間</th><th>會員</th><th>商品</th><th>點數</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody></tbody>
        </table>
        <div id="pt_red_pager" class="pager"></div>
        <div id="pt_red_msg" class="msg"></div>
      </div>

      <div class="card">
        <h2 id="pt_item_form_title">點數商城商品</h2>
        <div class="grid2">
          <div><label>商品名稱 *</label><input id="pt_item_name" /></div>
          <div><label>所需點數 *</label><input id="pt_item_cost" type="number" min="1" step="1" /></div>
        </div>
        <div class="grid2">
          <div><label>說明（選填）</label><input id="pt_item_desc" /></div>
          <div><label>庫存（不限請留空）</label><input id="pt_item_stock" type="number" min="0" step="1" placeholder="不限" /></div>
        </div>
        <button class="btn" id="pt_item_submit" onclick="submitPointItem()">新增商品</button>
        <button class="btn secondary hidden" id="pt_item_cancel" onclick="cancelEditPointItem()">取消編輯</button>
        <div id="pt_item_msg" class="msg"></div>
        <table id="pt_item_table">
          <thead><tr><th>商品</th><th>點數</th><th>庫存</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card" id="pt_members_card">
        <div id="pt_list_view">
          <h2>會員點數</h2>
          <input id="pt_mem_search" placeholder="搜尋會員（姓名、帳號、手機、信箱）" oninput="onPtSearch()" autocomplete="off" />
          <div id="pt_mem_count" class="msg" style="color:var(--muted);"></div>
          <table id="pt_mem_table">
            <thead><tr><th>會員</th><th>帳號</th><th>目前點數</th><th>累計獲得</th><th>操作</th></tr></thead>
            <tbody></tbody>
          </table>
          <div id="pt_mem_pager" class="pager"></div>
        </div>

        <div id="pt_detail_view" class="hidden">
          <button type="button" class="btn secondary" style="margin-top:0;" onclick="closePointDetail()">← 返回會員列表</button>
          <h2 id="pt_detail_title" style="margin-top:16px;margin-bottom:4px;"></h2>
          <div id="pt_detail_bal" style="font-size:14px;color:var(--muted);"></div>

          <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:12px;">
            <b style="font-size:14px;">人工調整點數</b>
            <div class="grid2">
              <div><label>調整點數（正數加、負數扣）</label><input id="pt_adj_delta" type="number" step="1" placeholder="例如：50 或 -20" /></div>
              <div><label>調整原因 *</label><input id="pt_adj_note" placeholder="例如：活動贈點" /></div>
            </div>
            <button class="btn" onclick="submitPointAdjust()">送出調整</button>
            <div id="pt_adj_msg" class="msg"></div>
          </div>

          <h2 style="margin-top:18px;">點數明細（最近 200 筆）</h2>
          <table id="pt_ledger_table">
            <thead><tr><th>時間</th><th>異動</th><th>類型</th><th>說明</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </section>

  </main>
</div>

<div id="completeModal" class="modal-overlay hidden">
  <div class="modal-box">
    <h2>訂單完成 <span id="cpl_no"></span></h2>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">確定將此訂單標記為「訂單完成」？<br/><span style="color:var(--muted);font-size:13px;">（結案標記；若有開啟點數回饋，會在此時發放點數）</span></p>
    <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin:0;">
      <input type="checkbox" id="cpl_email" style="width:auto;margin:0;" />
      <span>同時寄信通知會員訂單已完成</span>
    </label>
    <small class="hint" id="cpl_email_note" style="display:block;margin-top:6px;">會寄到會員資料中的信箱；非會員或沒有信箱的訂單不會寄出。</small>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn" id="cpl_ok" onclick="submitComplete()">確定完成</button>
      <button class="btn secondary" onclick="closeComplete()">取消</button>
    </div>
    <div id="cpl_msg" class="msg"></div>
  </div>
</div>

<div id="correctModal" class="modal-overlay hidden">
  <div class="modal-box">
    <h2>更正訂單 <span id="cor_id"></span></h2>
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
    <label>儲值平台</label>
    <select id="cor_platform">
      <option value="__keep__">-- 不變 --</option>
      <option value="tiktok">改為：TikTok</option>
      <option value="kuaishou">改為：快手</option>
      <option value="xiaohongshu">改為：小紅書</option>
      <option value="douyin">改為：陸抖</option>
      <option value="">重設為未指定</option>
    </select>
    <label>付款方式</label>
    <select id="cor_method">
      <option value="__keep__">-- 不變 --</option>
      <option value="transfer">改為：轉帳</option>
      <option value="store_barcode">改為：超商條碼</option>
      <option value="taiwan_pay">改為：TWQR</option>
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

<input type="file" id="barcode_file_input" accept="image/*" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;" onchange="onBarcodeChosen(this)" />
<script>
const PM_LABEL = {transfer:'轉帳', store_barcode:'超商條碼', taiwan_pay:'TWQR'};
const CVS_LABEL = {seven:'7-11', family:'全家', hilife:'萊爾富'};
const PLATFORM_LABEL = {tiktok:'TikTok', kuaishou:'快手', xiaohongshu:'小紅書', douyin:'陸抖'};
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

function showTab(name, opts){
  opts = opts || {};
  document.querySelectorAll('.tab').forEach(t=>t.classList.add('hidden'));
  document.getElementById('tab-'+name).classList.remove('hidden');
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  if (name==='orders') { loadOrders(); startOrdersPolling(); }
  else { stopOrdersPolling(); }
  if (name==='members') loadMembers();
  if (name==='stats') loadStats();
  if (name==='settings') loadSettings();
  if (name==='announcement' && !opts.skipAnnouncementLoad) loadAnnouncement();
  if (name==='staff') loadStaff();
  if (name==='rates') loadRates();
  if (name==='coupons') loadCoupons();
  if (name==='points') loadPointsAdmin();
}

// ---- 訂單自動更新（輪詢）----
let ordersPollTimer = null;

function startOrdersPolling(){
  stopOrdersPolling();
  ordersPollTimer = setInterval(()=> {
    const tab = document.getElementById('tab-orders');
    const modalOpen = !document.getElementById('correctModal').classList.contains('hidden');
    const picking = barcodePickAt && (Date.now() - barcodePickAt < 120000);
    if (tab && !tab.classList.contains('hidden') && !modalOpen && !picking) {
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
      (m.phone||'').toLowerCase().includes(q) ||
      (m.email||'').toLowerCase().includes(q)
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

// 試算優惠碼折抵金額（結帳櫃檯用），prefix 對應的欄位需要有 _amount / _coupon / _coupon_msg 三個 id
async function previewCoupon(prefix){
  const amount = parseFloat(document.getElementById(prefix+'_amount').value);
  const code = document.getElementById(prefix+'_coupon').value.trim();
  const msg = document.getElementById(prefix+'_coupon_msg');
  msg.textContent=''; msg.className='msg';
  if (!amount || amount<=0){ msg.textContent='請先輸入金額'; msg.className='msg err'; return; }
  if (!code){ msg.textContent='請輸入優惠碼'; msg.className='msg err'; return; }
  try{
    const r = await api('/api/coupons/preview', {method:'POST', body: JSON.stringify({code, amount})});
    msg.textContent = \`優惠碼 \${r.code} 可折抵 $\${r.discount}，實付 $\${r.final_amount}\`;
    msg.className = 'msg ok';
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
}

async function createOrder(){
  const amount = parseFloat(document.getElementById('co_amount').value);
  const member_id = document.getElementById('co_member').value || null;
  const non_member_name = document.getElementById('co_nonmember_name').value.trim();
  const platform = document.getElementById('co_platform').value || null;
  const payment_method = document.getElementById('co_method').value || null;
  const store_brand = payment_method === 'store_barcode' ? (document.getElementById('co_store').value || null) : null;
  const coupon_code = document.getElementById('co_coupon').value.trim() || null;
  const msg = document.getElementById('co_msg');
  msg.textContent=''; msg.className='msg';
  if (!amount || amount<=0){ msg.textContent='請輸入正確金額'; msg.className='msg err'; return; }
  try{
    const r = await api('/api/admin/orders', {method:'POST', body: JSON.stringify({amount, member_id, non_member_name, platform, payment_method, store_brand, coupon_code})});
    document.getElementById('co_result').classList.remove('hidden');
    document.getElementById('co_link').value = r.link;
    document.getElementById('co_coupon').value = '';
    document.getElementById('co_coupon_msg').textContent = '';
    const discountNote = r.discount ? \`，已折抵 $\${r.discount}，實付 $\${r.amount}\` : '';
    msg.textContent = \`訂單編號 \${r.order_no}，連結已建立\${discountNote}，3 小時內有效\`;
    msg.className='msg ok';
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
}

function copyLink(){
  const el = document.getElementById('co_link');
  el.select(); document.execCommand('copy');
}

async function loadOrders(){
  clearOrderSearchState();
  const monthInput = document.getElementById('ord_month');
  if (!monthInput.value) monthInput.value = new Date().toISOString().slice(0,7);
  const month = monthInput.value;
  ordersCache = await api('/api/admin/orders?month='+encodeURIComponent(month));
  renderOrders();
}

function clearOrderSearchState(){
  document.getElementById('ord_search_clear').classList.add('hidden');
}

async function searchOrderByNo(){
  const raw = document.getElementById('ord_search').value.trim();
  if (!raw){ alert('請輸入要查詢的訂單編號'); return; }
  try{
    const results = await api('/api/admin/orders?order_no='+encodeURIComponent(raw));
    if (!results.length){ alert('查無此訂單編號：'+raw); return; }
    ordersCache = results;
    document.getElementById('ord_search_clear').classList.remove('hidden');
    renderOrders();
  }catch(e){ alert(e.message); }
}

function clearOrderSearch(){
  document.getElementById('ord_search').value = '';
  loadOrders();
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
        actions += \`<button class="btn secondary small" onclick="pickBarcode(\${o.id})">\${o.status==='ready_to_pay' ? '重新上傳條碼' : '上傳條碼'}</button>\`;
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

    const ptsNote = o.points_used > 0 ? \`<br/><span class="muted" style="color:var(--muted)">點數 \${o.points_used} 點 -$\${o.points_discount}</span>\` : '';
    const couponInfo0 = o.coupon_code
      ? \`<code>\${escapeHtml(o.coupon_code)}</code><br/><span class="muted" style="color:var(--muted)">-$\${o.coupon_discount} (原$\${o.original_amount})</span>\`
      : (o.points_used > 0 ? '' : '<span class="muted" style="color:var(--muted)">-</span>');
    const couponInfo = couponInfo0 + ptsNote;

    const accountInfo = (o.platform_account || o.platform_password)
      ? \`帳號：\${escapeHtml(o.platform_account||'-')}<br/>密碼：<code>\${escapeHtml(o.platform_password||'-')}</code>\`
      : '<span class="muted" style="color:var(--muted)">-</span>';

    return \`<tr>
      <td data-label="訂單編號"><code>\${o.order_no}</code></td>
      <td data-label="建立時間">\${toTaipeiTime(o.created_at)}</td>
      <td data-label="會員">\${o.member_name_snapshot}\${o.notify_email ? ' <span title="顧客下單時選擇：訂單完成寄信通知' + (o.notify_email_addr ? '（' + o.notify_email_addr + '）' : '') + '" style="color:var(--accent);">✉</span>' : ''}</td>
      <td data-label="儲值平台">\${PLATFORM_LABEL[o.platform]||'<span class="muted" style="color:var(--muted)">未指定</span>'}</td>
      <td data-label="帳號/密碼">\${accountInfo}</td>
      <td data-label="金額">$\${o.amount}</td>
      <td data-label="預計幣數">\${o.coins != null ? ('🪙 '+Number(o.coins).toLocaleString()) : '<span class="muted" style="color:var(--muted)">-</span>'}</td>
      <td data-label="優惠">\${couponInfo}</td>
      <td data-label="付款方式">\${PM_LABEL[o.payment_method]||'尚未選擇'}\${(o.payment_method==='store_barcode' && o.store_brand && CVS_LABEL[o.store_brand]) ? '<br/><span style="color:var(--muted);font-size:12px;">'+CVS_LABEL[o.store_brand]+'</span>' : ''}</td>
      <td data-label="狀態"><span class="badge \${st[1]}">\${st[0]}</span></td>
      <td data-label="結案">\${o.is_completed ? '<span class="badge b-completed">已結案</span>' : ''}</td>
      <td data-label="核對資訊">\${proofInfo}</td>
      <td data-label="操作">\${actions}</td>
    </tr>\`;
  }).join('') || '<tr><td colspan="13">本月尚無訂單</td></tr>';
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
  document.getElementById('cor_id').textContent = o.order_no || id;
  document.getElementById('cor_amount').value = o.amount;
  const member = o.member_id ? membersCache.find(m=>m.id===o.member_id) : null;
  corMemberPicker.selectMember(o.member_id || '', member ? member.name : '');
  document.getElementById('cor_nonmember_name').value = o.member_id ? '' : o.member_name_snapshot;
  document.getElementById('cor_platform').value = '__keep__';
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
  const platformVal = document.getElementById('cor_platform').value;
  if (platformVal !== '__keep__') body.platform = platformVal;
  const methodVal = document.getElementById('cor_method').value;
  if (methodVal !== '__keep__') body.payment_method = methodVal;
  try{
    await api('/api/admin/orders/'+correctingId, {method:'PATCH', body: JSON.stringify(body)});
    closeCorrect();
    loadOrders();
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
}

let completingId = null;

function completeOrder(id){
  completingId = id;
  const o = (typeof ordersCache !== 'undefined' && Array.isArray(ordersCache)) ? ordersCache.find(function(x){ return x.id === id; }) : null;
  document.getElementById('cpl_no').textContent = o && o.order_no ? o.order_no : '';
  const cb = document.getElementById('cpl_email');
  const optedIn = !!(o && o.notify_email);
  cb.checked = optedIn;
  cb.disabled = optedIn;
  document.getElementById('cpl_email_note').textContent = optedIn
    ? '顧客下單時已選擇要信箱通知，完成後會自動寄到：' + ((o && o.notify_email_addr) ? o.notify_email_addr : '會員資料中的信箱') + '。'
    : '會寄到會員資料中的信箱；非會員或沒有信箱的訂單不會寄出。';
  const msg = document.getElementById('cpl_msg'); msg.textContent = ''; msg.className = 'msg';
  document.getElementById('cpl_ok').disabled = false;
  document.getElementById('completeModal').classList.remove('hidden');
}

function closeComplete(){
  completingId = null;
  document.getElementById('completeModal').classList.add('hidden');
}

async function submitComplete(){
  if (!completingId) return;
  const btn = document.getElementById('cpl_ok');
  const msg = document.getElementById('cpl_msg');
  const wantEmail = document.getElementById('cpl_email').checked;
  btn.disabled = true;
  try{
    const r = await api('/api/admin/orders/'+completingId+'/complete', {method:'POST', body: JSON.stringify({send_email: wantEmail})});
    closeComplete();
    loadOrders();
    if (r && r.email) {
      alert(r.email.sent ? '訂單已完成，已寄出通知信至 ' + r.email.to : '訂單已完成，但通知信未寄出：' + r.email.reason);
    }
  }catch(e){ msg.textContent = e.message; msg.className = 'msg err'; btn.disabled = false; }
}

async function uncompleteOrder(id){
  try{ await api('/api/admin/orders/'+id+'/uncomplete', {method:'POST'}); loadOrders(); }
  catch(e){ alert(e.message); }
}

var barcodePickAt = 0;
function pickBarcode(orderId){
  barcodePickAt = Date.now();
  var inp = document.getElementById('barcode_file_input');
  inp.dataset.orderId = orderId;
  inp.value = '';
  inp.click();
}
async function onBarcodeChosen(input){
  var file = input.files && input.files[0];
  var orderId = input.dataset.orderId;
  if (!file || !orderId) { barcodePickAt = 0; return; }
  barcodePickAt = Date.now();
  try{
    var dataUrl = await compressImage(file, 1280, 0.85);
    await api('/api/admin/orders/'+orderId+'/barcode', {method:'POST', body: JSON.stringify({image_base64: dataUrl})});
    barcodePickAt = 0;
    input.value = '';
    loadOrders();
  }catch(e){ barcodePickAt = 0; alert(e.message || '上傳失敗，請再試一次'); }
}

// 壓縮圖片：縮到最長邊 1280px、轉成 JPEG，避免安卓大照片或格式標記異常造成上傳失敗
function compressImage(file, maxDim, quality){
  maxDim = maxDim || 1280; quality = quality || 0.85;
  function readRaw(){
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload = function(){ resolve(r.result); };
      r.onerror = function(){ reject(new Error('讀取圖片失敗')); };
      r.readAsDataURL(file);
    });
  }
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      try{
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, maxDim / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        var c = document.createElement('canvas'); c.width = cw; c.height = ch;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      }catch(e){ URL.revokeObjectURL(url); readRaw().then(resolve, reject); }
    };
    img.onerror = function(){ URL.revokeObjectURL(url); readRaw().then(resolve, reject); };
    img.src = url;
  });
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
    <td data-label="ID">\${m.id}</td><td data-label="姓名">\${m.name}</td><td data-label="帳號">\${m.account||''}</td><td data-label="電話">\${m.phone||''}</td><td data-label="電子信箱">\${m.email||''}\${m.email && m.email_verified_at ? ' <span title="已通過信箱驗證" style="color:#1E7A56">✓</span>' : ''}</td><td data-label="備註">\${m.note||''}</td>
    <td data-label="推薦碼"><code>\${m.referral_code||''}</code> <button class="btn secondary small" onclick="copyReferralLink('\${m.referral_code}')">複製邀請連結</button></td>
    <td data-label="推薦人">\${m.referred_by_name||'-'}</td>
    <td data-label="操作">
      <button class="btn secondary small" onclick="editMember(\${m.id})">編輯</button>
      <button class="btn secondary small" onclick="resetPassword(\${m.id})">設定密碼</button>
      <button class="btn danger small" onclick="deleteMember(\${m.id})">刪除</button>
    </td>
  </tr>\`).join('') || '<tr><td colspan="9">尚無會員</td></tr>';
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
  document.getElementById('mem_email').value = m.email || '';
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
  document.getElementById('mem_email').value='';
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
  const email = document.getElementById('mem_email').value.trim();
  const note = document.getElementById('mem_note').value.trim();
  const account = document.getElementById('mem_account').value.trim();
  const password = document.getElementById('mem_password').value;
  const msg = document.getElementById('mem_msg');
  if (!name){ msg.textContent='請輸入姓名'; msg.className='msg err'; return; }
  try{
    if (editingMemberId){
      await api('/api/admin/members/'+editingMemberId, {method:'PATCH', body: JSON.stringify({name,phone,email,note,account})});
      if (password) await api('/api/admin/members/'+editingMemberId+'/password', {method:'POST', body: JSON.stringify({password})});
      msg.textContent='已儲存修改'; msg.className='msg ok';
      cancelEditMember();
    } else {
      await api('/api/admin/members', {method:'POST', body: JSON.stringify({name,phone,email,note,account,password})});
      document.getElementById('mem_name').value='';
      document.getElementById('mem_phone').value='';
      document.getElementById('mem_email').value='';
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

let rateRowsByGroup = { tiktok: [], other: [] };

async function loadRates() {
  await Promise.all(['tiktok', 'other'].map(loadRatesGroup));
}

async function loadRatesGroup(group) {
  const msg = document.getElementById('rates_msg_'+group);
  msg.textContent = '';
  try {
    const data = await api('/api/admin/rates?group='+group);
    rateRowsByGroup[group] = data.rules || [];
    renderRateRows(group);
  } catch (e) {
    msg.textContent = e.message; msg.className = 'msg err';
  }
}

function renderRateRows(group) {
  const container = document.getElementById('rates_list_'+group);
  const rows = rateRowsByGroup[group];
  if (!rows.length) {
    container.innerHTML = '<div class="msg">尚無費率，請點「新增一筆」</div>';
    return;
  }
  container.innerHTML = rows.map((r, i) => \`
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
      <span style="min-width:80px;font-size:13px;color:var(--muted);">金額 ≥</span>
      <input type="number" value="\${r.min}" onchange="updateRate('\${group}',\${i},'min',this.value)" style="max-width:140px;">
      <span style="font-size:13px;color:var(--muted);">→ 匯率</span>
      <input type="number" step="0.001" value="\${r.rate}" onchange="updateRate('\${group}',\${i},'rate',this.value)" style="max-width:120px;">
      <button class="btn danger small" onclick="removeRate('\${group}',\${i})">刪除</button>
    </div>
  \`).join('');
}

function updateRate(group, index, field, value) {
  const num = parseFloat(value);
  if (isNaN(num)) return;
  rateRowsByGroup[group][index][field] = num;
}

function removeRate(group, index) {
  rateRowsByGroup[group].splice(index, 1);
  renderRateRows(group);
}

function addRateRow(group) {
  rateRowsByGroup[group].push({ min: 0, rate: 1.0 });
  renderRateRows(group);
}

async function saveRates(group) {
  const msg = document.getElementById('rates_msg_'+group);
  msg.textContent = '';
  const rows = rateRowsByGroup[group];
  if (!rows.length) {
    msg.textContent = '至少需要一筆費率'; msg.className = 'msg err'; return;
  }
  try {
    await api('/api/admin/rates', {method:'POST', body: JSON.stringify({group, rules: rows})});
    msg.textContent = '已儲存，會員下次登入即生效'; msg.className = 'msg ok';
    loadRatesGroup(group);
  } catch (e) { msg.textContent = e.message; msg.className = 'msg err'; }
}

async function resetRates(group) {
  if (!confirm('確定還原成程式預設的費率嗎？此動作會覆蓋資料庫目前的設定。')) return;
  const msg = document.getElementById('rates_msg_'+group);
  try {
    rateRowsByGroup[group] = [
      { min: 0, rate: 2.500 }
    ];
    renderRateRows(group);
    await api('/api/admin/rates', {method:'POST', body: JSON.stringify({group, rules: rateRowsByGroup[group]})});
    msg.textContent = '已還原預設值'; msg.className = 'msg ok';
  } catch (e) { msg.textContent = e.message; msg.className = 'msg err'; }
}

// ---- 優惠碼 ----

let couponsCache = [];
let editingCouponId = null;


// ================= 點數系統（後台）=================
let ptItemsCache = [];
let ptEditingItemId = null;
const PT_TYPE = {earn:'完成回饋', spend:'訂單折抵', redeem:'商城兌換', refund:'退回', admin:'店家調整'};
const PT_RED = {pending:'待處理', fulfilled:'已完成', rejected:'已拒絕並退點'};

function loadPointsAdmin(){
  loadPointsConfigAdmin();
  loadRedemptionsAdmin();
  loadPointItemsAdmin();
  loadPointMembersAdmin();
}

async function loadPointsConfigAdmin(){
  try{
    const c = await api('/api/admin/points/config');
    document.getElementById('pt_earn_enabled').checked = !!c.earn_enabled;
    document.getElementById('pt_discount_enabled').checked = !!c.discount_enabled;
    document.getElementById('pt_shop_enabled').checked = !!c.shop_enabled;
    document.getElementById('pt_earn_per').value = c.earn_per;
    document.getElementById('pt_redeem_value').value = c.redeem_value;
    document.getElementById('pt_max_percent').value = c.max_percent;
  }catch(e){ const m=document.getElementById('pt_cfg_msg'); m.textContent=e.message; m.className='msg err'; }
}

async function savePointsConfigAdmin(){
  const m = document.getElementById('pt_cfg_msg');
  m.textContent=''; m.className='msg';
  try{
    await api('/api/admin/points/config', {method:'POST', body: JSON.stringify({
      earn_enabled: document.getElementById('pt_earn_enabled').checked,
      discount_enabled: document.getElementById('pt_discount_enabled').checked,
      shop_enabled: document.getElementById('pt_shop_enabled').checked,
      earn_per: document.getElementById('pt_earn_per').value,
      redeem_value: document.getElementById('pt_redeem_value').value,
      max_percent: document.getElementById('pt_max_percent').value,
    })});
    m.textContent='已儲存'; m.className='msg ok';
  }catch(e){ m.textContent=e.message; m.className='msg err'; }
}

let ptRedPage = 1;
const PT_RED_SIZE = 10;

async function loadRedemptionsAdmin(page){
  if (page) ptRedPage = page;
  const m = document.getElementById('pt_red_msg');
  try{
    const d = await api('/api/admin/points/redemptions?page='+ptRedPage+'&size='+PT_RED_SIZE);
    ptRedPage = d.page;
    document.querySelector('#pt_red_table tbody').innerHTML = d.rows.map(function(r){
      const ops = r.status === 'pending'
        ? '<button class="btn small" onclick="processRedemption('+r.id+',\\'fulfill\\')">標記完成</button>' +
          '<button class="btn danger small" onclick="processRedemption('+r.id+',\\'reject\\')">拒絕並退點</button>'
        : (r.admin_note ? escapeHtml(r.admin_note) : '-');
      return '<tr><td data-label="時間">'+toTaipeiTime(r.created_at)+'</td>' +
        '<td data-label="會員">'+escapeHtml(r.member_name||'(已刪除)')+(r.member_phone ? '<br/><span style="color:var(--muted);font-size:12px;">'+escapeHtml(r.member_phone)+'</span>' : '')+'</td>' +
        '<td data-label="商品">'+escapeHtml(r.item_name)+(r.member_note ? '<br/><span style="color:var(--muted);font-size:12px;">備註：'+escapeHtml(r.member_note)+'</span>' : '')+'</td>' +
        '<td data-label="點數">'+r.cost+'</td>' +
        '<td data-label="狀態">'+(PT_RED[r.status]||r.status)+'</td>' +
        '<td data-label="操作">'+ops+'</td></tr>';
    }).join('') || '<tr><td colspan="6">尚無兌換單</td></tr>';
    const pg = document.getElementById('pt_red_pager');
    if (d.total > PT_RED_SIZE) {
      pg.innerHTML = '<button class="btn secondary small" '+(d.page<=1?'disabled':'')+' onclick="loadRedemptionsAdmin('+(d.page-1)+')">‹ 上一頁</button>' +
        '<span>第 '+d.page+' / '+d.pages+' 頁（共 '+d.total+' 筆）</span>' +
        '<button class="btn secondary small" '+(d.page>=d.pages?'disabled':'')+' onclick="loadRedemptionsAdmin('+(d.page+1)+')">下一頁 ›</button>';
    } else {
      pg.innerHTML = d.total ? '<span>共 '+d.total+' 筆</span>' : '';
    }
  }catch(e){ m.textContent=e.message; m.className='msg err'; }
}

async function processRedemption(id, action){
  const isReject = action === 'reject';
  const note = prompt(isReject ? '拒絕原因（會顯示給會員，點數會退回）：' : '備註（選填，會顯示給會員）：', '');
  if (note === null) return;
  const m = document.getElementById('pt_red_msg');
  m.textContent=''; m.className='msg';
  try{
    await api('/api/admin/points/redemptions/'+id+'/'+action, {method:'POST', body: JSON.stringify({admin_note: note})});
    loadRedemptionsAdmin(); loadPointItemsAdmin(); loadPointMembersAdmin();
  }catch(e){ m.textContent=e.message; m.className='msg err'; }
}

async function loadPointItemsAdmin(){
  const m = document.getElementById('pt_item_msg');
  try{
    ptItemsCache = await api('/api/admin/points/items');
    document.querySelector('#pt_item_table tbody').innerHTML = ptItemsCache.map(function(it){
      return '<tr><td data-label="商品">'+escapeHtml(it.name)+(it.description ? '<br/><span style="color:var(--muted);font-size:12px;">'+escapeHtml(it.description)+'</span>' : '')+'</td>' +
        '<td data-label="點數">'+it.cost+'</td>' +
        '<td data-label="庫存">'+(it.stock == null ? '不限' : it.stock)+'</td>' +
        '<td data-label="狀態">'+(it.is_active ? '上架中' : '已下架')+'</td>' +
        '<td data-label="操作">' +
          '<button class="btn secondary small" onclick="editPointItem('+it.id+')">編輯</button>' +
          '<button class="btn secondary small" onclick="togglePointItem('+it.id+','+it.is_active+')">'+(it.is_active ? '下架' : '上架')+'</button>' +
          '<button class="btn danger small" onclick="deletePointItem('+it.id+')">刪除</button>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="5">尚無商品</td></tr>';
  }catch(e){ m.textContent=e.message; m.className='msg err'; }
}

function editPointItem(id){
  const it = ptItemsCache.find(function(x){ return x.id === id; });
  if (!it) return;
  ptEditingItemId = id;
  document.getElementById('pt_item_name').value = it.name;
  document.getElementById('pt_item_cost').value = it.cost;
  document.getElementById('pt_item_desc').value = it.description || '';
  document.getElementById('pt_item_stock').value = it.stock == null ? '' : it.stock;
  document.getElementById('pt_item_form_title').textContent = '編輯商品';
  document.getElementById('pt_item_submit').textContent = '儲存修改';
  document.getElementById('pt_item_cancel').classList.remove('hidden');
  document.getElementById('pt_item_name').scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelEditPointItem(){
  ptEditingItemId = null;
  ['pt_item_name','pt_item_cost','pt_item_desc','pt_item_stock'].forEach(function(i){ document.getElementById(i).value=''; });
  document.getElementById('pt_item_form_title').textContent = '點數商城商品';
  document.getElementById('pt_item_submit').textContent = '新增商品';
  document.getElementById('pt_item_cancel').classList.add('hidden');
}

async function submitPointItem(){
  const m = document.getElementById('pt_item_msg');
  m.textContent=''; m.className='msg';
  const body = {
    name: document.getElementById('pt_item_name').value,
    cost: document.getElementById('pt_item_cost').value,
    description: document.getElementById('pt_item_desc').value,
    stock: document.getElementById('pt_item_stock').value,
  };
  try{
    if (ptEditingItemId) await api('/api/admin/points/items/'+ptEditingItemId, {method:'PATCH', body: JSON.stringify(body)});
    else await api('/api/admin/points/items', {method:'POST', body: JSON.stringify(body)});
    cancelEditPointItem();
    m.textContent='已儲存'; m.className='msg ok';
    loadPointItemsAdmin();
  }catch(e){ m.textContent=e.message; m.className='msg err'; }
}

async function togglePointItem(id, active){
  try{
    await api('/api/admin/points/items/'+id, {method:'PATCH', body: JSON.stringify({is_active: !active})});
    loadPointItemsAdmin();
  }catch(e){ alert(e.message); }
}

async function deletePointItem(id){
  if (!confirm('確定刪除此商品？（已建立的兌換單不受影響）')) return;
  try{
    await api('/api/admin/points/items/'+id, {method:'DELETE'});
    if (ptEditingItemId === id) cancelEditPointItem();
    loadPointItemsAdmin();
  }catch(e){ alert(e.message); }
}

let ptMembers = [];
const PT_MEM_SIZE = 10;
let ptMemPage = 1;
let ptDetailId = null;

async function loadPointMembersAdmin(){
  try{
    ptMembers = await api('/api/admin/points/members');
    renderPointMembers();
    if (ptDetailId) renderPointDetailHeader();
  }catch(e){ /* ignore */ }
}

function ptFilteredMembers(){
  const q = document.getElementById('pt_mem_search').value.trim().toLowerCase();
  if (!q) return ptMembers;
  return ptMembers.filter(function(m){
    return [m.name, m.account, m.phone, m.email].some(function(v){ return v && String(v).toLowerCase().indexOf(q) >= 0; });
  });
}

function onPtSearch(){ ptMemPage = 1; renderPointMembers(); }
function gotoPtMemPage(p){ ptMemPage = p; renderPointMembers(); }

function renderPointMembers(){
  const list = ptFilteredMembers();
  const pages = Math.max(1, Math.ceil(list.length / PT_MEM_SIZE));
  if (ptMemPage > pages) ptMemPage = pages;
  if (ptMemPage < 1) ptMemPage = 1;
  const shown = list.slice((ptMemPage - 1) * PT_MEM_SIZE, ptMemPage * PT_MEM_SIZE);
  document.querySelector('#pt_mem_table tbody').innerHTML = shown.map(function(r){
    return '<tr><td data-label="會員">'+escapeHtml(r.name)+(r.phone ? '<br/><span style="color:var(--muted);font-size:12px;">'+escapeHtml(r.phone)+'</span>' : '')+'</td>' +
      '<td data-label="帳號">'+escapeHtml(r.account||'')+'</td>' +
      '<td data-label="目前點數"><b>'+r.balance+'</b></td><td data-label="累計獲得">'+r.earned_total+'</td>' +
      '<td data-label="操作"><button class="btn secondary small" onclick="openPointDetail('+r.id+')">查看明細</button>' +
      '<button class="btn small" onclick="openPointDetail('+r.id+', true)">調整點數</button></td></tr>';
  }).join('') || '<tr><td colspan="5">'+(ptMembers.length ? '找不到符合的會員' : '尚無會員')+'</td></tr>';
  const q = document.getElementById('pt_mem_search').value.trim();
  document.getElementById('pt_mem_count').textContent = q
    ? '符合 ' + list.length + ' 位（共 ' + ptMembers.length + ' 位會員）'
    : '共 ' + ptMembers.length + ' 位會員';
  document.getElementById('pt_mem_pager').innerHTML = list.length > PT_MEM_SIZE
    ? '<button type="button" class="btn secondary small" ' + (ptMemPage <= 1 ? 'disabled' : '') + ' onclick="gotoPtMemPage(' + (ptMemPage - 1) + ')">‹ 上一頁</button>' +
      '<span>第 ' + ptMemPage + ' / ' + pages + ' 頁</span>' +
      '<button type="button" class="btn secondary small" ' + (ptMemPage >= pages ? 'disabled' : '') + ' onclick="gotoPtMemPage(' + (ptMemPage + 1) + ')">下一頁 ›</button>'
    : '';
}

function renderPointDetailHeader(){
  const m = ptMembers.find(function(x){ return x.id === ptDetailId; });
  if (!m) return;
  document.getElementById('pt_detail_title').textContent = m.name + (m.account ? '（' + m.account + '）' : '');
  document.getElementById('pt_detail_bal').innerHTML = '目前點數：<b style="color:var(--ink);">' + m.balance + '</b> 點　累計獲得：' + m.earned_total + ' 點';
}

async function loadPointLedger(){
  const tbody = document.querySelector('#pt_ledger_table tbody');
  tbody.innerHTML = '<tr><td colspan="4">載入中…</td></tr>';
  try{
    const list = await api('/api/admin/points/ledger?member_id='+ptDetailId);
    tbody.innerHTML = list.map(function(l){
      return '<tr><td data-label="時間">'+toTaipeiTime(l.created_at)+'</td><td data-label="異動"><b style="color:'+(l.delta>0?'var(--ok)':'var(--danger)')+'">'+(l.delta>0?'+':'')+l.delta+'</b></td>' +
        '<td data-label="類型">'+(PT_TYPE[l.type]||l.type)+'</td><td data-label="說明">'+escapeHtml(l.note||'')+'</td></tr>';
    }).join('') || '<tr><td colspan="4">尚無紀錄</td></tr>';
  }catch(e){ tbody.innerHTML = '<tr><td colspan="4">'+escapeHtml(e.message)+'</td></tr>'; }
}

// 進入單一會員：整個會員列表（含搜尋）收合，只留這位會員的調整表單與明細
async function openPointDetail(id, focusAdjust){
  ptDetailId = id;
  document.getElementById('pt_list_view').classList.add('hidden');
  document.getElementById('pt_detail_view').classList.remove('hidden');
  document.getElementById('pt_adj_delta').value = '';
  document.getElementById('pt_adj_note').value = '';
  document.getElementById('pt_adj_msg').textContent = '';
  renderPointDetailHeader();
  document.getElementById('pt_members_card').scrollIntoView({behavior:'smooth', block:'start'});
  if (focusAdjust) document.getElementById('pt_adj_delta').focus();
  await loadPointLedger();
}

function closePointDetail(){
  ptDetailId = null;
  document.getElementById('pt_detail_view').classList.add('hidden');
  document.getElementById('pt_list_view').classList.remove('hidden');
  loadPointMembersAdmin();
}

async function submitPointAdjust(){
  const m = document.getElementById('pt_adj_msg');
  m.textContent=''; m.className='msg';
  if (!ptDetailId){ return; }
  try{
    const r = await api('/api/admin/points/adjust', {method:'POST', body: JSON.stringify({
      member_id: ptDetailId,
      delta: document.getElementById('pt_adj_delta').value,
      note: document.getElementById('pt_adj_note').value,
    })});
    document.getElementById('pt_adj_delta').value=''; document.getElementById('pt_adj_note').value='';
    m.textContent='已調整，目前 '+r.balance+' 點'; m.className='msg ok';
    await loadPointMembersAdmin();
    loadPointLedger();
  }catch(e){ m.textContent=e.message; m.className='msg err'; }
}

async function loadCoupons(){
  const msg = document.getElementById('cp_msg');
  try{
    couponsCache = await api('/api/admin/coupons');
    renderCoupons();
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
}

function renderCoupons(){
  const tbody = document.querySelector('#cp_table tbody');
  tbody.innerHTML = couponsCache.map(c=>{
    const now = new Date();
    const expired = c.expires_at && new Date(c.expires_at.replace(' ','T')+'Z') < now;
    const usedUp = c.usage_limit != null && c.used_count >= c.usage_limit;
    let statusBadge;
    if (!c.is_active) statusBadge = '<span class="badge b-cancel">已停用</span>';
    else if (expired) statusBadge = '<span class="badge b-expired">已過期</span>';
    else if (usedUp) statusBadge = '<span class="badge b-expired">已用完</span>';
    else statusBadge = '<span class="badge b-ready">啟用中</span>';

    const isFixed = c.discount_type === 'fixed';
    const discountLabel = isFixed ? ('折抵 $'+c.discount_amount) : (c.discount_percent+'%');
    const limitInfo = isFixed
      ? [c.min_order_amount ? ('滿 $'+c.min_order_amount+' 可用') : '無門檻']
      : [
          c.max_discount_amount != null ? ('上限 $'+c.max_discount_amount) : '上限不限',
          c.min_order_amount ? ('滿 $'+c.min_order_amount+' 可用') : '無門檻',
        ];
    const usageInfo = c.used_count + ' / ' + (c.usage_limit != null ? c.usage_limit : '不限');

    return \`<tr>
      <td data-label="代碼"><code>\${escapeHtml(c.code)}</code>\${c.note ? '<br/><span class="muted" style="color:var(--muted);font-size:12px;">'+escapeHtml(c.note)+'</span>' : ''}</td>
      <td data-label="折扣">\${discountLabel}</td>
      <td data-label="上限/門檻">\${limitInfo.join('<br/>')}</td>
      <td data-label="使用狀況">\${usageInfo}</td>
      <td data-label="到期時間">\${c.expires_at ? toTaipeiTime(c.expires_at) : '不過期'}</td>
      <td data-label="狀態">\${statusBadge}</td>
      <td data-label="操作">
        <button class="btn secondary small" onclick="editCoupon(\${c.id})">編輯</button>
        <button class="btn secondary small" onclick="toggleCouponActive(\${c.id}, \${c.is_active})">\${c.is_active ? '停用' : '啟用'}</button>
        <button class="btn small" onclick="broadcastCoupon(\${c.id})">發送給會員</button>
        <button class="btn danger small" onclick="deleteCoupon(\${c.id})">刪除</button>
      </td>
    </tr>\`;
  }).join('') || '<tr><td colspan="7">尚無優惠碼</td></tr>';
}

function updateCouponTypeView(){
  const isFixed = document.getElementById('cp_type').value === 'fixed';
  document.getElementById('cp_percent_wrap').classList.toggle('hidden', isFixed);
  document.getElementById('cp_amount_wrap').classList.toggle('hidden', !isFixed);
  document.getElementById('cp_max_wrap').classList.toggle('hidden', isFixed);
}

function toDatetimeLocalValue(dateStr){
  if (!dateStr) return '';
  const iso = String(dateStr).replace(' ','T') + 'Z';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
}

function editCoupon(id){
  const c = couponsCache.find(x=>x.id===id);
  if (!c) return;
  editingCouponId = id;
  document.getElementById('cp_code').value = c.code;
  document.getElementById('cp_type').value = c.discount_type === 'fixed' ? 'fixed' : 'percent';
  document.getElementById('cp_percent').value = c.discount_percent != null ? c.discount_percent : '';
  document.getElementById('cp_amount').value = c.discount_amount != null ? c.discount_amount : '';
  document.getElementById('cp_max').value = c.max_discount_amount != null ? c.max_discount_amount : '';
  document.getElementById('cp_min').value = c.min_order_amount || '';
  document.getElementById('cp_limit').value = c.usage_limit != null ? c.usage_limit : '';
  document.getElementById('cp_expires').value = toDatetimeLocalValue(c.expires_at);
  document.getElementById('cp_note').value = c.note || '';
  updateCouponTypeView();
  document.getElementById('cp_form_title').textContent = '編輯優惠碼：' + c.code;
  document.getElementById('cp_submit_btn').textContent = '儲存修改';
  document.getElementById('cp_cancel_btn').classList.remove('hidden');
  document.getElementById('cp_msg').textContent = '';
  document.getElementById('cp_code').scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelEditCoupon(){
  editingCouponId = null;
  document.getElementById('cp_code').value = '';
  document.getElementById('cp_type').value = 'percent';
  document.getElementById('cp_percent').value = '';
  document.getElementById('cp_amount').value = '';
  document.getElementById('cp_max').value = '';
  document.getElementById('cp_min').value = '';
  document.getElementById('cp_limit').value = '';
  document.getElementById('cp_expires').value = '';
  document.getElementById('cp_note').value = '';
  updateCouponTypeView();
  document.getElementById('cp_form_title').textContent = '新增優惠碼';
  document.getElementById('cp_submit_btn').textContent = '新增';
  document.getElementById('cp_cancel_btn').classList.add('hidden');
  document.getElementById('cp_msg').textContent = '';
}

async function submitCoupon(){
  const msg = document.getElementById('cp_msg');
  msg.textContent=''; msg.className='msg';
  const code = document.getElementById('cp_code').value.trim();
  const discount_type = document.getElementById('cp_type').value === 'fixed' ? 'fixed' : 'percent';
  const percentVal = document.getElementById('cp_percent').value.trim();
  const amountVal = document.getElementById('cp_amount').value.trim();
  const maxVal = document.getElementById('cp_max').value.trim();
  const minVal = document.getElementById('cp_min').value.trim();
  const limitVal = document.getElementById('cp_limit').value.trim();
  const expiresVal = document.getElementById('cp_expires').value;
  const note = document.getElementById('cp_note').value.trim();

  if (!code){ msg.textContent='請輸入優惠碼'; msg.className='msg err'; return; }
  if (discount_type === 'percent'){
    const v = parseFloat(percentVal);
    if (!v || v<=0 || v>100){ msg.textContent='折扣百分比需介於 0~100'; msg.className='msg err'; return; }
  } else {
    const v = parseFloat(amountVal);
    if (!v || v<=0){ msg.textContent='折抵金額需大於 0'; msg.className='msg err'; return; }
  }

  const body = {
    code,
    discount_type,
    discount_percent: discount_type === 'percent' ? parseFloat(percentVal) : null,
    discount_amount: discount_type === 'fixed' ? parseFloat(amountVal) : null,
    max_discount_amount: (discount_type === 'percent' && maxVal !== '') ? parseFloat(maxVal) : null,
    min_order_amount: minVal === '' ? 0 : parseFloat(minVal),
    usage_limit: limitVal === '' ? null : parseInt(limitVal, 10),
    expires_at: expiresVal || null,
    note: note || null,
  };

  try{
    if (editingCouponId){
      await api('/api/admin/coupons/'+editingCouponId, {method:'PATCH', body: JSON.stringify(body)});
      msg.textContent='已儲存修改'; msg.className='msg ok';
      cancelEditCoupon();
    } else {
      await api('/api/admin/coupons', {method:'POST', body: JSON.stringify(body)});
      cancelEditCoupon();
      msg.textContent='已新增優惠碼'; msg.className='msg ok';
    }
    loadCoupons();
  }catch(e){ msg.textContent=e.message; msg.className='msg err'; }
}

async function toggleCouponActive(id, currentlyActive){
  try{
    await api('/api/admin/coupons/'+id, {method:'PATCH', body: JSON.stringify({is_active: !currentlyActive})});
    loadCoupons();
  }catch(e){ alert(e.message); }
}

async function deleteCoupon(id){
  if (!confirm('確定永久刪除此優惠碼？已使用過此優惠碼的訂單記錄不會受影響。')) return;
  try{
    await api('/api/admin/coupons/'+id, {method:'DELETE'});
    loadCoupons();
  }catch(e){ alert(e.message); }
}

// 一鍵把優惠碼內容帶入「系統公告」，統一透過既有的會員公告彈窗發送給所有會員
async function broadcastCoupon(id){
  const c = couponsCache.find(x=>x.id===id);
  if (!c) return;
  if (!confirm('會把「系統公告」分頁換成這組優惠碼的宣傳文字（會先覆蓋掉目前公告內容），帶入後還要到該分頁按「儲存」才會真的發送給會員，是否繼續？')) return;

  const isFixed = c.discount_type === 'fixed';
  const lines = [];
  lines.push('🎉 優惠碼上線：'+c.code);
  lines.push(isFixed
    ? ('折扣：直接折抵 $'+c.discount_amount)
    : ('折扣：現折 '+c.discount_percent+'%'+(c.max_discount_amount != null ? '（最高折抵 $'+c.max_discount_amount+'）' : '')));
  lines.push(c.min_order_amount ? ('訂單滿 $'+c.min_order_amount+' 元即可使用') : '無金額門檻，即可使用');
  if (c.usage_limit != null) lines.push('限量 '+c.usage_limit+' 次，用完為止，把握機會！');
  if (c.expires_at) lines.push('使用期限至：'+toTaipeiTime(c.expires_at));
  if (c.note) lines.push(c.note);
  lines.push('下單時輸入優惠碼「'+c.code+'」即可折抵，數量有限，手刀搶用！');

  try{ await loadAnnouncement(); }catch(e){ /* 帶不到目前公告也沒關係，直接用新內容覆蓋 */ }

  document.getElementById('ann_enabled').checked = true;
  document.getElementById('ann_title').value = '優惠碼上線：'+c.code;
  document.getElementById('ann_type').value = 'text';
  document.getElementById('ann_text').value = lines.join('\\n');
  annImages = [];
  renderAnnouncementImageList();
  updateAnnouncementTypeView();

  showTab('announcement', {skipAnnouncementLoad: true});
  const msg = document.getElementById('ann_msg');
  msg.textContent = '已帶入優惠碼「'+c.code+'」的宣傳文字，確認內容無誤後請按「儲存」，會員下次登入 /member 才會看到';
  msg.className = 'msg ok';
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
    display:flex;flex-direction:column;align-items:center;padding:24px 14px;}
  .card{background:#fff;border:1px solid #e2e4e8;border-radius:12px;padding:24px;max-width:420px;width:100%;}
  h1{font-size:18px;margin-top:0;}
  .amount{font-size:32px;font-weight:700;text-align:center;margin:14px 0;}
  .row{display:flex;justify-content:space-between;font-size:14px;color:#6b7280;margin:6px 0;}
  .methods{display:flex;flex-direction:column;gap:10px;margin-top:16px;}
  .methods button{padding:14px;border-radius:8px;border:1px solid #2f6fed;background:#fff;color:#2f6fed;font-size:15px;cursor:pointer;}
  .methods button:hover{background:#eef3ff;}
  .info-box{background:#f0f2f5;border-radius:8px;padding:14px;margin-top:16px;font-size:14px;line-height:1.8;}
  img.barcode{max-width:100%;margin-top:12px;border:1px solid #e2e4e8;border-radius:8px;display:block;}
  .barcode-wrap{position:relative;display:inline-block;max-width:100%;}
  .barcode-watermark{position:absolute;top:12px;left:0;right:0;bottom:0;pointer-events:none;border-radius:8px;overflow:hidden;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='130' height='80'><text x='65' y='46' text-anchor='middle' font-size='18' fill='rgba(200,40,30,0.33)' font-weight='700' font-family='sans-serif' transform='rotate(-28 65 40)'>咖啡代儲用</text></svg>");
    background-repeat:repeat;}
  .center{text-align:center;}
  .muted{color:#6b7280;font-size:13px;}
  .error{color:#e0453c;text-align:center;margin-top:40px;}
  .badge-paid{background:#1f9d55;color:#fff;padding:6px 14px;border-radius:20px;display:inline-block;}
  .proof-box{margin-top:16px;border-top:1px dashed #e2e4e8;padding-top:14px;}
  .proof-box label{display:block;font-size:13px;color:#6b7280;margin:8px 0 4px;}
  .proof-box input[type=text]{width:100%;padding:9px 10px;border:1px solid #e2e4e8;border-radius:6px;font-size:14px;box-sizing:border-box;}
  .proof-box button{width:100%;margin-top:10px;padding:10px;border-radius:8px;border:none;background:#2f6fed;color:#fff;font-size:14px;cursor:pointer;}
  .proof-done{background:#eef9f0;color:#1f9d55;border-radius:8px;padding:10px;margin-top:14px;font-size:13px;text-align:center;}
${SITE_DISCLAIMER_CSS}
</style>
</head>
<body>
<div class="card" id="app">載入中...</div>
<script>
const token = location.pathname.split('/').pop();
const PM_LABEL = {transfer:'轉帳', store_barcode:'超商條碼', taiwan_pay:'TWQR'};
const PLATFORM_LABEL = {tiktok:'TikTok', kuaishou:'快手', xiaohongshu:'小紅書', douyin:'陸抖'};
const CVS_STORES = {seven:'7-11', family:'全家', hilife:'萊爾富'};
const CVS_LIMIT = 10000;
const CVS_FEE = 15;
let storePickOpen = false;
let lastOrder = null;
let pollTimer=null;

// === 將 UTC 時間轉為台灣時間 (UTC+8) ===
function toTaipeiTime(dateStr) {
  if (!dateStr) return "";
  const isoStr = String(dateStr).replace(" ", "T") + "Z";
  return new Date(isoStr).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}
// ========================================================

function openStorePick(){ storePickOpen = true; if (lastOrder) render(lastOrder); }
function closeStorePick(){ storePickOpen = false; if (lastOrder) render(lastOrder); }

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
  lastOrder = o;
  const app = document.getElementById('app');
  let html = '<h1>付款資訊</h1>';
  if (o.order_no) {
    html += '<div class="row"><span>訂單編號</span><span><code>'+o.order_no+'</code></span></div>';
  }
  if (o.coupon_code) {
    html += '<div class="row"><span>原始金額</span><span>$'+o.original_amount+'</span></div>';
    html += '<div class="row"><span>優惠碼 '+o.coupon_code+'</span><span>-$'+o.coupon_discount+'</span></div>';
  }
  if (o.points_used > 0) {
    if (!o.coupon_code) html += '<div class="row"><span>原始金額</span><span>$'+o.original_amount+'</span></div>';
    html += '<div class="row"><span>點數折抵（'+o.points_used+' 點）</span><span>-$'+o.points_discount+'</span></div>';
  }
  html += '<div class="amount">$'+o.amount+'</div>';
  html += '<div class="row"><span>付款對象</span><span>'+o.member_name_snapshot+'</span></div>';
  if (o.platform) {
    html += '<div class="row"><span>儲值平台</span><span>'+(PLATFORM_LABEL[o.platform]||o.platform)+'</span></div>';
  }
  if (o.coins != null) {
    html += '<div class="row"><span>預計獲得</span><span>🪙 '+Number(o.coins).toLocaleString()+' 抖幣</span></div>';
  }

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

  if (!pollTimer) pollTimer = setInterval(function(){ if (window.proofPickAt && Date.now()-window.proofPickAt<120000) return; load(); }, 5000);

  html += '<div class="row"><span>到期時間</span><span>'+toTaipeiTime(o.expires_at)+'</span></div>';

  if (!o.payment_method) {
    const overLimit = o.amount > CVS_LIMIT;
    const feeNote = '<div class=\"info-box\" style=\"margin-top:12px;\">使用超商條碼需<b>自付 $'+CVS_FEE+' 超商手續費</b>，繳費時請於超商另行支付。</div>';
    if (storePickOpen && !overLimit) {
      html += '<div class=\"muted\" style=\"margin-top:14px;\">請選擇要繳費的超商（選擇後將無法變更）</div>';
      html += '<div class=\"methods\">'+
        '<button onclick=\"selectMethod(\\'store_barcode\\',\\'seven\\')\">7-11</button>'+
        '<button onclick=\"selectMethod(\\'store_barcode\\',\\'family\\')\">全家</button>'+
        '<button onclick=\"selectMethod(\\'store_barcode\\',\\'hilife\\')\">萊爾富</button>'+
      '</div>';
      html += feeNote;
      html += '<div class=\"center\" style=\"margin-top:12px;\"><a href=\"#\" onclick=\"closeStorePick();return false;\" style=\"color:#6b7280;font-size:14px;\">‹ 返回選擇付款方式</a></div>';
    } else {
      html += '<div class=\"muted\" style=\"margin-top:14px;\">請選擇付款方式（選擇後將無法變更）</div>';
      html += '<div class=\"methods\">'+
        '<button onclick=\"selectMethod(\\'transfer\\')\">轉帳</button>'+
        (overLimit
          ? '<button disabled style=\"opacity:.45;cursor:not-allowed;\">超商條碼</button>'
          : '<button onclick=\"openStorePick()\">超商條碼</button>')+
        '<button onclick=\"selectMethod(\\'taiwan_pay\\')\">TWQR</button>'+
      '</div>';
      if (overLimit) {
        html += '<div style=\"color:#e0453c;font-size:14px;margin-top:12px;text-align:center;\">超過 $'+CVS_LIMIT.toLocaleString()+' 無法使用超商條碼，請分筆訂單</div>';
      }
    }
    app.innerHTML = html;
    return;
  }

  html += '<div class=\"row\"><span>付款方式</span><span>'+PM_LABEL[o.payment_method]+(o.payment_method==='store_barcode' && o.store_brand && CVS_STORES[o.store_brand] ? '（'+CVS_STORES[o.store_brand]+'）' : '')+'</span></div>';
  if (o.payment_method === 'store_barcode') {
    html += '<div class=\"row\"><span>超商手續費</span><span>自付 $'+CVS_FEE+'（繳費時於超商另付）</span></div>';
  }

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
      html += '<div class="center"><div class="barcode-wrap"><img class="barcode" src="'+o.barcode_image+'" /><div class="barcode-watermark"></div></div></div>';
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
  box += '<input type="file" id="proof_file" accept="image/*" onclick="window.proofPickAt=Date.now()" onchange="window.proofPickAt=Date.now()" />';
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
    window.proofPickAt = Date.now();
    compressImage(file, 1280, 0.85).then(send).catch(()=>{ if (msgEl) msgEl.textContent = '圖片讀取失敗，請換一張再試'; });
  } else {
    send(null);
  }
}


// 壓縮圖片：縮到最長邊 1280px、轉成 JPEG，避免安卓大照片或格式標記異常造成上傳失敗
function compressImage(file, maxDim, quality){
  maxDim = maxDim || 1280; quality = quality || 0.85;
  function readRaw(){
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload = function(){ resolve(r.result); };
      r.onerror = function(){ reject(new Error('讀取圖片失敗')); };
      r.readAsDataURL(file);
    });
  }
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      try{
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, maxDim / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        var c = document.createElement('canvas'); c.width = cw; c.height = ch;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      }catch(e){ URL.revokeObjectURL(url); readRaw().then(resolve, reject); }
    };
    img.onerror = function(){ URL.revokeObjectURL(url); readRaw().then(resolve, reject); };
    img.src = url;
  });
}


async function selectMethod(method, store){
  try{
    const res = await fetch('/api/order/'+token+'/select-method', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({method, store})
    });
    const d = await res.json();
    if (!res.ok){ alert(d.error||'發生錯誤'); return; }
    storePickOpen = false;
    render(d);
  }catch(e){ alert('發生錯誤，請重新整理再試一次'); }
}

load();
</script>
${SITE_DISCLAIMER_HTML}
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
  .who-btn{display:flex;align-items:center;gap:8px;background:transparent;border:1px solid rgba(255,255,255,.35);border-radius:20px;padding:6px 12px;cursor:pointer;color:#fff;font:inherit;max-width:60vw;}
  .who-btn:hover{background:rgba(255,255,255,.1);border-color:#fff;}
  .who-btn #whoami{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
  .who-pts{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--accent-ink);background:var(--accent-soft);border-radius:12px;padding:2px 8px;white-space:nowrap;}
  .who-caret{font-size:11px;color:#B9BCCC;}
  .profile-panel{background:var(--bg);border-bottom:1px solid var(--line);padding:18px 18px 4px;}
  .profile-inner{max-width:640px;margin:0 auto;}
  .prof-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--line);font-size:14px;}
  .prof-row:last-of-type{border-bottom:none;}
  .prof-row span:first-child{color:var(--muted);white-space:nowrap;}
  .prof-row span:last-child{text-align:right;word-break:break-all;}

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

  .upd-card{border-color:var(--accent);background:linear-gradient(0deg,#fff,#fffaf0);}
  .upd-count{display:inline-block;min-width:20px;padding:1px 7px;margin-left:6px;border-radius:12px;background:var(--accent);color:#fff;font-size:12px;font-weight:700;text-align:center;vertical-align:middle;}
  .upd-count:empty{display:none;}
  .pts-balance{font-family:var(--mono);font-size:34px;font-weight:700;color:var(--accent-ink);line-height:1.1;}
  .pts-balance small{font-size:14px;font-weight:500;color:var(--muted);margin-left:4px;}
  .pts-rule{color:var(--muted);font-size:13px;margin-top:8px;line-height:1.6;}
  .pts-sub{font-size:14px;font-weight:700;margin:18px 0 6px;}
  .pts-fold{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;user-select:none;padding:10px 0;border-bottom:1px solid var(--line);}
  .pts-fold .cnt{font-weight:500;font-size:12.5px;color:var(--muted);margin-left:6px;}
  .pts-fold .arrow{color:var(--muted);font-size:12px;}
  .pts-pager{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:12px;font-size:13px;color:var(--muted);}
  .pts-pager .btn{margin-top:0;}
  .pts-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);}
  .pts-item:last-child{border-bottom:none;}
  .pts-item .nm{font-weight:600;} .pts-item .ds{font-size:12px;color:var(--muted);margin-top:2px;}
  .pts-item .cost{font-family:var(--mono);font-size:13px;color:var(--accent-ink);white-space:nowrap;}
  .pts-plus{color:var(--ok);font-weight:700;font-family:var(--mono);} .pts-minus{color:var(--danger);font-weight:700;font-family:var(--mono);}
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

  /* === 手機版：訂單表格改為卡片式 === */
  @media (max-width:600px){
    .profile-panel{padding:14px 10px 0;}
    main{padding:14px 10px 50px;}
    .card{padding:16px 14px;}
    .card::before{left:14px;}
    input,select{font-size:16px;}
    #ord_table{margin-top:14px;}
    #ord_table thead{display:none;}
    #ord_table, #ord_table tbody, #ord_table tr, #ord_table td{display:block;width:100%;}
    #ord_table tr{border:1px solid var(--line);border-radius:10px;padding:6px 12px;margin-bottom:12px;background:#fff;}
    #ord_table td{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px 12px;text-align:right;padding:8px 0;border-bottom:1px dashed var(--line);word-break:break-word;}
    #ord_table td:last-child{border-bottom:none;}
    #ord_table td::before{content:attr(data-label);flex:0 0 auto;font-size:12px;font-weight:600;color:var(--muted);text-align:left;}
    #ord_table td[colspan]{display:block;text-align:center;color:var(--muted);}
    #ord_table td[colspan]::before{content:none;}
    /* 保險：避免任何元素把頁面撐寬 */
    html,body{max-width:100%;overflow-x:hidden;}
    main,.card{max-width:100%;min-width:0;}
    input,select{min-width:0;max-width:100%;}
    input[type=month]{-webkit-appearance:none;appearance:none;display:block;height:44px;}
    #ord_table td > *{min-width:0;max-width:100%;}
    #ord_table code{word-break:break-all;}
  }
${SITE_DISCLAIMER_CSS}
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
    <div class="who"><button type="button" class="who-btn" id="whoBtn" onclick="toggleProfile()" aria-expanded="false"><span id="whoami"></span><span id="whoPts" class="who-pts hidden"></span><span class="who-caret" id="whoCaret">▾</span></button>
      <button class="btn secondary" onclick="doLogout()">登出</button></div>
  </header>

  <!-- === 點名字展開：個人資料 + 我的點數 === -->
  <div id="profilePanel" class="profile-panel hidden"><div class="profile-inner">
    <div class="card">
      <h2>個人資料</h2>
      <div class="prof-row"><span>姓名</span><span id="pf_name">-</span></div>
      <div class="prof-row"><span>帳號</span><span id="pf_account">-</span></div>
      <div class="prof-row"><span>手機</span><span id="pf_phone">-</span></div>
      <div class="prof-row"><span>電子信箱</span><span id="pf_email">-</span></div>
      <div class="prof-row"><span>加入時間</span><span id="pf_created">-</span></div>
      <button type="button" class="btn secondary" id="pfEditBtn" onclick="openProfileEdit()">修改手機 / 信箱</button>
      <div class="msg" style="color:var(--muted);margin-top:10px;">姓名、帳號如需修改，請洽店家。</div>

      <div id="pfEdit" class="hidden" style="margin-top:6px;">
        <label>手機</label>
        <input id="pf_phone_in" type="tel" inputmode="numeric" placeholder="09 開頭共 10 碼" autocomplete="off" />
        <label>電子信箱</label>
        <input id="pf_email_in" type="email" autocomplete="off" oninput="onPfEmailInput()" />
        <div id="pfCodeWrap" class="hidden">
          <label>信箱驗證碼（更改信箱需要驗證）</label>
          <div style="display:flex;gap:8px;">
            <input id="pf_code_in" inputmode="numeric" maxlength="6" placeholder="6 位數驗證碼" autocomplete="one-time-code" />
            <button type="button" class="btn secondary" id="pfSendBtn" style="white-space:nowrap;" onclick="sendProfileCode()">寄送驗證碼</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn" id="pfSaveBtn" onclick="saveProfile()">儲存</button>
          <button type="button" class="btn secondary" onclick="closeProfileEdit()">取消</button>
        </div>
      </div>
      <div id="pfMsg" class="msg"></div>
    </div>
    <!-- === 我的點數 === -->
    <div class="card" id="pointsCard">
      <h2>我的點數</h2>
      <div class="pts-balance"><span id="ptsBalance">0</span><small>點</small></div>
      <div class="pts-rule" id="ptsRule"></div>

      <div id="ptsShopWrap">
      <div class="pts-sub">點數商城</div>
      <div id="ptsShop"><div class="msg" style="color:var(--muted);">載入中…</div></div>
      <div id="ptsRedeemMsg" class="msg"></div>

      <div class="pts-sub pts-fold" onclick="togglePtsFold('Red')"><span>兌換紀錄<span class="cnt" id="ptsRedCnt"></span></span><span class="arrow" id="ptsRedArrow">▾ 展開</span></div>
      <div id="ptsRedBody" class="hidden">
        <table id="ptsRedTable">
          <thead><tr><th>時間</th><th>商品</th><th>點數</th><th>狀態</th></tr></thead>
          <tbody></tbody>
        </table>
        <div class="pts-pager" id="ptsRedPager"></div>
      </div>
      </div>

      <div class="pts-sub pts-fold" onclick="togglePtsFold('Led')"><span>點數明細<span class="cnt" id="ptsLedCnt"></span></span><span class="arrow" id="ptsLedArrow">▾ 展開</span></div>
      <div id="ptsLedBody" class="hidden">
        <table id="ptsLedgerTable">
          <thead><tr><th>時間</th><th>異動</th><th>說明</th></tr></thead>
          <tbody></tbody>
        </table>
        <div class="pts-pager" id="ptsLedPager"></div>
      </div>
    </div>
  </div></div>

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

    <!-- === 更新提醒（有訂單 / 兌換狀態變化才會出現）=== -->
    <div class="card upd-card hidden" id="updatesCard">
      <h2>最新更新<span class="upd-count" id="updCount"></span></h2>
      <div id="updList"></div>
      <button type="button" class="btn secondary" onclick="dismissUpdates()">知道了</button>
    </div>

    <!-- === 查價專區（可收合） === -->
    <div class="card">
      <div class="quote-toggle" id="quoteToggle" onclick="toggleQuotePanel()">
        <h2>💰 前往查價</h2>
        <span class="arrow">▼</span>
      </div>
      <div class="quote-panel hidden" id="quotePanel">
        <label>儲值平台</label>
        <select id="quote_platform">
          <option value="">請選擇儲值平台</option>
          <option value="tiktok">TikTok</option>
          <option value="kuaishou">快手</option>
          <option value="xiaohongshu">小紅書</option>
          <option value="douyin">陸抖</option>
        </select>
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
      <label>儲值平台</label>
      <select id="new_platform" onchange="updatePasswordRequirement()">
        <option value="">請選擇儲值平台</option>
        <option value="tiktok">TikTok</option>
        <option value="kuaishou">快手</option>
        <option value="xiaohongshu">小紅書</option>
        <option value="douyin">陸抖</option>
      </select>
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
      <label>帳號/ID</label>
      <input id="new_platform_account" placeholder="請輸入要儲值平台的帳號/ID" autocomplete="off" />
      <label id="new_platform_password_label">密碼</label>
      <input id="new_platform_password" type="password" placeholder="請輸入該帳號的密碼" autocomplete="new-password" oninput="updatePasswordRequirement()" />
      <label>優惠碼（選填）</label>
      <div style="display:flex;gap:8px;">
        <input id="mo_coupon" placeholder="輸入優惠碼" style="text-transform:uppercase;" oninput="document.getElementById('mo_coupon_msg').textContent='';" />
        <button type="button" class="btn secondary" style="white-space:nowrap;" onclick="previewCoupon('mo')">套用</button>
      </div>
      <div id="mo_coupon_msg" class="msg"></div>
      <div id="usePointsWrap" class="hidden">
        <label id="usePointsLabel">使用點數折抵（選填）</label>
        <div style="display:flex;gap:8px;">
          <input id="use_points" type="number" min="0" step="1" placeholder="0" oninput="updatePointsHint()" onfocus="updatePointsHint()" />
          <button type="button" class="btn secondary" style="white-space:nowrap;" onclick="useMaxPoints()">最多可用</button>
        </div>
        <div id="usePointsMsg" class="msg" style="color:var(--muted);"></div>
      </div>
      <label id="notifyWrap" style="display:flex;align-items:flex-start;gap:8px;font-size:14px;cursor:pointer;margin-top:14px;">
        <input type="checkbox" id="new_notify_email" style="width:auto;margin:3px 0 0;" onchange="onNotifyToggle()" />
        <span>訂單完成時寄信通知我<br/><span id="notifyEmailHint" style="color:var(--muted);font-size:12.5px;"></span></span>
      </label>
      <div id="notifyAddrWrap" class="hidden">
        <label>通知信箱（可改成其他信箱，僅用於這筆訂單）</label>
        <input id="new_notify_addr" type="email" autocomplete="off" placeholder="例如：name@gmail.com" />
      </div>
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
        <thead><tr><th>訂單編號</th><th>建立時間</th><th>儲值平台</th><th>金額</th><th>預計幣數</th><th>優惠</th><th>付款方式</th><th>狀態</th><th>操作</th></tr></thead>
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
const PM_LABEL = {transfer:'轉帳', store_barcode:'超商條碼', taiwan_pay:'TWQR'};
const CVS_LABEL = {seven:'7-11', family:'全家', hilife:'萊爾富'};
const PLATFORM_LABEL = {tiktok:'TikTok', kuaishou:'快手', xiaohongshu:'小紅書', douyin:'陸抖'};
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

// === 匯率規則（從 API 讀取，分兩組：tiktok 專用 / 快手小紅書陸抖共用） ===
let rateRulesByGroup = { tiktok: [], other: [] };

async function loadRates() {
  try {
    const data = await api('/api/rates');
    rateRulesByGroup = data.groups || { tiktok: [], other: [] };
  } catch (e) {
    console.warn('讀取費率失敗', e);
    rateRulesByGroup = { tiktok: [], other: [] };
  }
}

// 依平台代碼取得對應的費率群組（tiktok 自己一組，其餘平台共用 other 這組）
function getRateGroupForPlatform(platform) {
  return platform === 'tiktok' ? 'tiktok' : 'other';
}

// 需要強制填寫密碼的平台：快手／小紅書／陸抖不強制要密碼，僅 TikTok 需要
const PLATFORMS_REQUIRE_PASSWORD = new Set(['tiktok']);

// 取得對應匯率
function getRate(amount, platform) {
  const rules = rateRulesByGroup[getRateGroupForPlatform(platform)] || [];
  for (const rule of rules) {
    if (amount >= rule.min) return rule.rate;
  }
  return null;
}

// 計算抖幣
function calcCoins(amount, platform) {
  if (isNaN(amount) || amount < MIN_QUOTE_AMOUNT || amount > 50000) return null;
  const rate = getRate(amount, platform);
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
  const platform = document.getElementById('quote_platform').value;
  if (!platform) {
    showPopup('請先選擇儲值平台', '不同平台費率不同，請先選擇要儲值的平台再計算');
    return;
  }
  const inputs = document.querySelectorAll('.quote-amount');
  const results = [];
  let hasInvalid = false;

  inputs.forEach(input => {
    const raw = input.value.trim();
    if (!raw) return;
    const amount = parseFloat(raw);
    const res = calcCoins(amount, platform);
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
      <button class="select-btn" onclick="selectQuote(\${r.amount}, '\${r.coins}', '\${platform}')">選擇此金額</button>
    </div>
  \`).join('');

  if (hasInvalid) {
    showPopup('部分金額超出範圍', '超出 '+MIN_QUOTE_AMOUNT+'~50000 的金額請私信');
  }
}

// === 更新「預估可獲得」徽章：必須同時選了儲值平台 + 有效金額才顯示 ===
function updateEstimateBadge() {
  if (typeof updatePointsHint === 'function') updatePointsHint();
  const badge = document.getElementById('estimateBadge');
  const platform = document.getElementById('new_platform').value;
  const input = document.getElementById('new_amount');
  const val = parseFloat(input.value);

  if (!platform) {
    badge.classList.add('hidden');
    return;
  }
  const res = calcCoins(val, platform);
  if (res) {
    badge.textContent = \`預估可獲得 🪙 \${Number(res.coins).toLocaleString()} 抖幣\`;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// === 選擇查價結果 → 帶入自助下單金額與平台 ===
function selectQuote(amount, coins, platform) {
  const input = document.getElementById('new_amount');
  input.value = amount;
  document.querySelectorAll('#amountChips .chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('#amountChips .chip').forEach(chip => {
    if (chip.dataset.amount && Number(chip.dataset.amount) === amount) {
      chip.classList.add('active');
    }
  });
  if (platform) {
    document.getElementById('new_platform').value = platform;
    updatePasswordRequirement();
  }
  updateEstimateBadge();
  document.getElementById('new_amount').scrollIntoView({behavior:'smooth', block:'center'});
}

// === 金額 chip 點擊 ===
function initAmountChips() {
  const wrap = document.getElementById('amountChips');
  const input = document.getElementById('new_amount');
  const platformSelect = document.getElementById('new_platform');
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
        updateEstimateBadge();
      }
    });
  });

  input.addEventListener('input', updateEstimateBadge);
  if (platformSelect) platformSelect.addEventListener('change', updateEstimateBadge);
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
    renderProfile(me);
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');
    await loadRates();
    loadOrders();
    loadPoints();
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

// 試算優惠碼折抵金額（會員自助下單用）
async function previewCoupon(prefix){
  const amount = parseFloat(document.getElementById('new_amount').value);
  const code = document.getElementById(prefix+'_coupon').value.trim();
  const msg = document.getElementById(prefix+'_coupon_msg');
  msg.textContent=''; msg.className='msg';
  if (!amount || amount<=0){ msg.textContent='請先輸入金額'; msg.className='msg err'; return; }
  if (!code){ msg.textContent='請輸入優惠碼'; msg.className='msg err'; return; }
  try{
    const r = await api('/api/coupons/preview', {method:'POST', body: JSON.stringify({code, amount})});
    msg.textContent = \`優惠碼 \${r.code} 可折抵 $\${r.discount}，實付 $\${r.final_amount}\`;
    msg.className = 'msg ok';
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
}

// 依所選平台更新密碼欄位是否為必填（快手／小紅書／陸抖不強制要密碼）
function updatePasswordRequirement(){
  const platform = document.getElementById('new_platform').value;
  const label = document.getElementById('new_platform_password_label');
  const input = document.getElementById('new_platform_password');
  const required = PLATFORMS_REQUIRE_PASSWORD.has(platform);
  label.textContent = required ? '密碼' : '密碼（選填）';
  input.placeholder = required ? '請輸入該帳號的密碼' : '此平台可不填密碼';
}

async function createOrder(){
  const btn = document.getElementById('newOrderBtn');
  const msg = document.getElementById('newOrderMsg');
  const amount = document.getElementById('new_amount').value;
  const platform = document.getElementById('new_platform').value;
  const platform_account = document.getElementById('new_platform_account').value.trim();
  const platform_password = document.getElementById('new_platform_password').value;
  const coupon_code = document.getElementById('mo_coupon').value.trim() || null;
  const use_points = Math.floor(Number(document.getElementById('use_points').value) || 0);
  const notify_email = !!document.getElementById('new_notify_email').checked;
  const notify_email_addr = notify_email ? document.getElementById('new_notify_addr').value.trim() : '';
  if (notify_email && !notify_email_addr){ msg.textContent='請填寫要接收通知的電子信箱'; msg.className='msg err'; return; }
  msg.textContent=''; msg.className='msg';
  document.getElementById('newOrderResult').classList.add('hidden');
  if (!amount || Number(amount) <= 0){ msg.textContent='請輸入正確的金額'; msg.className='msg err'; return; }
  if (Number(amount) < MIN_QUOTE_AMOUNT){ msg.textContent='訂單金額不可低於 '+MIN_QUOTE_AMOUNT+' 元'; msg.className='msg err'; return; }
  if (!platform){ msg.textContent='請選擇儲值平台'; msg.className='msg err'; return; }
  if (!platform_account){ msg.textContent='請輸入帳號/ID'; msg.className='msg err'; return; }
  if (!platform_password && PLATFORMS_REQUIRE_PASSWORD.has(platform)){ msg.textContent='請輸入密碼'; msg.className='msg err'; return; }
  btn.disabled = true;
  try{
    const res = await api('/api/member/orders', {method:'POST', body: JSON.stringify({amount, platform, platform_account, platform_password, coupon_code, use_points, notify_email, notify_email_addr})});
    document.getElementById('use_points').value = '';
    document.getElementById('new_notify_email').checked = false;
    onNotifyToggle();
    document.getElementById('usePointsMsg').textContent = '';
    document.getElementById('new_amount').value = '';
    document.getElementById('new_amount').classList.add('hidden');
    document.getElementById('estimateBadge').classList.add('hidden');
    document.getElementById('new_platform').value = '';
    document.getElementById('new_platform_account').value = '';
    document.getElementById('new_platform_password').value = '';
    updatePasswordRequirement();
    document.getElementById('mo_coupon').value = '';
    document.getElementById('mo_coupon_msg').textContent = '';
    document.querySelectorAll('#amountChips .chip').forEach(c=>c.classList.remove('active'));
    const linkEl = document.getElementById('newOrderLink');
    linkEl.href = res.link;
    document.getElementById('newOrderResult').classList.remove('hidden');
    const totalOff = (res.discount || 0) + (res.points_discount || 0);
    const discountNote = totalOff ? \`，已折抵 $\${totalOff}\${res.points_used ? '（含點數 '+res.points_used+' 點）' : ''}，實付 $\${res.amount}\` : '';
    const coinsNote = res.coins != null ? \`，預計獲得 🪙 \${Number(res.coins).toLocaleString()} 抖幣\` : '';
    document.getElementById('newOrderMsg').textContent = \`訂單編號 \${res.order_no}\${discountNote}\${coinsNote}\`;
    document.getElementById('newOrderMsg').className = 'msg ok';
    loadOrders();
    loadPoints();
  }catch(e){ msg.textContent = e.message; msg.className='msg err'; }
  finally{ btn.disabled = false; }
}

// ---- 更新提醒（訂單狀態變化、兌換單被處理）----
// 這裡只記錄「上次看過的狀態」在這支手機 / 瀏覽器上；有新的變化才會在最上方出現提醒卡，按「知道了」後消失。
let updOrders = null;
let updRed = null;
const UPD_STATE = {
  ready_to_pay: '條碼已準備好，請前往付款',
  paid: '已完成付款',
  cancelled: '訂單已取消',
  expired: '付款時效已過，訂單已過期',
};

function updSeenKey(){ return 'mc_seen_' + (meState && meState.id ? meState.id : ''); }
function updReadSeen(){ try{ const r = localStorage.getItem(updSeenKey()); return r ? JSON.parse(r) : null; }catch(e){ return null; } }
function updWriteSeen(m){ try{ localStorage.setItem(updSeenKey(), JSON.stringify(m)); }catch(e){} }
function updOrderSig(o){ return o.status + (o.is_completed ? '+c' : ''); }

function updCurrentSigs(){
  const m = {};
  (updOrders || []).forEach(function(o){ m['o' + o.id] = updOrderSig(o); });
  (updRed || []).forEach(function(r){ m['r' + r.id] = r.status; });
  return m;
}

function refreshUpdates(){
  if (updOrders === null || updRed === null || !meState) return;
  let seen = updReadSeen();
  if (!seen){ seen = updCurrentSigs(); updWriteSeen(seen); } // 這支裝置第一次使用：現有的都當作已看過，避免一次跳出一堆舊訂單
  const items = [];
  updOrders.forEach(function(o){
    if (seen['o' + o.id] === updOrderSig(o)) return;
    const text = o.is_completed ? '訂單已結案' : UPD_STATE[o.status];
    if (!text) return;
    items.push({title: '訂單 ' + o.order_no, desc: text + '（$' + o.amount + '）', href: '/pay/' + o.token});
  });
  updRed.forEach(function(r){
    if (r.status === 'pending' || seen['r' + r.id] === r.status) return;
    const text = r.status === 'fulfilled'
      ? '兌換「' + r.item_name + '」已完成'
      : '兌換「' + r.item_name + '」未成立，已退回 ' + r.cost + ' 點';
    items.push({title: '點數兌換', desc: text + (r.admin_note ? '（' + r.admin_note + '）' : ''), href: ''});
  });
  const card = document.getElementById('updatesCard');
  card.classList.toggle('hidden', items.length === 0);
  document.getElementById('updCount').textContent = items.length ? String(items.length) : '';
  document.getElementById('updList').innerHTML = items.map(function(it){
    return '<div class="pts-item"><div><div class="nm">' + ptsEsc(it.title) + '</div><div class="ds">' + ptsEsc(it.desc) + '</div></div>' +
      (it.href ? '<a href="' + it.href + '" target="_blank">查看</a>' : '') + '</div>';
  }).join('');
}

function dismissUpdates(){
  updWriteSeen(Object.assign({}, updReadSeen() || {}, updCurrentSigs()));
  document.getElementById('updatesCard').classList.add('hidden');
}

// ---- 個人資料：修改手機 / 信箱（信箱要驗證）----
let meState = null;
let pfCooldownTimer = null;

function renderProfile(me){
  meState = me;
  document.getElementById('pf_name').textContent = me.name || '-';
  document.getElementById('pf_account').textContent = me.account || '-';
  document.getElementById('pf_phone').textContent = me.phone || '-';
  const verified = me.email && me.email_verified_at ? ' <span style="color:var(--ok);font-size:12px;">✓ 已驗證</span>' : '';
  document.getElementById('pf_email').innerHTML = (me.email ? ptsEsc(me.email) : '-') + verified;
  document.getElementById('pf_created').textContent = me.created_at ? toTaipeiTime(me.created_at) : '-';
  syncNotifyEmailBox(me);
}

function syncNotifyEmailBox(me){
  const hint = document.getElementById('notifyEmailHint');
  if (!hint) return;
  const has = !!(me && me.email && String(me.email).trim());
  hint.textContent = has ? '預設寄到會員信箱，也可以改填其他信箱' : '你的會員資料沒有信箱，請在勾選後填寫要接收通知的信箱';
  // 輸入框還沒被客人動過（空白，或還是舊的會員信箱）時，才幫他更新預設值
  const inp = document.getElementById('new_notify_addr');
  if (inp && (!inp.value || inp.dataset.auto === '1')) { inp.value = has ? me.email : ''; inp.dataset.auto = '1'; }
}

function onNotifyToggle(){
  const on = document.getElementById('new_notify_email').checked;
  document.getElementById('notifyAddrWrap').classList.toggle('hidden', !on);
  if (on) {
    const inp = document.getElementById('new_notify_addr');
    if (!inp.value && meState && meState.email) { inp.value = meState.email; inp.dataset.auto = '1'; }
    inp.oninput = function(){ inp.dataset.auto = '0'; };
  }
}

function openProfileEdit(){
  document.getElementById('pf_phone_in').value = (meState && meState.phone) || '';
  document.getElementById('pf_email_in').value = (meState && meState.email) || '';
  document.getElementById('pf_code_in').value = '';
  document.getElementById('pfMsg').textContent = '';
  document.getElementById('pfEdit').classList.remove('hidden');
  document.getElementById('pfEditBtn').classList.add('hidden');
  onPfEmailInput();
}

function closeProfileEdit(){
  document.getElementById('pfEdit').classList.add('hidden');
  document.getElementById('pfEditBtn').classList.remove('hidden');
  document.getElementById('pfMsg').textContent = '';
}

function pfEmailChanged(){
  const v = document.getElementById('pf_email_in').value.trim().toLowerCase();
  return !!meState && v !== String(meState.email || '').toLowerCase();
}

function onPfEmailInput(){
  const need = pfEmailChanged() && meState && meState.email_verify;
  document.getElementById('pfCodeWrap').classList.toggle('hidden', !need);
}

function startPfCooldown(sec){
  const btn = document.getElementById('pfSendBtn');
  clearInterval(pfCooldownTimer);
  let left = sec;
  btn.disabled = true; btn.textContent = '重新寄送（' + left + '）';
  pfCooldownTimer = setInterval(function(){
    left--;
    if (left <= 0){ clearInterval(pfCooldownTimer); btn.disabled = false; btn.textContent = '重新寄送驗證碼'; }
    else btn.textContent = '重新寄送（' + left + '）';
  }, 1000);
}

async function sendProfileCode(){
  const msg = document.getElementById('pfMsg');
  const email = document.getElementById('pf_email_in').value.trim();
  msg.className = 'msg'; msg.textContent = '';
  if (!email){ msg.textContent = '請先輸入新的電子信箱'; msg.className = 'msg err'; return; }
  const btn = document.getElementById('pfSendBtn');
  btn.disabled = true;
  try{
    const r = await api('/api/member/profile/send-email-code', {method:'POST', body: JSON.stringify({email})});
    msg.textContent = '驗證碼已寄到 ' + email + '，請到信箱查看（若沒收到，也請看垃圾郵件）'; msg.className = 'msg ok';
    startPfCooldown(r.cooldown || 60);
  }catch(e){ msg.textContent = e.message; msg.className = 'msg err'; btn.disabled = false; }
}

async function saveProfile(){
  const msg = document.getElementById('pfMsg');
  const btn = document.getElementById('pfSaveBtn');
  msg.className = 'msg'; msg.textContent = '';
  const body = {phone: document.getElementById('pf_phone_in').value.trim(), email: document.getElementById('pf_email_in').value.trim()};
  if (pfEmailChanged() && meState.email_verify) body.email_code = document.getElementById('pf_code_in').value.trim();
  btn.disabled = true;
  try{
    const r = await api('/api/member/profile', {method:'POST', body: JSON.stringify(body)});
    meState.phone = r.phone; meState.email = r.email; meState.email_verified_at = r.email_verified_at;
    renderProfile(meState);
    closeProfileEdit();
    msg.textContent = '已更新'; msg.className = 'msg ok';
  }catch(e){ msg.textContent = e.message; msg.className = 'msg err'; }
  finally{ btn.disabled = false; }
}

// ---- 點名字展開 / 收合個人資料與點數 ----
function toggleProfile(){
  const panel = document.getElementById('profilePanel');
  const nowHidden = panel.classList.toggle('hidden');
  document.getElementById('whoCaret').textContent = nowHidden ? '▾' : '▴';
  document.getElementById('whoBtn').setAttribute('aria-expanded', nowHidden ? 'false' : 'true');
}

// ---- 點數 ----
let pointsState = null;
const PTS_TYPE_LABEL = {earn:'完成回饋', spend:'訂單折抵', redeem:'商城兌換', refund:'退回', admin:'店家調整'};
const RED_STATUS = {pending:['處理中','b-await'], fulfilled:['已完成','b-paid'], rejected:['已退回點數','b-cancel']};

function ptsEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ---- 兌換紀錄（5 筆 1 頁）/ 點數明細（10 筆 1 頁）：可收合、上一頁 / 下一頁 ----
const PTS_PAGE_SIZE = {Red: 5, Led: 10};
const ptsPage = {Red: 1, Led: 1};

function togglePtsFold(k){
  const body = document.getElementById('pts'+k+'Body');
  const nowHidden = body.classList.toggle('hidden');
  document.getElementById('pts'+k+'Arrow').textContent = nowHidden ? '▾ 展開' : '▴ 收合';
}

function ptsGo(k, delta){
  ptsPage[k] += delta;
  if (k === 'Red') renderPtsRed(); else renderPtsLed();
}

function renderPtsPager(k, total){
  const size = PTS_PAGE_SIZE[k];
  const pages = Math.max(1, Math.ceil(total / size));
  if (ptsPage[k] > pages) ptsPage[k] = pages;
  if (ptsPage[k] < 1) ptsPage[k] = 1;
  const p = ptsPage[k];
  document.getElementById('pts'+k+'Pager').innerHTML = total > size
    ? '<button type="button" class="btn secondary small" ' + (p <= 1 ? 'disabled' : '') + ' onclick="ptsGo(\\'' + k + '\\',-1)">‹ 上一頁</button>' +
      '<span>第 ' + p + ' / ' + pages + ' 頁</span>' +
      '<button type="button" class="btn secondary small" ' + (p >= pages ? 'disabled' : '') + ' onclick="ptsGo(\\'' + k + '\\',1)">下一頁 ›</button>'
    : '';
  return (p - 1) * size;
}

function renderPtsRed(){
  const list = (pointsState && pointsState.redemptions) || [];
  const start = renderPtsPager('Red', list.length);
  document.getElementById('ptsRedCnt').textContent = list.length ? '（共 ' + list.length + ' 筆）' : '';
  document.querySelector('#ptsRedTable tbody').innerHTML = list.slice(start, start + PTS_PAGE_SIZE.Red).map(function(r){
    const st = RED_STATUS[r.status] || [r.status,'b-pending'];
    return '<tr><td data-label="時間">' + toTaipeiTime(r.created_at) + '</td><td data-label="商品">' + ptsEsc(r.item_name) +
      (r.admin_note ? '<br/><span class="msg" style="margin:0;color:var(--muted);">' + ptsEsc(r.admin_note) + '</span>' : '') +
      '</td><td data-label="點數">' + Number(r.cost).toLocaleString() + '</td><td data-label="狀態"><span class="badge ' + st[1] + '">' + st[0] + '</span></td></tr>';
  }).join('') || '<tr><td colspan="4">尚無兌換紀錄</td></tr>';
}

function renderPtsLed(){
  const list = (pointsState && pointsState.ledger) || [];
  const start = renderPtsPager('Led', list.length);
  document.getElementById('ptsLedCnt').textContent = list.length ? (list.length >= 100 ? '（最近 100 筆）' : '（共 ' + list.length + ' 筆）') : '';
  document.querySelector('#ptsLedgerTable tbody').innerHTML = list.slice(start, start + PTS_PAGE_SIZE.Led).map(function(l){
    const plus = l.delta > 0;
    return '<tr><td data-label="時間">' + toTaipeiTime(l.created_at) + '</td><td data-label="異動"><span class="' + (plus ? 'pts-plus' : 'pts-minus') + '">' +
      (plus ? '+' : '') + l.delta + '</span> <span class="msg" style="margin:0;color:var(--muted);">' + (PTS_TYPE_LABEL[l.type] || l.type) + '</span></td><td data-label="說明">' + ptsEsc(l.note || '') + '</td></tr>';
  }).join('') || '<tr><td colspan="3">尚無點數紀錄</td></tr>';
}

async function loadPoints(){
  try{
    const d = await api('/api/member/points');
    pointsState = d;
    updRed = d.redemptions || [];
    refreshUpdates();
    const anyOn = d.earn_enabled || d.discount_enabled || d.shop_enabled;
    document.getElementById('pointsCard').classList.toggle('hidden', !anyOn && d.balance === 0 && !d.ledger.length);
    document.getElementById('ptsBalance').textContent = Number(d.balance).toLocaleString();
    const whoPts = document.getElementById('whoPts');
    whoPts.textContent = Number(d.balance).toLocaleString() + ' 點';
    whoPts.classList.toggle('hidden', !anyOn && d.balance === 0 && !d.ledger.length);
    const c = d.config;
    const rules = [];
    if (d.earn_enabled) rules.push('訂單完成後，每實付 <b>$' + c.earn_per + '</b> 得 1 點。');
    if (d.discount_enabled) rules.push('下單時 1 點可折抵 <b>$' + c.redeem_value + '</b>，單筆訂單最多折抵 <b>' + c.max_percent + '%</b>。');
    if (d.shop_enabled) rules.push('也可以到下方點數商城兌換商品。');
    document.getElementById('ptsRule').innerHTML = rules.length ? rules.join('') : '點數功能目前暫停，已累積的點數會保留。';
    document.getElementById('ptsShopWrap').classList.toggle('hidden', !d.shop_enabled && !d.redemptions.length);

    const shop = document.getElementById('ptsShop');
    shop.innerHTML = d.items.map(function(it){
      const can = d.shop_enabled && d.balance >= it.cost;
      return '<div class="pts-item"><div><div class="nm">' + ptsEsc(it.name) + '</div>' +
        (it.description ? '<div class="ds">' + ptsEsc(it.description) + '</div>' : '') +
        (it.stock != null ? '<div class="ds">剩餘 ' + it.stock + ' 份</div>' : '') +
        '</div><div style="text-align:right;"><div class="cost">' + Number(it.cost).toLocaleString() + ' 點</div>' +
        '<button class="btn small ' + (can ? '' : 'secondary') + '" ' + (can ? '' : 'disabled') + ' onclick="redeemItem(' + it.id + ')">' + (can ? '兌換' : '點數不足') + '</button></div></div>';
    }).join('') || '<div class="msg" style="color:var(--muted);">目前沒有可兌換的商品</div>';

    renderPtsRed();
    renderPtsLed();

    document.getElementById('usePointsWrap').classList.toggle('hidden', !(d.discount_enabled && d.balance > 0));
    updatePointsHint();
  }catch(e){ /* 點數載入失敗不影響其他功能 */ if (updRed === null) { updRed = []; refreshUpdates(); } }
}

function maxUsablePoints(){
  if (!pointsState || !pointsState.discount_enabled) return 0;
  const amt = Number(document.getElementById('new_amount').value) || 0;
  const c = pointsState.config;
  const byAmount = Math.floor(amt * c.max_percent / 100 / c.redeem_value);
  return Math.max(0, Math.min(pointsState.balance, byAmount));
}

function updatePointsHint(){
  if (!pointsState) return;
  const input = document.getElementById('use_points');
  const hint = document.getElementById('usePointsMsg');
  const amt = Number(document.getElementById('new_amount').value) || 0;
  const max = maxUsablePoints();
  const v = Math.floor(Number(input.value) || 0);
  document.getElementById('usePointsLabel').textContent = '使用點數折抵（選填，目前餘額 ' + pointsState.balance + ' 點）';
  if (!amt) { hint.textContent = '請先選擇金額，再決定要使用多少點數'; hint.className = 'msg'; hint.style.color = 'var(--muted)'; return; }
  if (v > pointsState.balance) { hint.textContent = '點數不足，目前餘額 ' + pointsState.balance + ' 點'; hint.className = 'msg err'; return; }
  if (v > max) { hint.textContent = '此金額最多可使用 ' + max + ' 點'; hint.className = 'msg err'; return; }
  hint.className = 'msg'; hint.style.color = 'var(--muted)';
  hint.textContent = v > 0
    ? '將折抵 $' + (v * pointsState.config.redeem_value) + '（優惠碼折抵後，實際可用上限以送出時為準）'
    : '此金額最多可使用 ' + max + ' 點';
}

function useMaxPoints(){
  document.getElementById('use_points').value = maxUsablePoints() || '';
  updatePointsHint();
}

async function redeemItem(id){
  const msg = document.getElementById('ptsRedeemMsg');
  const it = pointsState && pointsState.items.find(function(x){ return x.id === id; });
  if (!it) return;
  if (!confirm('確定用 ' + it.cost + ' 點兌換「' + it.name + '」嗎？')) return;
  msg.textContent = ''; msg.className = 'msg';
  try{
    await api('/api/member/points/redeem', {method:'POST', body: JSON.stringify({item_id: id})});
    msg.textContent = '兌換成功，店家會盡快為你處理。'; msg.className = 'msg ok';
    loadPoints();
  }catch(e){ msg.textContent = e.message; msg.className = 'msg err'; loadPoints(); }
}

// ---- 訂單自動更新（輪詢）----
let ordersPollTimer = null;

let pointsPollTimer = null;

function startOrdersPolling(){
  stopOrdersPolling();
  ordersPollTimer = setInterval(()=> {
    const appView = document.getElementById('appView');
    if (appView && !appView.classList.contains('hidden') && !document.hidden) {
      loadOrders();
    }
  }, 5000);
  // 兌換單被處理的提醒：30 秒檢查一次就夠
  pointsPollTimer = setInterval(()=> {
    const appView = document.getElementById('appView');
    if (appView && !appView.classList.contains('hidden') && !document.hidden) {
      loadPoints();
    }
  }, 30000);
}

function stopOrdersPolling(){
  if (ordersPollTimer) { clearInterval(ordersPollTimer); ordersPollTimer = null; }
  if (pointsPollTimer) { clearInterval(pointsPollTimer); pointsPollTimer = null; }
}

async function loadOrders(){
  const month = document.getElementById('ord_month').value;
  const qs = month ? ('?month='+encodeURIComponent(month)) : '';
  const list = await api('/api/member/orders'+qs);
  if (!month) { updOrders = list; refreshUpdates(); }
  const tbody = document.querySelector('#ord_table tbody');
  const ACTIVE = new Set(['pending_method','awaiting_payment','awaiting_barcode','ready_to_pay']);
  tbody.innerHTML = list.map(o=>{
    const st = STATUS_LABEL[o.status] || [o.status,'b-pending'];
    const completedTag = o.is_completed ? ' <span class="badge b-completed">已結案</span>' : '';
    const action = ACTIVE.has(o.status)
      ? \`<a href="/pay/\${o.token}" target="_blank">前往付款</a>\`
      : \`<a href="/pay/\${o.token}" target="_blank">查看</a>\`;
    let couponInfo = o.coupon_code
      ? \`<code>\${o.coupon_code}</code><br/><span class="msg" style="margin:0;color:var(--muted);">-$\${o.coupon_discount}</span>\`
      : '';
    if (o.points_used > 0) couponInfo += (couponInfo ? '<br/>' : '') + \`<span class="msg" style="margin:0;color:var(--muted);">點數 \${o.points_used} 點 -$\${o.points_discount}</span>\`;
    if (!couponInfo) couponInfo = '-';
    return \`<tr>
      <td data-label="訂單編號"><code>\${o.order_no}</code></td>
      <td data-label="建立時間">\${toTaipeiTime(o.created_at)}</td>
      <td data-label="儲值平台">\${PLATFORM_LABEL[o.platform]||'-'}</td>
      <td data-label="金額">$\${o.amount}</td>
      <td data-label="預計幣數">\${o.coins != null ? ('🪙 '+Number(o.coins).toLocaleString()) : '-'}</td>
      <td data-label="優惠">\${couponInfo}</td>
      <td data-label="付款方式">\${PM_LABEL[o.payment_method]||'尚未選擇'}\${(o.payment_method==='store_barcode' && o.store_brand && CVS_LABEL[o.store_brand]) ? '<br/><span style="color:var(--muted);font-size:12px;">'+CVS_LABEL[o.store_brand]+'</span>' : ''}</td>
      <td data-label="狀態"><span class="badge \${st[1]}">\${st[0]}</span>\${completedTag}</td>
      <td data-label="操作">\${action}</td>
    </tr>\`;
  }).join('') || '<tr><td colspan="9">尚無訂單記錄</td></tr>';
}

// 頁面載入時就先抓費率（不管有沒有登入）
loadRates().then(() => {
  checkSession();
});
</script>
${SITE_DISCLAIMER_HTML}
</body>
</html>`;
}

// 隱藏的自助註冊頁：不會出現在任何選單或導覽列，只能透過會員分享的推薦連結（帶 ?code=）進入。
// 一定要填對某位既有會員的推薦碼才能建立帳號。
export function memberRegisterHtml({ emailVerify = true } = {}) {
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
  .row{display:flex;gap:8px;}
  button.btn2{white-space:nowrap;padding:0 12px;border:1px solid var(--line);background:#fff;color:var(--accent-ink);border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;}
  button.btn2:disabled{opacity:.55;cursor:default;}
${SITE_DISCLAIMER_CSS}
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
  <label>手機（必填，台灣手機 09 開頭）</label>
  <input id="reg_phone" type="tel" inputmode="numeric" maxlength="16" autocomplete="tel" placeholder="例如：0912345678" />
  <label>電子信箱（必填）</label>
  <input id="reg_email" type="email" autocomplete="email" placeholder="例如：name@example.com" />
  <div style="font-size:12px;color:#888;margin-top:4px;">僅接受常見信箱：Gmail、Outlook、Hotmail、Yahoo、iCloud 等</div>
  <div id="code_wrap" style="display:none;">
    <label>信箱驗證碼（6 碼）</label>
    <div class="row">
      <input id="reg_email_code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6 位數驗證碼" />
      <button type="button" class="btn2" id="send_code_btn" onclick="sendCode()">寄送驗證碼</button>
    </div>
    <div style="font-size:12px;color:#888;margin-top:4px;">驗證碼 10 分鐘內有效；沒收到請檢查垃圾郵件匣。</div>
  </div>
  <button class="btn" id="reg_btn" onclick="doRegister()">建立帳號</button>
  <div id="reg_msg" class="msg"></div>
  <div class="foot">已經有帳號了？<a href="/member">前往登入</a></div>
</div>
<script>
  const params = new URLSearchParams(location.search);
  const prefillCode = params.get('code');
  if (prefillCode) document.getElementById('reg_code').value = prefillCode.toUpperCase();

  const EMAIL_VERIFY = ${emailVerify ? 'true' : 'false'};
  const allowedDomains = ${JSON.stringify(ALLOWED_EMAIL_DOMAINS)};
  if (EMAIL_VERIFY) document.getElementById('code_wrap').style.display = 'block';

  function emailError(email){
    if (!/^[^ @]+@[^ @]+[.][^ @]+$/.test(email)) return '請輸入正確的電子信箱格式';
    if (!allowedDomains.includes(email.toLowerCase().split('@').pop())) return '目前僅接受常見信箱（Gmail、Outlook、Hotmail、Yahoo、iCloud 等）';
    return '';
  }

  let cooldownTimer = null;
  function startCooldown(sec){
    const b = document.getElementById('send_code_btn');
    let left = sec;
    b.disabled = true; b.textContent = left + ' 秒後可重寄';
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(()=>{
      left--;
      if (left <= 0){ clearInterval(cooldownTimer); b.disabled = false; b.textContent = '重新寄送'; }
      else b.textContent = left + ' 秒後可重寄';
    }, 1000);
  }

  async function sendCode(){
    const msg = document.getElementById('reg_msg');
    msg.textContent=''; msg.className='msg';
    const email = document.getElementById('reg_email').value.trim();
    const referral_code = document.getElementById('reg_code').value.trim();
    if (!referral_code){ msg.textContent = '請先填寫推薦碼'; msg.className = 'msg err'; return; }
    const err = emailError(email);
    if (err){ msg.textContent = err; msg.className = 'msg err'; return; }
    const b = document.getElementById('send_code_btn');
    b.disabled = true;
    try{
      const res = await fetch('/api/member/send-email-code', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, referral_code })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || '寄送失敗');
      msg.textContent = '驗證碼已寄到 ' + email + '，請到信箱查收'; msg.className = 'msg ok';
      startCooldown(data.cooldown || 60);
    }catch(e){
      msg.textContent = e.message; msg.className = 'msg err';
      b.disabled = false;
    }
  }

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
      email: document.getElementById('reg_email').value.trim(),
      email_code: document.getElementById('reg_email_code').value.trim(),
    };
    if (EMAIL_VERIFY && !/^[0-9]{6}$/.test(payload.email_code)){
      msg.textContent = '請輸入 6 位數的信箱驗證碼（先按「寄送驗證碼」）'; msg.className = 'msg err'; return;
    }
    if (!payload.referral_code || !payload.name || !payload.account || !payload.password || !payload.phone || !payload.email){
      msg.textContent = '請完整填寫必填欄位（含手機、電子信箱）'; msg.className = 'msg err'; return;
    }
    payload.phone = payload.phone.replace(/[ -]/g, '').replace(/^(886|[+]886)/, '0');
    if (!/^09[0-9]{8}$/.test(payload.phone)){
      msg.textContent = '請輸入正確的台灣手機號碼（09 開頭共 10 碼）'; msg.className = 'msg err'; return;
    }
    const emailErr = emailError(payload.email);
    if (emailErr){ msg.textContent = emailErr; msg.className = 'msg err'; return; }
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
${SITE_DISCLAIMER_HTML}
</body>
</html>`;
}
