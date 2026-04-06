/**
 * extract-text.js — 統一多格式文件文字提取
 * 支援 PDF, DOCX, DOC (97), XLSX, XLS, TXT
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 文件分類標籤
const CATEGORY_LABELS = {
  requirement: '需求說明書',
  contract: '契約文件',
  budget_sheet: '預算表/標價清單',
  evaluation: '評審須知',
  attachment: '附件',
  other: '其他文件',
};

/**
 * 從單一文件提取文字
 * @param {Object} doc - DB 文件記錄 { file_path, file_type, filename }
 * @returns {string} 提取的純文字
 */
async function extractTextFromFile(doc) {
  if (!fs.existsSync(doc.file_path)) {
    console.warn(`[Extract] 檔案不存在: ${doc.file_path}`);
    return '';
  }

  const ext = (doc.file_type || path.extname(doc.filename).replace('.', '')).toLowerCase();
  const buffer = fs.readFileSync(doc.file_path);

  try {
    switch (ext) {
      case 'pdf': {
        const data = await pdfParse(buffer);
        return data.text || '';
      }

      case 'docx': {
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      }

      case 'doc': {
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(doc.file_path);
        return extracted.getBody() || '';
      }

      case 'xlsx':
      case 'xls': {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let text = '';
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
          const readable = json.map(row =>
            row.map(cell => cell !== undefined && cell !== null ? String(cell).trim() : '').filter(Boolean).join(' | ')
          ).filter(line => line.trim()).join('\n');

          text += `\n[工作表: ${sheetName}]\n${readable}\n`;
        }
        return text;
      }

      case 'txt': {
        return buffer.toString('utf8');
      }

      default:
        console.warn(`[Extract] 不支援的格式: ${ext} (${doc.filename})`);
        return '';
    }
  } catch (e) {
    console.warn(`[Extract] 解析失敗 [${ext}]: ${doc.filename}`, e.message);
    return '';
  }
}

/**
 * 提取專案所有文件的完整文字（帶分類標籤）
 * @param {string} projectId
 * @param {Object} db - 資料庫實例
 * @param {Object} options - { maxChars, withLabels }
 * @returns {{ allText: string, docStats: Object }}
 */
async function extractAllProjectText(projectId, db, options = {}) {
  const { maxChars = Infinity, withLabels = true } = options;

  const docs = db.find('documents', d => d.project_id === projectId);
  const analyzableDocs = docs.filter(d =>
    ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt'].includes((d.file_type || '').toLowerCase())
  );

  const textReqs = db.find('text_requirements', t => t.project_id === projectId);

  let allText = '';
  const docStats = { pdf: 0, docx: 0, doc: 0, xlsx: 0, xls: 0, txt: 0, text: 0 };

  for (const doc of analyzableDocs) {
    const text = await extractTextFromFile(doc);
    if (text.trim()) {
      if (withLabels) {
        const label = CATEGORY_LABELS[doc.category] || CATEGORY_LABELS.other;
        allText += `\n\n=== [${label}] ${doc.filename} ===\n${text}`;
      } else {
        allText += `\n\n--- ${doc.filename} ---\n${text}`;
      }
      const ext = (doc.file_type || '').toLowerCase();
      if (docStats[ext] !== undefined) docStats[ext]++;
    }
  }

  if (textReqs.length > 0) {
    allText += '\n\n=== [客戶需求紀錄] ===\n' + textReqs.map(t => t.content).join('\n---\n');
    docStats.text = textReqs.length;
  }

  // 截取上限
  if (maxChars < Infinity && allText.length > maxChars) {
    allText = allText.substring(0, maxChars);
  }

  return { allText: allText.trim(), docStats };
}

module.exports = { extractTextFromFile, extractAllProjectText, CATEGORY_LABELS };
