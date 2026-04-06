# WDMC ERP 系統開發進度與接續文件

> **最後更新時間**：2026-03-29 09:55 (台灣時間)
> **文件存檔位置**：`d:\WDMC\erptw\WDMC_ERP_開發進度與接續文件.md`
> **下次開啟方法**：對 AI 說 → **「請讀取 `d:\WDMC\erptw\WDMC_ERP_開發進度與接續文件.md` 的內容，了解我們的開發進度後接著開發」**

---

## 一、系統架構總覽

| 層級 | 技術 | 位置 |
|------|------|------|
| 前端 | React + Vite 6 | `d:\WDMC\erptw\wdmc-erp\client\` |
| 後端 | Express.js (Node.js v24) | `d:\WDMC\erptw\wdmc-erp\server\` |
| 資料庫 | 本地 JSON 檔案 (`db.js`) | `d:\WDMC\erptw\wdmc-erp\server\db.js` |
| 共用模組 | RBAC 權限、國際化 | `d:\WDMC\erptw\shared\` |
| 樣式 | 全局 CSS | `d:\WDMC\erptw\wdmc-erp\client\src\index.css` |
| 國際化 | 中文/英文 | `client\src\i18n\zh-TW.js` / `en.js` |

### 啟動方式
```bash
cd d:\WDMC\erptw\wdmc-erp
npm run dev          # 同時啟動前後端 (concurrently)
# 前端: http://localhost:5174
# 後端: http://localhost:3002
```

### 登入資訊
| 帳號 | 密碼 | 角色 |
|------|------|------|
| `ceo` | `wdmc2026` | 執行長（最高權限） |

---

## 二、模組清單與狀態（38 個前端頁面 + 40 個後端路由）

### 前端頁面（`client/src/pages/`）

| # | 頁面 | 路由 | 側邊欄分類 | 狀態 |
|---|------|------|-----------|------|
| 1 | Dashboard.jsx | `/` | 系統核心平台 | ✅ 正常 |
| 2 | Calendar.jsx | `/calendar` | 系統核心平台 | ✅ 正常 |
| 3 | DailyReport.jsx | `/daily-report` | 系統核心平台 | ✅ 正常 |
| 4 | VehicleBooking.jsx | `/vehicles` | 系統核心平台 | ✅ 正常 |
| 5 | QAGuide.jsx | `/guide` | 系統核心平台 | ✅ 正常 |
| 6 | Projects.jsx | `/projects` | 專案管理系統 | ✅ 正常 |
| 7 | ProjectDetail.jsx | `/projects/:id` | (子頁) | ✅ 已修復(加錯誤處理) |
| 8 | WinLossReport.jsx | `/win-loss` | 專案管理系統 | ✅ 正常 |
| 9 | Bonuses.jsx | `/bonuses` | 專案管理系統 | ✅ 已修復(fetch防護) |
| 10 | Customers.jsx | `/customers` | 客戶關係管理 | ✅ 正常 |
| 11 | CustomerDetail.jsx | `/customers/:id` | (子頁) | ✅ 已修復(hooks順序) |
| 12 | Proposals.jsx | `/proposals` | 提案與報價管理 | ✅ 正常 |
| 13 | Contracts.jsx | `/contracts` | 提案與報價管理 | ✅ 正常 |
| 14 | ESign.jsx | `/esign` | 提案與報價管理 | ✅ 已修復(token key) |
| 15 | Events.jsx | `/events` | 活動執行系統 | ✅ 正常 |
| 16 | Scheduling.jsx | `/scheduling` | 活動執行系統 | ✅ 正常 |
| 17 | Checklists.jsx | `/checklists` | 活動執行系統 | ✅ 正常 |
| 18 | LaborReports.jsx | `/labor` | 活動執行系統 | ✅ 正常 |
| 19 | Vendors.jsx | `/vendors` | 採購發包系統 | ✅ 正常 |
| 20 | PurchaseOrders.jsx | `/purchase-orders` | 採購發包系統 | ✅ 正常 |
| 21 | Assets.jsx | `/assets` `/assets/:category` | 器材資產管理 | ✅ 正常 |
| 22 | Inventory.jsx | `/inventory` | 器材資產管理 | ✅ 正常 |
| 23 | Resources.jsx | `/resources` | 器材資產管理 | ✅ 正常 |
| 24 | ProfitLoss.jsx | `/profit-loss` | 財務系統 | ✅ 正常 |
| 25 | Finance.jsx | `/finance` `/finance/:tab` | 財務系統 | ✅ 正常 |
| 26 | Payments.jsx | `/payments` | 財務系統 | ✅ 正常 |
| 27 | Journal.jsx | `/journal` | 財務系統 | ✅ 已修復(加路由+翻譯) |
| 28 | Approvals.jsx | `/approvals` | 財務系統 | ✅ 正常 |
| 29 | BIDashboard.jsx | `/bi` | 商業智慧 | ✅ 正常 |
| 30 | Knowledge.jsx | `/knowledge` | 商業智慧 | ✅ 正常 |
| 31 | Files.jsx | `/files` | 商業智慧 | ✅ 正常 |
| 32 | Attendance.jsx | `/attendance` | 人事系統 | ✅ 正常 |
| 33 | FormBuilder.jsx | `/forms` | 系統管理 | ✅ 正常 |
| 34 | Bridge.jsx | `/bridge` | 系統管理 | ✅ 正常 |
| 35 | Admin.jsx | `/admin` | (僅管理員) | ✅ 正常 |
| 36 | Login.jsx | `/login` | (登入頁) | ✅ 正常 |
| 37 | LiffLogin.jsx | (LINE LIFF) | (外部) | ✅ 正常 |
| 38 | RagicView.jsx | (未掛路由) | (備用) | ⚠️ 未使用中 |

### 後端路由檔案（`server/routes/`）
40 個 .js 檔案全部在 `server/index.js` 中正確掛載。

---

## 三、本次開發期間解決的所有問題

### 🔴 BUG #1：Journal 頁面完全無法訪問
- **現象**：`Journal.jsx` 已開發完成但完全斷線
- **原因**：沒有 import、沒有 Route、沒有側邊欄入口、沒有 i18n 翻譯
- **修復**：
  - `App.jsx`：添加 import + Route(`/journal`) + 側邊欄入口
  - `zh-TW.js`：添加 `'nav.journal': '📒 收支日記帳'`
  - `en.js`：添加 `'nav.journal': '📒 Journal'`
- **涉及檔案**：`App.jsx`, `zh-TW.js`, `en.js`

### 🔴 BUG #2：ESign 電子簽核白屏
- **現象**：點擊「Ragic 電簽」頁面白屏（ErrorBoundary 捕獲後顯示錯誤）
- **原因**：`ESign.jsx` 第 15 行使用 `localStorage.getItem('token')`，但系統登入時存的 key 是 `'erp_token'` → 所有 API 帶空 token → 401 → `r.json()` 解析出 `{error:"未登入"}` → `setRecords` 存了 object 而非 array → `.map()` 崩潰
- **修復**：
  1. `'token'` → `'erp_token'`
  2. 加 `r.ok ?` 檢查，API 失敗時回退到空 array/object
- **涉及檔案**：`ESign.jsx`

### 🔴 BUG #3：CustomerDetail 客戶詳情報 "Rendered more hooks" 錯誤
- **現象**：點客戶卡片的「詳情」按鈕 → 「頁面發生錯誤：Rendered more hooks than during the previous render」
- **原因**：我在第 52 行加的 `if (loadError) return` 和第 64 行 `if (!customer) return` 提前退出了組件渲染，但第 90 行還有一個 `useEffect` ← React 規則要求每次渲染 hooks 數量必須一致
- **修復**：將 `loadYearlyStats` 函數和 `useEffect` 移到所有 early return **之前**
- **涉及檔案**：`CustomerDetail.jsx`

### 🟡 BUG #4：Bonuses 獎金頁面 fetch 沒有 r.ok 檢查
- **現象**：如果 API 返回錯誤，`setBonuses()` 會收到 object 而非 array，後續 `.map()` 崩潰
- **修復**：所有 fetch 結果加 `r.ok` 檢查 + `Array.isArray()` 防護
- **涉及檔案**：`Bonuses.jsx`

### 🟡 BUG #5：ProjectDetail 缺少錯誤狀態
- **現象**：API 失敗時永遠顯示 loading 轉圈，不會告訴用戶
- **修復**：加 `loadError` state + 錯誤 UI + 重試按鈕
- **涉及檔案**：`ProjectDetail.jsx`

---

## 四、新增的系統防護元件

### ErrorBoundary（`client/src/components/ErrorBoundary.jsx`）
- **功能**：包裹所有路由的全局錯誤捕獲組件
- **行為**：任何 React 渲染崩潰 → 顯示「⚠️ 頁面發生錯誤」+ 具體錯誤訊息 + 除錯資訊 + 重新載入按鈕
- **設計**：
  - `key={location.pathname}` — 路由切換時自動重置錯誤狀態
  - 除錯資訊區塊預設展開（方便排查）
  - 不依賴 `process.env.NODE_ENV`（Vite 不支援）

---

## 五、關鍵技術備忘

### API 呼叫模式
系統有**兩種** API 呼叫方式，這是歷史原因造成的：

1. **集中式（大多數頁面）**：使用 `client/src/api.js` 的 `request()` 函數
   - Token key：`localStorage.getItem('erp_token')`
   - 自動加 `Bearer` header
   - 自動檢查 `res.ok`，失敗會 throw error

2. **直接 fetch（Bonuses、ESign）**：頁面自己寫 `fetch()` + 手動加 headers
   - ⚠️ **注意**：必須用 `'erp_token'`，不是 `'token'`
   - ⚠️ **注意**：必須檢查 `r.ok` 再 `.json()`

### React Hooks 規則
- **不能**：在 `if` / `return` 之後才調用 `useState`/`useEffect`
- **必須**：所有 hooks 放在組件函數的最頂部，任何 early return 之前
- **案例**：`CustomerDetail.jsx` 的 `useEffect(loadYearlyStats)` 必須在 `if (!customer) return` 之前

### 獎金計算邏輯（Bonuses）
已在另外的對話中確認客戶的雙軌制計算規則：
- **M 系列（標案）**：依毛利率級距分配
- **C 系列（活動）**：7:3 執行獎金分配
- 涉及稅率處理、tier 設定
- 詳細邏輯見 `server/routes/bonuses.js`（33KB，最大的後端檔案）

### 資料庫結構
- `server/db.js` 是自建的 JSON 檔案 DB
- 主要方法：`db.getAll(table)`, `db.getById(table, id)`, `db.find(table, filterFn)`, `db.insert(table, data)`, `db.update(table, id, data)`, `db.remove(table, id)`
- 資料表名稱：`customers`, `customer_cases`, `projects`, `proposals`, `contracts`, `events`, `bonuses`, `esign_records`, `journal_entries`, `inventory`, `assets`, `vendors`, `purchase_orders`, `payments`, `approvals`, `schedules`, `checklists`, `labor_reports`, `daily_reports`, `calendar_events`, `vehicle_bookings`, `attendance`, `files`, `knowledge`, `form_templates`, `form_submissions`, `activity_logs` 等

---

## 六、客戶相關背景

- **客戶公司**：WDMC（活動策劃公司）
- **客戶特性**：公司女性員工居多，UI 設計需考慮
- **業務類型**：活動執行、標案投標
- **原有系統**：Ragic（正在從 Ragic 遷移到此 ERP）
- **客戶提供過的資料**：
  - 活動執行工作流（9 頁 PPT）
  - 獎金計算規則
  - M/C 系列計算範例
- **側邊欄設計**：已改為文字按鈕風格（非小圖標），方便操作

---

## 七、目前待確認／未完成的項目

| 項目 | 狀態 | 說明 |
|------|------|------|
| CustomerDetail 實際可用性 | 🟡 待客戶測試 | Hooks 順序已修好，需要客戶清快取後確認 |
| ESign 電簽功能 | 🟡 待客戶測試 | Token key + r.ok 都修好了 |
| 活動執行工作流整合 | ⏳ 未開始 | 客戶 9 頁 PPT 已分析完，方案已產出(`implementation_plan.md`) |
| 獎金計算引擎 | ⏳ 需驗證 | 邏輯已實作在 `bonuses.js`，需客戶確認計算結果 |
| Ragic 數據遷移 | ⏳ 未開始 | 等客戶確認有意需求 |
| `RagicView.jsx` | ⚠️ 未掛路由 | 檔案存在但未使用，可能是舊的 iframe 查看器 |
| `api.js` 重複方法清理 | 💡 優化項 | 有些重複定義如 `getInventoryMovements` vs `getMovements` |
| Production 部署 | ⏳ 未開始 | 目前用 Cloudflare Tunnel 外網測試 |

---

## 八、重要文件索引

| 文件 | 路徑 | 說明 |
|------|------|------|
| 前端入口 | `client/src/App.jsx` | 路由表、側邊欄、全局結構 |
| API 定義 | `client/src/api.js` | 所有集中式 API 方法 |
| 後端入口 | `server/index.js` | Express 伺服器、路由掛載 |
| 資料庫 | `server/db.js` | JSON-based DB 引擎 |
| 權限系統 | `shared/rbac-middleware.js` + `shared/permissions.js` | RBAC 權限 |
| 錯誤邊界 | `client/src/components/ErrorBoundary.jsx` | 全局錯誤捕獲 |
| 中文翻譯 | `client/src/i18n/zh-TW.js` | 繁體中文 |
| CSS 設計系統 | `client/src/index.css` | 全局樣式、色彩變數 |
| 活動模組 | `client/src/pages/Events.jsx` (41KB) | 最大的前端元件 |
| 獎金模組 | `server/routes/bonuses.js` (33KB) | 最複雜的後端邏輯 |
| 本文件 | `d:\WDMC\erptw\WDMC_ERP_開發進度與接續文件.md` | 你正在看的這份 |

---

## 九、下次接續開發的提示詞

複製以下文字給 AI 即可無縫接續：

```
請讀取以下文件了解我們的 WDMC ERP 系統開發進度，然後接著開發：
d:\WDMC\erptw\WDMC_ERP_開發進度與接續文件.md

系統位置：d:\WDMC\erptw\wdmc-erp
啟動方式：cd d:\WDMC\erptw\wdmc-erp && npm run dev
前端：http://localhost:5174  後端：http://localhost:3002
登入：ceo / wdmc2026
```

---

*本文件由 AI 自動產生，記錄截至 2026-03-29 的完整開發狀態。*
