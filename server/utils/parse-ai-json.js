/**
 * 從 AI 回應中穩健地提取 JSON
 * 處理各種 AI 引擎(Gemini, Groq, Ollama)回傳格式差異
 * 
 * v2: 新增 JSON 修復、欄位驗證功能
 */

/**
 * 修復常見 AI JSON 錯誤
 * - trailing commas
 * - unescaped newlines in strings
 * - truncated arrays/objects
 */
function repairAiJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return rawText;
  
  let text = rawText.trim();
  
  // 移除 trailing commas（物件和陣列中最後一個元素後的逗號）
  text = text.replace(/,\s*([}\]])/g, '$1');
  
  // 修復未關閉的字串（行末的 \n 在 JSON 字串中）
  // 不做過於激進的修復，只處理最常見情況
  
  // 修復被截斷的 JSON — 嘗試關閉未完成的括號
  const openBraces = (text.match(/{/g) || []).length;
  const closeBraces = (text.match(/}/g) || []).length;
  const openBrackets = (text.match(/\[/g) || []).length;
  const closeBrackets = (text.match(/]/g) || []).length;
  
  // 如果有未關閉的括號，嘗試修復
  if (openBraces > closeBraces || openBrackets > closeBrackets) {
    // 先去除末尾不完整的元素（如半截的字串）
    // 找到最後一個完整的 key-value pair 或 array element
    const lastCompleteComma = text.lastIndexOf(',');
    const lastCompleteBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    
    if (lastCompleteComma > lastCompleteBrace && lastCompleteComma > text.length * 0.5) {
      // 截斷到最後一個逗號，然後關閉括號
      text = text.substring(0, lastCompleteComma);
    }
    
    // 關閉缺少的括號
    for (let i = 0; i < openBrackets - closeBrackets; i++) text += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) text += '}';
  }
  
  return text;
}

function parseAiJson(rawText, fallback = null) {
  if (!rawText || typeof rawText !== 'string') return fallback;

  let text = rawText.trim();

  // 1. 移除 think tags
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // 2. 嘗試多種 markdown code block 格式
  // 格式: ```json\n...\n``` 或 ```\n...\n```
  const codeBlockPatterns = [
    /```json\s*\n?([\s\S]*?)```/,
    /```JSON\s*\n?([\s\S]*?)```/,
    /```\s*\n?([\s\S]*?)```/,
  ];

  for (const pattern of codeBlockPatterns) {
    const match = text.match(pattern);
    if (match) {
      const extracted = match[1].trim();
      // 先嘗試直接解析
      try {
        return JSON.parse(extracted);
      } catch {}
      // 嘗試修復後解析
      try {
        return JSON.parse(repairAiJson(extracted));
      } catch {}
      // 嘗試提取 [ ] 或 { }
      const result = extractJsonBrackets(extracted);
      if (result !== null) return result;
    }
  }

  // 3. 直接嘗試解析整段
  try {
    return JSON.parse(text);
  } catch {}

  // 3.5 修復後再嘗試
  try {
    return JSON.parse(repairAiJson(text));
  } catch {}

  // 4. 嘗試從文本中提取 JSON 括號
  const result = extractJsonBrackets(text);
  if (result !== null) return result;

  // 4.5 修復後再從文本提取
  const repairedResult = extractJsonBrackets(repairAiJson(text));
  if (repairedResult !== null) return repairedResult;

  // 5. 全部失敗，回傳 fallback
  console.warn('[parseAiJson] All parsing attempts failed for:', text.substring(0, 200));
  return fallback;
}

function extractJsonBrackets(text) {
  // 嘗試找 array
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(text.substring(arrStart, arrEnd + 1));
    } catch {}
    // 修復後再試
    try {
      return JSON.parse(repairAiJson(text.substring(arrStart, arrEnd + 1)));
    } catch {}
  }

  // 嘗試找 object
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(text.substring(objStart, objEnd + 1));
    } catch {}
    try {
      return JSON.parse(repairAiJson(text.substring(objStart, objEnd + 1)));
    } catch {}
  }

  return null;
}

/**
 * 驗證 AI 回傳的 JSON 是否包含所有必要欄位
 * @param {Object|Array} parsed - 已解析的 JSON
 * @param {string[]} requiredFields - 必要欄位名稱列表
 * @param {Object} defaults - 各欄位的預設值，缺少時自動補上
 * @returns {{ valid: boolean, data: Object, missing: string[] }}
 */
function validateAiJson(parsed, requiredFields = [], defaults = {}) {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, data: defaults, missing: requiredFields };
  }

  // 如果是陣列，驗證每個元素
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { valid: false, data: parsed, missing: ['(empty array)'] };
    }
    // 驗證陣列中每個元素是否包含必要欄位
    const validatedItems = parsed.map(item => {
      if (typeof item !== 'object' || item === null) return item;
      const missing = requiredFields.filter(f => item[f] === undefined || item[f] === null || item[f] === '');
      if (missing.length > 0) {
        // 補上預設值
        const filled = { ...item };
        missing.forEach(f => {
          if (defaults[f] !== undefined) filled[f] = defaults[f];
        });
        return filled;
      }
      return item;
    });
    return { valid: true, data: validatedItems, missing: [] };
  }

  // 物件驗證
  const missing = requiredFields.filter(f => parsed[f] === undefined || parsed[f] === null || parsed[f] === '');
  
  if (missing.length > 0) {
    const filled = { ...parsed };
    missing.forEach(f => {
      if (defaults[f] !== undefined) filled[f] = defaults[f];
    });
    console.warn(`[validateAiJson] 補上缺失欄位: ${missing.join(', ')}`);
    return { valid: false, data: filled, missing };
  }

  return { valid: true, data: parsed, missing: [] };
}

module.exports = { parseAiJson, validateAiJson, repairAiJson };
