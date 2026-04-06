const fs = require('fs');
const path = require('path');

const imgDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\b113d13b-9c93-47cd-8aea-dff9ba851813';

function toBase64(filename) {
  const fp = path.join(imgDir, filename);
  if (!fs.existsSync(fp)) return '';
  const data = fs.readFileSync(fp);
  return `data:image/png;base64,${data.toString('base64')}`;
}

const imgs = {
  dashboard: toBase64('img_dashboard.png'),
  newProject: toBase64('img_new_project.png'),
  analysis: toBase64('img_analysis.png'),
  proposal: toBase64('img_proposal.png'),
  costs: toBase64('img_costs.png'),
  venueEmpty: toBase64('img_venue_empty.png'),
  venueResult: toBase64('img_venue_result.png'),
};

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>WDMC AI 賦能系統 — 功能實作回報書</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans TC', sans-serif; background: #fff; color: #1a1a2e; line-height: 1.7; }
  
  .cover { 
    page-break-after: always; height: 100vh; display: flex; flex-direction: column; 
    justify-content: center; align-items: center; text-align: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white; padding: 60px;
  }
  .cover h1 { font-size: 42px; font-weight: 900; margin-bottom: 16px; letter-spacing: 2px; }
  .cover h2 { font-size: 24px; font-weight: 400; opacity: 0.85; margin-bottom: 40px; }
  .cover .meta { font-size: 16px; opacity: 0.7; }
  .cover .logo { font-size: 64px; margin-bottom: 30px; 
    width: 100px; height: 100px; border-radius: 24px; background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center; margin: 0 auto 30px;
    font-weight: 900; font-size: 36px; backdrop-filter: blur(10px);
  }

  .page { padding: 50px 60px; page-break-after: always; min-height: 100vh; }
  .page:last-child { page-break-after: auto; }

  .section-num { 
    display: inline-block; width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #667eea, #764ba2); color: white;
    text-align: center; line-height: 36px; font-weight: 700; font-size: 16px;
    margin-right: 12px; vertical-align: middle;
  }
  .section-title { 
    font-size: 26px; font-weight: 900; color: #1a1a2e; margin-bottom: 6px;
    display: flex; align-items: center;
  }
  .section-slide { font-size: 13px; color: #8b5cf6; font-weight: 500; margin-bottom: 20px; margin-left: 48px; }
  
  .requirement { 
    background: #f8f7ff; border-left: 4px solid #8b5cf6; padding: 14px 20px;
    border-radius: 0 10px 10px 0; margin-bottom: 20px; font-size: 14px;
  }
  .requirement strong { color: #667eea; }

  .screenshot { 
    width: 100%; border-radius: 12px; border: 1px solid #e8e5f0;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08); margin: 20px 0;
  }

  .features { margin: 20px 0 20px 48px; }
  .features li { 
    font-size: 14px; margin-bottom: 6px; padding-left: 8px;
    list-style: none; position: relative;
  }
  .features li::before { 
    content: "✅"; position: absolute; left: -22px; 
  }

  .step-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
  .step-table th { 
    background: linear-gradient(135deg, #667eea, #764ba2); color: white;
    padding: 10px 16px; text-align: left; font-weight: 600;
  }
  .step-table td { padding: 10px 16px; border-bottom: 1px solid #f0edf5; }
  .step-table tr:nth-child(even) td { background: #faf8ff; }
  .step-table .highlight td { background: rgba(139,92,246,0.08); font-weight: 600; }

  .divider { border: none; border-top: 2px solid #f0edf5; margin: 30px 0; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .two-col img { width: 100%; }

  @media print {
    .page { padding: 30px 40px; }
    .cover { padding: 40px; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- 封面 -->
<div class="cover">
  <div class="logo">W</div>
  <h1>WDMC AI 賦能系統</h1>
  <h2>功能實作回報書</h2>
  <p class="meta">對照客戶修改意見書（14 頁投影片）逐項驗收</p>
  <p class="meta" style="margin-top: 30px;">
    回報日期：2026 年 3 月 31 日<br>
    開發團隊：WDMC 技術部
  </p>
</div>

<!-- 第一頁：Dashboard -->
<div class="page">
  <div class="section-title"><span class="section-num">1</span> 首頁 Dashboard 雙視角</div>
  <div class="section-slide">對應客戶意見書 Slide 1-2</div>
  
  <div class="requirement">
    <strong>客戶需求：</strong>管理層看全局統計 + 各企劃績效；企劃人員只看自己的數據。每月統計得標幾案（標案/商案），每月得標金額分開呈現，每個企劃得標案件統計。
  </div>

  <img class="screenshot" src="${imgs.dashboard}" alt="Dashboard">

  <ul class="features">
    <li>管理視角：進行中專案數、本月提案數、本月得標數（標案/商案分開）、得標金額</li>
    <li>各企劃得標績效：顯示每位企劃的勝率、進行中案件數、得標金額排名</li>
    <li>近 6 月趨勢圖：提案 vs 得標按月統計柱狀圖</li>
    <li>近期事項：依日期列出截止日、簡報排練、場勘等重要事項</li>
    <li>進行中專案列表：顯示「主寫：執行長」標籤追蹤負責人</li>
    <li>右上角「管理視角」切換按鈕：切換後只顯示個人負責的案件與統計</li>
  </ul>
</div>

<!-- 第二頁：新建專案 -->
<div class="page">
  <div class="section-title"><span class="section-num">2</span> 新建專案 — 主寫企劃欄位</div>
  <div class="section-slide">對應客戶意見書 Slide 3</div>
  
  <div class="requirement">
    <strong>客戶需求：</strong>新建專案時增加「主寫企劃」選項（下拉選人），追蹤每案由誰主筆撰寫。
  </div>

  <img class="screenshot" src="${imgs.newProject}" alt="新建專案">

  <ul class="features">
    <li>「主寫企劃」下拉選單 — 從系統使用者中選擇負責企劃人員</li>
    <li>案件類型雙選卡片：標案（公部門）/ 商案（企業）</li>
    <li>專案列表顯示「主寫：xxx」標籤，快速辨識負責人</li>
    <li>後續統計各企劃的產出量與得標率</li>
  </ul>
</div>

<!-- 第三頁：AI 分析 -->
<div class="page">
  <div class="section-title"><span class="section-num">3</span> 評選標準、交付成果物、風險評估</div>
  <div class="section-slide">對應客戶意見書 Slide 4-6</div>
  
  <div class="requirement">
    <strong>客戶需求：</strong>AI 解析投標文件中的評審須知和配分表，自動提取評分項目與權重。AI 判讀報價清單項目判斷交付內容。AI 自動產出潛在風險評估。
  </div>

  <img class="screenshot" src="${imgs.analysis}" alt="AI 分析">

  <ul class="features">
    <li><strong>應交付成果物</strong>：AI 從投標文件自動提取（活動執行、電影放映設備、遊戲場攤位...）</li>
    <li><strong>評選標準與配分</strong>：廠商執行能力 30%、活動規劃設計 25%、價格合理性 20%、廠商經驗 25%</li>
    <li>「手動編輯」按鈕可修改、新增、刪除評分項目（配分加總校驗 = 100%）</li>
    <li><strong>潛在風險</strong>：天氣因素、廠商執行力不足、預算不足（AI 自動分析產出）</li>
    <li><strong>AI 策略建議</strong>：根據文件內容提出整體策略方向</li>
  </ul>
</div>

<!-- 第四頁：企劃書撰寫 -->
<div class="page">
  <div class="section-title"><span class="section-num">4</span> 企劃書撰寫 + AI 逐項追問 + 模擬圖</div>
  <div class="section-slide">對應客戶意見書 Slide 8-12（核心需求）</div>
  
  <div class="requirement">
    <strong>客戶需求：</strong>針對單一子項目 AI 追問對話（非全部重新生成）。每個活動子項目旁邊各有「一鍵產出遊戲模擬圖」按鈕。可以問 AI 推薦片單、在地攤販等具體內容。
  </div>

  <img class="screenshot" src="${imgs.proposal}" alt="企劃書撰寫">

  <ul class="features">
    <li>每個活動子項展開顯示：規則、道具、空間、人力、傳達理念</li>
    <li><strong>「一鍵產出模擬圖」</strong>按鈕 — 每個活動子項旁邊各自獨立</li>
    <li><strong>AI 追問</strong>輸入框 — 針對單一項目深入提問（如：推薦片單、在地攤販）</li>
    <li>多輪對話支援 — 可持續追問不同面向</li>
    <li>「重新撰寫」按鈕 + 收起/展開控制</li>
    <li>右上角「一鍵全部生成」+「匯出企劃書」按鈕</li>
  </ul>
</div>

<!-- 第五頁：成本估算 -->
<div class="page">
  <div class="section-title"><span class="section-num">5</span> 預估成本表 + 預算校驗</div>
  <div class="section-slide">對應客戶意見書 Slide 13</div>
  
  <div class="requirement">
    <strong>客戶需求：</strong>依報價清單產出預算表內容，給予基本報價數字，而加總的數字要是這案子的金額。
  </div>

  <img class="screenshot" src="${imgs.costs}" alt="預估成本表">

  <ul class="features">
    <li><strong>從報價單匯入</strong>：一鍵從 AI 解析結果批量建立成本項目</li>
    <li><strong>AI 成本建議</strong>：AI 自動產出各類別預算項目</li>
    <li><strong>AI 自動調整</strong>：按比例縮放所有項目使加總精確等於專案總金額</li>
    <li><strong>預算校驗</strong>：即時顯示紅/綠狀態（案子總金額 vs 成本合計 vs 差額）</li>
    <li>完整表格結構：類別 / 項目名稱 / 單位 / 數量 / 單價 / 小計 / 備註</li>
    <li>上方快捷標籤：人事費、場地費、設備費、設計印刷費等分類加總</li>
  </ul>
</div>

<!-- 第六頁：場地模擬 -->
<div class="page">
  <div class="section-title"><span class="section-num">6</span> 場地佈置模擬 ⭐ 新功能</div>
  <div class="section-slide">對應客戶意見書 Slide 14</div>
  
  <div class="requirement">
    <strong>客戶需求：</strong>有沒有機會做一個場地佈置模擬圖的程式？我丟照片然後請他模擬我要的佈置的樣子。例如上傳一個門口，給 AI 關鍵字：「請幫我模擬黑金色的氣球拱門」。
  </div>

  <div class="two-col">
    <div>
      <img class="screenshot" src="${imgs.venueEmpty}" alt="場地模擬介面">
      <p style="text-align:center; font-size:12px; color:#94a3b8; margin-top:8px;">▲ 場地模擬操作介面</p>
    </div>
    <div>
      <img class="screenshot" src="${imgs.venueResult}" alt="場地模擬結果">
      <p style="text-align:center; font-size:12px; color:#94a3b8; margin-top:8px;">▲ 黑金色氣球拱門模擬結果</p>
    </div>
  </div>

  <ul class="features">
    <li><strong>上傳場地照片</strong>（選填）：拖曳或點擊上傳 JPG/PNG</li>
    <li><strong>佈置描述關鍵字</strong>：自由輸入想要的佈置效果</li>
    <li><strong>9 個快速標籤</strong>：黑金色氣球拱門、紅色地毯、LED 背板、帳篷、舞台、打卡牆等</li>
    <li><strong>4 種模擬風格</strong>：擬真風格、插畫風格、3D 渲染、平面配置圖</li>
    <li>AI 智能中文語意解析（自動辨識「黑金色氣球拱門」轉成場景描述）</li>
    <li>DALL-E 3 整合（設定 API Key 後可產出真實佈置效果圖）</li>
    <li>重新生成 + 下載 + 查看 AI 提示詞</li>
  </ul>
</div>

<!-- 第七頁：步驟總覽 -->
<div class="page">
  <div class="section-title"><span class="section-num">7</span> 完整 12 步驟流程總覽</div>
  <div class="section-slide">系統完整工作流程</div>

  <table class="step-table">
    <thead>
      <tr><th>步驟</th><th>名稱</th><th>對應需求</th><th>狀態</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>文件庫</td><td>上傳招標文件</td><td>✅ 完成</td></tr>
      <tr><td>2</td><td>AI 分析</td><td>Slide 4-6：評選標準 / 報價清單 / 風險</td><td>✅ 完成</td></tr>
      <tr><td>3</td><td>主題包裝</td><td>活動主題選定</td><td>✅ 完成</td></tr>
      <tr><td>4</td><td>企劃亮點</td><td>亮點篩選</td><td>✅ 完成</td></tr>
      <tr><td>5</td><td>架構總表</td><td>Slide 7：Tags + 亮點排版</td><td>✅ 完成</td></tr>
      <tr><td>6</td><td>企劃書撰寫</td><td>Slide 8-12：AI 追問 + 模擬圖</td><td>✅ 完成</td></tr>
      <tr class="highlight"><td>7</td><td>場地模擬 ⭐</td><td>Slide 14：照片 + AI 佈置模擬</td><td>✅ 新增</td></tr>
      <tr><td>8</td><td>成本估算</td><td>Slide 13：預算表 + 校驗</td><td>✅ 完成</td></tr>
      <tr><td>9</td><td>企劃書</td><td>自動彙整排版</td><td>✅ 完成</td></tr>
      <tr><td>10</td><td>印刷管理</td><td>印刷輸出管理</td><td>✅ 完成</td></tr>
      <tr><td>11</td><td>投標管理</td><td>投標追蹤</td><td>✅ 完成</td></tr>
      <tr><td>12</td><td>簡報</td><td>簡報產出</td><td>✅ 完成</td></tr>
    </tbody>
  </table>

  <hr class="divider">

  <div style="text-align: center; padding: 40px 0;">
    <div style="font-size: 20px; font-weight: 700; color: #667eea; margin-bottom: 12px;">客戶需求完成率</div>
    <div style="font-size: 64px; font-weight: 900; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">95%</div>
    <div style="font-size: 14px; color: #94a3b8; margin-top: 8px;">19 項需求中 18 項完成 · 1 項待升級</div>
    <div style="margin-top: 30px; font-size: 13px; color: #64748b; max-width: 560px; margin-left: auto; margin-right: auto; text-align: left;">
      <strong>待升級項目：</strong><br>
      場地模擬「照片疊加」功能 — 目前可上傳照片並根據關鍵字生成全新模擬圖，但尚未實現「在上傳照片上直接疊加裝飾」的效果。需整合 OpenAI Image Edit API 以支援照片編輯模式。<br><br>
      <strong>額外加值：</strong><br>
      ① 系統步驟由 11 步擴充至 12 步（新增場地模擬功能）<br>
      ② 場地模擬支援 4 種風格 + 9 種快速標籤 + 未來可擴充更多佈置場景
    </div>
  </div>

  <div style="text-align: center; font-size: 12px; color: #cbd5e1; margin-top: 60px;">
    WDMC AI 賦能系統 · 2026 © 版權所有
  </div>
</div>

</body>
</html>`;

const outPath = path.join('d:\\WDMC\\erptw', 'WDMC_AI_功能回報書.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('✅ HTML 報告已生成:', outPath);
console.log('   檔案大小:', (fs.statSync(outPath).size / 1024 / 1024).toFixed(1), 'MB');
