/**
 * Ragic 全量資料匯出
 * 自動掃描所有頁籤/表單，匯出全部紀錄（含子表格），存成 JSON
 *
 * 執行: node ragic-export.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const APIKEY = 'VFZmSGlvWFVWUWl6cGRBVGh6eGkrWFJFcFhiWW5iU2Z4U2dtenEySUpCMkN0NGIxdjFZTENHQmZxQ0JXWkxZeA==';
const HOST = 'ap8.ragic.com';
const ACCOUNT = 'wdmc888';
const OUTPUT_DIR = path.join(__dirname, 'wddata', 'ragic-export');
const DELAY_MS = 600; // 每個請求間延遲，避免 rate limit

// ─── API 呼叫 ───
function ragicGet(apiPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: HOST,
      path: apiPath,
      headers: { 'Authorization': 'Basic ' + APIKEY },
    };
    https.get(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── 安全的檔名 ───
function safeName(name) {
  return (name || 'unnamed').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 80);
}

// ─── 取得所有表單結構 ───
async function getAccountStructure() {
  console.log('📡 讀取 Ragic 帳戶結構...');
  const { data } = await ragicGet(`/${ACCOUNT}/report/display?id=2&api`);
  const sheets = [];

  for (const [accKey, acc] of Object.entries(data)) {
    if (!acc.children) continue;
    for (const [tabId, tab] of Object.entries(acc.children)) {
      const tabName = safeName(tab.name || tabId);
      if (!tab.children) continue;
      for (const [sheetId, sheet] of Object.entries(tab.children)) {
        const sheetName = safeName(sheet.name || sheetId);
        const type = sheet.type || 'sheet';
        if (type === 'report') continue; // 跳過報表
        // tabId 已含前導 /，直接拼接即可
        const cleanTab = tabId.startsWith('/') ? tabId : `/${tabId}`;
        sheets.push({
          account: accKey,
          tabId, tabName,
          sheetId, sheetName,
          type,
          apiPath: `/${accKey}${cleanTab}/${sheetId}`,
        });
      }
    }
  }

  return sheets;
}

// ─── 匯出單張表單全部資料 ───
async function exportSheet(sheet) {
  const allRecords = [];
  let offset = 0;
  const limit = 1000;
  let page = 0;

  while (true) {
    page++;
    const url = `${sheet.apiPath}?api&v=3&limit=${limit}&offset=${offset}&subtables=1`;
    const { status, data } = await ragicGet(url);

    if (status !== 200 || typeof data !== 'object') {
      if (page === 1) return { records: [], error: `HTTP ${status}` };
      break;
    }

    // Ragic API 回傳 { "ragicId1": {...}, "ragicId2": {...} }
    const entries = Object.entries(data);

    // 過濾掉帳戶層級的回傳（有 server / appDisplayName 的不是紀錄）
    const records = entries
      .filter(([k, v]) => typeof v === 'object' && !v.server && !v.appDisplayName)
      .map(([ragicId, fields]) => ({ _ragicId: ragicId, ...fields }));

    if (records.length === 0) break;
    allRecords.push(...records);

    if (records.length < limit) break; // 最後一頁
    offset += limit;
    await sleep(DELAY_MS);
  }

  return { records: allRecords, error: null };
}

// ─── 主程式 ───
async function main() {
  const startTime = Date.now();

  // 確保輸出目錄
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. 取得結構
  const sheets = await getAccountStructure();
  console.log(`✅ 找到 ${sheets.length} 張表單\n`);

  // 存結構索引
  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_index.json'),
    JSON.stringify(sheets, null, 2),
    'utf8'
  );

  // 2. 逐張匯出
  const summary = [];
  let totalRecords = 0;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const progress = `[${i + 1}/${sheets.length}]`;

    // 建立目錄
    const tabDir = path.join(OUTPUT_DIR, safeName(s.tabName));
    if (!fs.existsSync(tabDir)) fs.mkdirSync(tabDir, { recursive: true });

    // 匯出
    process.stdout.write(`${progress} ${s.tabName} / ${s.sheetName} ... `);
    const { records, error } = await exportSheet(s);

    if (error) {
      console.log(`❌ ${error}`);
      summary.push({ ...s, status: 'error', error, count: 0 });
      errorCount++;
    } else {
      console.log(`✅ ${records.length} 筆`);

      // 提取欄位名稱
      const fieldNames = records.length > 0
        ? [...new Set(records.flatMap(r => Object.keys(r)))]
            .filter(k => !k.startsWith('_'))
        : [];

      // 存 JSON
      const output = {
        sheet_name: s.sheetName,
        sheet_path: s.apiPath,
        tab_name: s.tabName,
        exported_at: new Date().toISOString(),
        total_records: records.length,
        fields: fieldNames,
        records,
      };

      const filePath = path.join(tabDir, `${safeName(s.sheetName)}.json`);
      fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf8');

      summary.push({ ...s, status: 'ok', count: records.length, file: filePath });
      totalRecords += records.length;
      successCount++;
    }

    await sleep(DELAY_MS);
  }

  // 3. 存匯出總結
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const summaryReport = {
    exported_at: new Date().toISOString(),
    elapsed_seconds: elapsed,
    total_sheets: sheets.length,
    success: successCount,
    errors: errorCount,
    total_records: totalRecords,
    sheets: summary.map(s => ({
      tab: s.tabName,
      sheet: s.sheetName,
      path: s.apiPath,
      status: s.status,
      records: s.count,
      error: s.error || undefined,
    })),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_summary.json'),
    JSON.stringify(summaryReport, null, 2),
    'utf8'
  );

  // 印出總結
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Ragic 全量匯出完成！');
  console.log('═'.repeat(60));
  console.log(`⏱️  耗時: ${elapsed} 秒`);
  console.log(`📄 表單: ${successCount} 成功 / ${errorCount} 失敗`);
  console.log(`📦 總紀錄: ${totalRecords.toLocaleString()} 筆`);
  console.log(`📁 輸出: ${OUTPUT_DIR}`);
  console.log('═'.repeat(60));

  // 印出各表單統計
  console.log('\n📋 各表單紀錄數：');
  let currentTab = '';
  for (const s of summary) {
    if (s.tabName !== currentTab) {
      currentTab = s.tabName;
      console.log(`\n  📁 ${currentTab}`);
    }
    const icon = s.status === 'ok' ? '✅' : '❌';
    console.log(`    ${icon} ${s.sheetName}: ${s.count} 筆`);
  }
}

main().catch(e => {
  console.error('\n💥 匯出失敗:', e.message);
  process.exit(1);
});
