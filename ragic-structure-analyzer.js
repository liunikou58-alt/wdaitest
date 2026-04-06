/**
 * Ragic 結構分析器
 * 從匯出的 JSON 反向工程出完整 ERP 結構藍圖
 */
const fs = require('fs');
const path = require('path');

const EXPORT_DIR = path.join(__dirname, 'wddata', 'ragic-export');

function analyzeField(fieldName, values) {
  // 從實際資料推斷欄位類型
  const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return { type: 'text', samples: [] };

  const samples = [...new Set(nonEmpty.slice(0, 5))].map(v => String(v).slice(0, 80));

  // 檢測類型
  if (fieldName.includes('日期') || fieldName.includes('時間')) return { type: 'date', samples };
  if (fieldName.includes('金額') || fieldName.includes('小計') || fieldName.includes('總計') ||
      fieldName.includes('稅金') || fieldName.includes('單價') || fieldName.includes('費用')) return { type: 'currency', samples };
  if (fieldName.includes('數量') || fieldName.includes('筆數') || fieldName.includes('天數')) return { type: 'number', samples };
  if (fieldName.includes('照片') || fieldName.includes('圖片') || fieldName.includes('存摺')) return { type: 'image', samples };
  if (fieldName.includes('檔案') || fieldName.includes('附件')) return { type: 'file', samples };
  if (fieldName.includes('簽名') || fieldName.includes('簽核')) return { type: 'signature', samples };
  if (fieldName.includes('email') || fieldName.includes('E-mail')) return { type: 'email', samples };
  if (fieldName.includes('電話') || fieldName.includes('手機')) return { type: 'phone', samples };
  if (fieldName.includes('地址')) return { type: 'address', samples };
  if (fieldName.includes('編號') && fieldName !== '編號') return { type: 'auto_number', samples };
  if (fieldName.includes('UUID') || fieldName.includes('KEY')) return { type: 'key', samples };
  if (fieldName.includes('備註') || fieldName.includes('說明') || fieldName.includes('介紹')) return { type: 'textarea', samples };

  // Yes/No → checkbox
  if (nonEmpty.every(v => ['Yes', 'No', ''].includes(String(v)))) return { type: 'checkbox', samples };

  // 有限選項 → select
  const uniqueValues = [...new Set(nonEmpty.map(String))];
  if (uniqueValues.length <= 10 && uniqueValues.length < nonEmpty.length * 0.3) {
    return { type: 'select', options: uniqueValues, samples };
  }

  // 純數字 → number
  if (nonEmpty.every(v => !isNaN(Number(v)) && String(v).trim() !== '')) return { type: 'number', samples };

  // base64 → signature/image
  if (nonEmpty.some(v => String(v).startsWith('data:image'))) return { type: 'signature_base64', samples: ['(base64 data)'] };

  return { type: 'text', samples };
}

function analyzeSheet(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = raw.records || [];
  if (records.length === 0) return null;

  // 收集所有欄位及其值
  const fieldValues = {};
  records.forEach(r => {
    Object.entries(r).forEach(([key, val]) => {
      if (key.startsWith('_')) return; // 跳過內部欄位
      if (!fieldValues[key]) fieldValues[key] = [];
      fieldValues[key].push(val);
    });
  });

  // 分析每個欄位
  const fields = {};
  Object.entries(fieldValues).forEach(([name, values]) => {
    fields[name] = analyzeField(name, values);
    fields[name].non_empty_count = values.filter(v => v !== '' && v != null).length;
    fields[name].total_records = records.length;
  });

  return {
    sheet_name: raw.sheet_name,
    sheet_path: raw.sheet_path,
    tab_name: raw.tab_name,
    total_records: records.length,
    field_count: Object.keys(fields).length,
    fields,
  };
}

// 偵測表間關聯
function detectRelationships(allSheets) {
  const relationships = [];

  // 1. 名稱中有「└」的是子表，找對應的父表
  const sheetsByTab = {};
  allSheets.forEach(s => {
    if (!sheetsByTab[s.tab_name]) sheetsByTab[s.tab_name] = [];
    sheetsByTab[s.tab_name].push(s);
  });

  Object.entries(sheetsByTab).forEach(([tab, sheets]) => {
    let lastParent = null;
    sheets.forEach(s => {
      if (s.sheet_name.startsWith('└')) {
        if (lastParent) {
          relationships.push({
            type: 'subtable',
            parent: lastParent.sheet_name,
            child: s.sheet_name,
            tab,
          });
        }
      } else if (!s.sheet_name.startsWith('➖')) {
        lastParent = s;
      }
    });
  });

  // 2. 共同欄位關聯（跨表連結）
  const fieldToSheets = {};
  allSheets.forEach(s => {
    if (!s.fields) return;
    Object.keys(s.fields).forEach(f => {
      // 跳過通用欄位
      if (['建立人', '建立日期', '更新人', '更新日期', '權限群組', 'RAGIC_ID'].includes(f)) return;
      if (!fieldToSheets[f]) fieldToSheets[f] = [];
      fieldToSheets[f].push(s.sheet_name);
    });
  });

  // 找出跨表共用的關鍵欄位
  Object.entries(fieldToSheets).forEach(([field, sheets]) => {
    if (sheets.length >= 2 && sheets.length <= 5) {
      if (field.includes('編號') || field.includes('名稱') || field.includes('ID') || field.includes('KEY')) {
        relationships.push({
          type: 'link',
          field,
          sheets: sheets.slice(0, 5),
        });
      }
    }
  });

  return relationships;
}

async function main() {
  const allSheets = [];
  const output = [];

  // 遍歷所有目錄
  const dirs = fs.readdirSync(EXPORT_DIR).filter(d =>
    fs.statSync(path.join(EXPORT_DIR, d)).isDirectory()
  );

  output.push('# Ragic ERP 完整結構藍圖\n');
  output.push(`> 自動從 ${EXPORT_DIR} 的匯出資料反向工程\n`);
  output.push(`> 分析時間: ${new Date().toISOString()}\n`);

  for (const dir of dirs.sort()) {
    const dirPath = path.join(EXPORT_DIR, dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

    if (files.length === 0) continue;

    output.push(`\n---\n## 📁 ${dir}\n`);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const analysis = analyzeSheet(filePath);

      if (!analysis) {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        output.push(`### ${raw.sheet_name || file}`);
        output.push(`> 空表（0 筆紀錄）\n`);
        continue;
      }

      allSheets.push(analysis);

      output.push(`### ${analysis.sheet_name}`);
      output.push(`- 路徑: \`${analysis.sheet_path}\``);
      output.push(`- 紀錄: **${analysis.total_records}** 筆`);
      output.push(`- 欄位: **${analysis.field_count}** 個\n`);

      output.push('| 欄位名稱 | 類型 | 填充率 | 範例值 |');
      output.push('|----------|------|--------|--------|');

      Object.entries(analysis.fields).forEach(([name, info]) => {
        const fillRate = analysis.total_records > 0
          ? Math.round(info.non_empty_count / info.total_records * 100) + '%'
          : '0%';
        let typeStr = info.type;
        if (info.options) typeStr += ` [${info.options.join('/')}]`;
        const sample = (info.samples || []).slice(0, 2).join(', ').slice(0, 60);
        output.push(`| ${name} | ${typeStr} | ${fillRate} | ${sample} |`);
      });

      output.push('');
    }
  }

  // 關聯分析
  output.push('\n---\n## 🔗 表間關聯分析\n');

  const rels = detectRelationships(allSheets);

  // 子表格
  const subtables = rels.filter(r => r.type === 'subtable');
  if (subtables.length > 0) {
    output.push('### 父子表關係 (subtable)\n');
    output.push('| 頁籤 | 父表 | 子表 |');
    output.push('|------|------|------|');
    subtables.forEach(r => {
      output.push(`| ${r.tab} | ${r.parent} | ${r.child} |`);
    });
    output.push('');
  }

  // 連結欄位
  const links = rels.filter(r => r.type === 'link');
  if (links.length > 0) {
    output.push('### 跨表連結欄位\n');
    output.push('| 連結欄位 | 出現在表單 |');
    output.push('|----------|-----------|');
    links.forEach(r => {
      output.push(`| ${r.field} | ${r.sheets.join(', ')} |`);
    });
    output.push('');
  }

  // 統計摘要
  output.push('\n---\n## 📊 統計摘要\n');
  output.push(`| 指標 | 數值 |`);
  output.push(`|------|------|`);
  output.push(`| 總頁籤 | ${dirs.length} |`);
  output.push(`| 有資料的表單 | ${allSheets.length} |`);
  output.push(`| 總紀錄 | ${allSheets.reduce((s, sh) => s + sh.total_records, 0).toLocaleString()} |`);
  output.push(`| 總欄位 | ${allSheets.reduce((s, sh) => s + sh.field_count, 0)} |`);

  const result = output.join('\n');

  // 存為 Markdown
  const outPath = path.join(__dirname, 'wddata', 'ragic-export', '_structure_blueprint.md');
  fs.writeFileSync(outPath, result, 'utf8');
  console.log(`✅ 結構藍圖已存到: ${outPath}`);
  console.log(`   ${allSheets.length} 張表, ${allSheets.reduce((s, sh) => s + sh.field_count, 0)} 個欄位`);

  // 也存一份精簡的 JSON schema
  const schemaJson = allSheets.map(s => ({
    name: s.sheet_name,
    path: s.sheet_path,
    tab: s.tab_name,
    records: s.total_records,
    fields: Object.entries(s.fields).map(([name, info]) => ({
      name,
      type: info.type,
      options: info.options || undefined,
      fill_rate: Math.round(info.non_empty_count / s.total_records * 100),
    })),
  }));

  const schemaPath = path.join(__dirname, 'wddata', 'ragic-export', '_schema.json');
  fs.writeFileSync(schemaPath, JSON.stringify(schemaJson, null, 2), 'utf8');
  console.log(`✅ Schema JSON 已存到: ${schemaPath}`);
}

main().catch(e => console.error('ERROR:', e));
