// 服務條款（/terms）與隱私權政策（/privacy）頁面。
//
// 內容鎖定「代儲值點數／遊戲幣／序號型商品」這種生意型態來寫，特別處理了一件事：
// 消費者保護法第 19 條原則上給消費者網路交易 7 天猶豫期（無條件退貨退款），但「通訊交易解除權
// 合理例外情事適用準則」第 2 條第 5 款，把「非以有形媒介提供之數位內容，或一經提供即為完成之線上
// 服務」排除在猶豫期之外——前提是「事先明確告知消費者」。這份條款把這件事寫清楚，並且在付款頁
// 和會員下單頁都有對應的提示／勾選同意，取得「事先告知＋同意」的紀錄。
//
// 店家資訊（公司/品牌名稱、負責人、統一編號、地址、客服電話／信箱）從環境變數帶入，
// 請在 wrangler.toml 的 [vars] 填寫正確，沒填的欄位會直接顯示「尚未設定」提醒你補上。
//
// 重要：這份條款是「可以直接上線用」的草稿，已經盡量貼合台灣相關法規的要求，但畢竟不是律師
// 撰寫或審閱過的文件，正式上線前還是建議找律師看一次，尤其是「企業經營者資訊」跟「退款條件」
// 這兩塊——這部分如果跟你實際的營運方式對不上，等於白紙黑字給自己找麻煩。

function bizInfo(env) {
  const need = (v, hint) => (v && String(v).trim()) || `（尚未設定，請在 wrangler.toml 填入 ${hint}）`;
  return {
    name: need(env.BIZ_NAME, "BIZ_NAME"),
    owner: need(env.BIZ_OWNER, "BIZ_OWNER"),
    taxId: need(env.BIZ_TAX_ID, "BIZ_TAX_ID"),
    address: need(env.BIZ_ADDRESS, "BIZ_ADDRESS"),
    phone: need(env.BIZ_PHONE, "BIZ_PHONE"),
    email: (env.BIZ_EMAIL && env.BIZ_EMAIL.trim()) || extractEmail(env.EMAIL_FROM_ORDER) || extractEmail(env.EMAIL_FROM) || "（尚未設定，請在 wrangler.toml 填入 BIZ_EMAIL）",
  };
}

// EMAIL_FROM 格式通常是 "顯示名稱 <email@domain>"，取出尖括號裡的信箱當作客服信箱的備援值
function extractEmail(from) {
  if (!from) return "";
  const m = String(from).match(/<([^>]+)>/);
  return m ? m[1] : String(from).trim();
}

const PAGE_CSS = `
  :root{--bg:#F7F7FA;--card:#FFFFFF;--ink:#1C1E26;--muted:#6B7080;--line:#E3E5EC;--accent:#2E6BE6;color-scheme:light dark;}
  @media (prefers-color-scheme: dark){
    :root{--bg:#0F1117;--card:#181B26;--ink:#E8EAF2;--muted:#9096AA;--line:#2A2E3D;--accent:#7FA6F0;}
  }
  *{box-sizing:border-box;}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Microsoft JhengHei",sans-serif;line-height:1.75;}
  .wrap{max-width:760px;margin:0 auto;padding:32px 20px 80px;}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:28px 28px 8px;}
  h1{font-size:22px;margin:0 0 4px;}
  .updated{color:var(--muted);font-size:13px;margin-bottom:24px;}
  h2{font-size:17px;margin:28px 0 10px;border-left:4px solid var(--accent);padding-left:10px;}
  p,li{font-size:14.5px;color:var(--ink);}
  ul,ol{padding-left:22px;}
  .muted{color:var(--muted);}
  .notice{background:rgba(46,107,230,.08);border:1px solid rgba(46,107,230,.25);border-radius:10px;padding:14px 16px;margin:16px 0;font-size:14px;}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;}
  td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top;}
  td:first-child{color:var(--muted);white-space:nowrap;width:110px;}
  a{color:var(--accent);}
  .back{display:inline-block;margin-bottom:18px;font-size:14px;}
  footer{text-align:center;color:var(--muted);font-size:12px;margin-top:28px;}
`;

function pageShell(title, bizName, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/member">← 回會員中心</a>
  <div class="card">${bodyHtml}</div>
  <footer>© ${new Date().getFullYear()} ${escapeHtml(bizName)}</footer>
</div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function termsHtml(env) {
  const b = bizInfo(env);
  const body = `
    <h1>服務條款</h1>
    <div class="updated">最後更新：${new Date().toISOString().slice(0, 10)}</div>

    <h2>一、企業經營者資訊</h2>
    <table>
      <tr><td>名稱</td><td>${escapeHtml(b.name)}</td></tr>
      <tr><td>負責人</td><td>${escapeHtml(b.owner)}</td></tr>
      <tr><td>統一編號</td><td>${escapeHtml(b.taxId)}</td></tr>
      <tr><td>營業地址</td><td>${escapeHtml(b.address)}</td></tr>
      <tr><td>客服電話</td><td>${escapeHtml(b.phone)}</td></tr>
      <tr><td>客服信箱</td><td>${escapeHtml(b.email)}</td></tr>
    </table>

    <h2>二、服務內容</h2>
    <p>本網站（以下稱「本服務」）提供代儲值各類平台點數／遊戲幣，以及序號（兌換碼）型商品之銷售與交付服務。商品交易頁面呈現之名稱、價格、內容及其他相關資訊，為本條款及雙方契約之一部分。</p>

    <h2>三、下單與付款</h2>
    <ol>
      <li>會員於本服務下單前，應確認訂單之商品、數量、金額及收款／到帳資訊無誤；本服務提供下單前之金額與內容確認機制。</li>
      <li>本服務支援之付款方式（例如銀行轉帳、超商條碼繳費等）以下單當下頁面實際顯示者為準。</li>
      <li>以銀行轉帳付款者，因需人工核對入帳資訊，到帳確認可能無法即時完成，實際處理時間以後台通知為準，並非回傳付款證明即視為完成交易。</li>
      <li>以超商條碼繳費者，條碼有一定之繳費期限，逾期條碼失效，須另行建立訂單。</li>
    </ol>

    <h2>四、商品交付方式</h2>
    <p>依商品性質不同，可能以下列方式之一完成交付：由客服人員直接於第三方平台（例如直播/社群平台）帳號內儲值點數或遊戲幣；或由本服務於後台產生、顯示或寄送序號（兌換碼）供會員自行兌換。商品一經完成前述任一交付方式，即視為已完成交付。</p>

    <div class="notice">
      <strong>五、關於七日猶豫期（解除契約權）之排除適用——請務必詳閱</strong>
      <p style="margin:10px 0 0;">依消費者保護法第 19 條，網路交易原則上消費者得於收受商品後 7 日內無條件解除契約。但依行政院發布之「通訊交易解除權合理例外情事適用準則」第 2 條第 5 款規定：<b>「非以有形媒介提供之數位內容，或一經提供即為完成之線上服務，經消費者事先同意始提供者」</b>，不適用前述 7 日解除權。</p>
      <p style="margin:10px 0 0;">本服務所銷售之<b>平台點數／遊戲幣／序號（兌換碼）</b>商品，均屬前述排除適用之情形：一經本服務完成儲值或提供序號，即已完成交付，<b>不適用 7 日猶豫期之無條件退貨退款</b>。會員於下單時勾選同意本條款，即視為已事先知悉並同意本項排除規定。</p>
      <p style="margin:10px 0 0;">前述排除不影響會員依民法或其他法規得主張之權利，例如因商品本身有瑕疵（如儲值金額與實際交付不符、序號無法使用等可歸責於本服務之情形），仍得依本條款第六點主張退款或補發。</p>
    </div>

    <h2>六、退款、補發與取消</h2>
    <ul>
      <li>訂單尚未完成儲值或尚未提供序號前，會員得向客服申請取消訂單；已完成付款但尚未出貨者，將原路退回已收款項。</li>
      <li>若因可歸責於本服務之原因（例如實際入帳或儲值金額與訂單不符、序號重複或無法使用），本服務將於查證後補發或退款；請於發現問題後儘速聯繫客服並提供訂單編號及相關佐證。</li>
      <li>若因會員自行提供錯誤之收款帳號、平台帳號等資訊，導致儲值儲錯對象或序號無法使用，本服務將協助排查，但不保證得以追回已交付之款項或商品，相關風險由會員自行負擔。</li>
      <li>序號（兌換碼）一經顯示、寄送或下載，即視為已完成交付，恕無法以「尚未使用」為由申請退款。</li>
    </ul>

    <h2>七、第三方平台風險之免責說明</h2>
    <p>本服務所代儲值之點數、遊戲幣或其他虛擬商品，係依附於第三方平台（例如社群、直播或遊戲平台）之帳號與服務。該等第三方平台之服務內容、使用規則、帳號狀態（包含但不限於帳號被平台暫停、限制或移除）均非本服務所能控制或保證，因此所生之損失或不便，本服務不負擔賠償責任，惟仍會於合理範圍內協助會員向平台反映或處理。</p>

    <h2>八、會員帳號與資安</h2>
    <p>會員應妥善保管自己的登入帳號密碼（及已啟用之兩步驟驗證備援碼），因帳號密碼保管不當致生之損失，本服務不負擔賠償責任。本服務之個人資料蒐集、處理及利用方式，請參閱<a href="/privacy">隱私權政策</a>。</p>

    <h2>九、契約解釋原則</h2>
    <p>本條款如有疑義時，應為有利於消費者之解釋。</p>

    <h2>十、準據法與管轄</h2>
    <p>本條款之解釋與適用，以中華民國法律為準據法。如因本條款發生爭議，雙方同意以本服務營業所在地之地方法院為第一審管轄法院，但不排除消費者保護法所定得由消費者住所地法院管轄之規定。</p>

    <h2>十一、條款修改與聯絡方式</h2>
    <p>本服務得視需要修訂本條款，修訂後將公告於本頁面；如有任何疑問，歡迎透過上列客服電話或信箱與我們聯繫。</p>
  `;
  return pageShell("服務條款", b.name, body);
}

export function privacyHtml(env) {
  const b = bizInfo(env);
  const body = `
    <h1>隱私權政策</h1>
    <div class="updated">最後更新：${new Date().toISOString().slice(0, 10)}</div>

    <p>${escapeHtml(b.name)}（以下稱「本服務」）非常重視會員的隱私權與個人資料保護，依個人資料保護法及相關法規，向會員說明本服務蒐集、處理及利用個人資料之方式如下。</p>

    <h2>一、蒐集之個人資料類別</h2>
    <ul>
      <li>註冊與聯絡資訊：姓名（暱稱）、電話、電子郵件信箱、登入帳號。</li>
      <li>交易相關資訊：訂單紀錄、儲值之第三方平台帳號、付款證明截圖（例如轉帳明細畫面）、銀行帳號後幾碼等必要之核對資訊。</li>
      <li>帳號安全資訊：密碼（僅以不可逆雜湊方式儲存）、兩步驟驗證設定狀態（不會儲存驗證器 App 顯示的驗證碼本身）。</li>
      <li>系統自動產生之紀錄：登入時間、操作紀錄、裝置推播通知訂閱資訊（如會員啟用通知功能）。</li>
    </ul>

    <h2>二、蒐集目的</h2>
    <ul>
      <li>會員身分辨識、帳號管理與登入驗證。</li>
      <li>處理訂單、付款核對、商品（點數／序號）交付與客服聯繫。</li>
      <li>防範詐欺、異常登入與帳號盜用（例如連續登入失敗鎖定機制）。</li>
      <li>依法令規定保存交易紀錄，以及處理法律所要求之通知、客訴或爭議事項。</li>
    </ul>

    <h2>三、利用期間、地區、對象及方式</h2>
    <ul>
      <li><b>期間</b>：自會員註冊起，至會員申請刪除帳號或依法令規定之保存期限屆滿為止；付款證明等交易佐證資料，將配合交易糾紛處理及法令要求之保存期限保存。</li>
      <li><b>地區</b>：本服務及其委託之雲端服務供應商（例如 Cloudflare）所在之地區。</li>
      <li><b>對象</b>：僅本服務內部作業所需之人員，以及為完成交易所必要之第三方（例如寄送通知之電子郵件服務供應商）；本服務不會將個人資料提供予上述目的以外之第三方作商業利用。</li>
      <li><b>方式</b>：以自動化及人工方式，於前述目的範圍內處理及利用。</li>
    </ul>

    <h2>四、會員得行使之權利</h2>
    <p>依個人資料保護法第 3 條規定，會員就其個人資料得向本服務行使下列權利，且本服務不得要求會員預先拋棄或限制此等權利：</p>
    <ul>
      <li>查詢或請求閱覽。</li>
      <li>請求製給複製本。</li>
      <li>請求補充或更正。</li>
      <li>請求停止蒐集、處理或利用。</li>
      <li>請求刪除。</li>
    </ul>
    <p>會員如欲行使上述權利，請透過下方聯絡方式與客服聯繫；本服務將於合理期間內處理回覆。</p>

    <h2>五、資料安全維護措施</h2>
    <p>本服務採取包含但不限於下列措施保護會員個人資料：密碼以不可逆雜湊方式儲存、後台帳號提供連續登入失敗鎖定及選用之兩步驟驗證、所有管理後台操作均留有可追溯之操作紀錄。惟網路傳輸及電子化儲存無法做到百分之百安全，本服務將持續檢視並改善資安措施。</p>

    <h2>六、Cookie 與類似技術</h2>
    <p>本服務可能使用瀏覽器本機儲存技術（例如登入狀態之 Cookie／Session）以維持會員登入狀態與基本使用體驗，不會用於第三方廣告追蹤。</p>

    <h2>七、政策修改</h2>
    <p>本政策將依法令或本服務業務需要適時修訂，修訂後將公告於本頁面。</p>

    <h2>八、聯絡方式</h2>
    <table>
      <tr><td>客服電話</td><td>${escapeHtml(b.phone)}</td></tr>
      <tr><td>客服信箱</td><td>${escapeHtml(b.email)}</td></tr>
      <tr><td>營業地址</td><td>${escapeHtml(b.address)}</td></tr>
    </table>
  `;
  return pageShell("隱私權政策", b.name, body);
}
