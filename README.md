# 會員結帳系統（Cloudflare Pages + D1 版）

跟 Workers 版功能相同，並新增：
- 會員資料新增「帳號」「密碼」欄位（密碼加鹽雜湊儲存；帳號可留空，不強制會員一定要有登入帳密）
- 後台新增「儲值統計」頁籤：選擇月份後，依會員（或非會員名稱）列出當月**已完成付款**訂單的筆數與金額合計
- **訂單更正**：後台訂單列表可修正打錯的金額、會員、付款方式（已取消或已結案的訂單不能再更正）
- **訂單完成（結案）標記**：訂單「已完成付款」後，可再手動點「訂單完成」多打一個結案標記，方便篩選哪些訂單已經處理完畢，**不影響金流本身**；可隨時取消結案再更正
- **付款證明上傳**：前台付款頁（轉帳、超商條碼）新增「上傳截圖 / 填寫帳號末幾碼」表單，客人送出後後台訂單列表會顯示縮圖與末幾碼，方便核對款項
- **前台會員自助查詢**：新增 `/member` 頁面，會員可用帳號密碼登入查詢自己的訂單記錄與付款狀態（帳密仍由後台「會員管理」建立/重設）
- 前台付款頁改為在訂單尚未結束前持續每 5 秒自動輪詢，店家在後台的操作（例如上傳條碼、標記已付款）會自動反映到客人畫面，不用手動重新整理
- **本次新增**：
  - 訂單列表新增「查看連結」按鈕，隨時可以重新取得某筆訂單的前台付款連結（**到期時間不會因為查看而改變，仍是建立當下起算 3 小時**）
  - 訂單列表新增「刪除」按鈕：徹底移除該筆訂單記錄，無法復原（跟「取消」不同，取消只是改狀態、記錄還留著）
  - 會員管理新增「編輯」按鈕：姓名、電話、備註、帳號都可以隨時修改；如果同時想改密碼，在編輯畫面的密碼欄位輸入新密碼即可（留空表示不變更密碼）
  - 以上功能不需要跑新的資料庫升級腳本，沿用既有的 D1 資料表結構即可

## 檔案結構
```
member-checkout-pages/
├── wrangler.toml         # Pages 專案設定（含 D1 binding）
├── schema.sql            # 全新安裝用的資料庫結構
├── migrate_v2.sql        # 若你之前已用 Workers 版部署過，跑這個來升級既有資料庫
├── migrate_v3.sql        # 既有 D1 資料庫升級：新增訂單更正/結案/付款證明所需欄位（跑過 v2 的都要再跑這個）
├── public/
│   └── robots.txt        # 純佔位檔案，讓 Pages 的靜態輸出資料夾不是空的
└── functions/
    ├── [[path]].js       # 攔截所有路徑的主要邏輯（路由、API、頁面）
    └── _lib/
        ├── helpers.js    # 共用工具（登入驗證、密碼雜湊、cookie 簽署等）
        └── templates.js  # 後台 / 前台的 HTML 頁面
```
> `_lib` 資料夾開頭有底線，Cloudflare Pages 慣例會排除它不當作路由，但檔案仍可以正常被 import 使用。

## 部署步驟

1. 安裝 wrangler（若尚未安裝）
   ```
   npm install -g wrangler
   wrangler login
   ```

2. 建立 D1 資料庫（若是從 Workers 版升級，直接沿用原本的資料庫即可，不用重建）
   ```
   wrangler d1 create checkout_db
   ```
   把輸出的 `database_id` 貼到 `wrangler.toml`。

3. 建立資料表
   - 全新安裝：
     ```
     wrangler d1 execute checkout_db --file=./schema.sql
     ```
   - 從 Workers 版升級既有資料庫（沒跑過 v2 的話）：
     ```
     wrangler d1 execute checkout_db --file=./migrate_v2.sql
     ```
   - 任何既有資料庫，只要還沒有「訂單更正 / 結案 / 付款證明」這批新欄位，都要再跑一次：
     ```
     wrangler d1 execute checkout_db --file=./migrate_v3.sql
     ```

4. 建立 Pages 專案並設定機密值
   ```
   wrangler pages project create member-checkout-pages
   wrangler pages secret put ADMIN_SESSION_SECRET --project-name=member-checkout-pages
   ```

5. 部署
   ```
   wrangler pages deploy public --project-name=member-checkout-pages
   ```
   （`functions/` 資料夾會被 wrangler 自動一併打包部署，不需要另外處理）

6. 如果 D1 binding 沒有透過 `wrangler.toml` 自動生效，也可以到 Cloudflare Dashboard →
   Pages 專案 → Settings → Functions → D1 database bindings，手動把 `DB` 綁定到 `checkout_db`。

7. 部署完成後開啟 `https://你的網域/admin`：
   - 第一次會顯示「尚未建立任何管理員帳號」，直接輸入想要的帳號密碼即可完成建立。
   - 先到「付款設定」填入轉帳帳戶資訊，再開始使用「結帳櫃檯」「會員管理」「儲值統計」等功能。

## 「儲值統計」的計算邏輯
統計範圍是**該月份已經被後台標記為「已完成付款」的訂單**（也就是 `paid_at` 落在所選月份內），
依會員分組加總金額與筆數；非會員則依訂單建立時填的名稱分組（同名會歸在一起）。
如果之後想改成「以訂單建立時間」而非「付款完成時間」來統計，可以在
`functions/[[path]].js` 的 `handleMonthlyStats` 函式裡把 `paid_at` 改成 `created_at` 即可。

## 會員帳號密碼的用途
帳號/密碼由後台「會員管理」新增、修改（密碼是加鹽 SHA-256 雜湊，不是明文存放）。
會員可以拿這組帳密到 `/member` 頁面自己登入，查詢自己的訂單記錄與付款狀態（唯讀，無法自己改資料）。
如果會員帳號還沒設定密碼，登入時會提示「請洽店家開通」。

## 其他備註（與 Workers 版相同）
- 轉帳／超商條碼／台灣Pay 目前都是後台人工核對後按「標記已付款」；付款證明（截圖／末幾碼）只是輔助核對，不會自動改變訂單狀態。
- 月報表用 CSV（Excel 可直接開啟，中文不亂碼），非真正的 `.xlsx`；CSV 已包含「訂單完成(結案)」與「付款證明末幾碼」欄位。
- 條碼圖片、付款證明截圖目前都直接以 base64 存進 D1，適合中小流量；量大建議改存 R2。
- 「訂單更正」與「訂單完成」互斥：已結案的訂單要先按「取消結案」才能再更正金額/會員/付款方式。
