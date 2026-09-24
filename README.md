# 會員結帳系統（Cloudflare Pages + D1 版）

跟 Workers 版功能相同，並新增：
- 會員資料新增「帳號」「密碼」欄位（密碼加鹽雜湊儲存；帳號可留空，不強制會員一定要有登入帳密）
- 後台新增「儲值統計」頁籤：選擇月份後，依會員（或非會員名稱）列出當月**已完成付款**訂單的筆數與金額合計

## 檔案結構
```
member-checkout-pages/
├── wrangler.toml         # Pages 專案設定（含 D1 binding）
├── schema.sql            # 全新安裝用的資料庫結構
├── migrate_v2.sql        # 若你之前已用 Workers 版部署過，跑這個來升級既有資料庫
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
   - 從 Workers 版升級既有資料庫：
     ```
     wrangler d1 execute checkout_db --file=./migrate_v2.sql
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
目前系統只把帳號/密碼存起來（密碼是加鹽 SHA-256 雜湊，不是明文），
後台可以新增、修改。**目前還沒有做「會員自己登入查詢儲值記錄」的前台頁面**——
如果之後需要，這組帳密已經可以直接拿來驗證登入，我可以再幫你加上會員自助入口。

## 其他備註（與 Workers 版相同）
- 轉帳／超商條碼／台灣Pay 目前都是後台人工核對後按「標記已付款」。
- 月報表用 CSV（Excel 可直接開啟，中文不亂碼），非真正的 `.xlsx`。
- 條碼圖片目前直接以 base64 存進 D1，適合中小流量；量大建議改存 R2。
