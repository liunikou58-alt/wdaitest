/**
 * AI 引擎管理器 — Gemini 2.5 Flash 多用戶版
 * 
 * 每位用戶擁有獨立的 Gemini API Key
 * 6 組 Key 互不干擾，徹底避免限流問題
 * 503 時指數退避重試（最多 5 次）
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ---- 多用戶 API Key 配置 ----
const GEMINI_KEYS = [];
for (let i = 1; i <= 10; i++) {
  const key = process.env[`GEMINI_KEY_${i}`];
  if (key) GEMINI_KEYS.push({ index: i, key });
}

// 全域 fallback key
const GLOBAL_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (GLOBAL_KEY) {
  console.log('[AI] ✅ 全域 Gemini API Key 已設定');
}

if (GEMINI_KEYS.length > 0) {
  console.log(`[AI] ✅ ${GEMINI_KEYS.length} 組用戶專屬 Gemini Key 已載入`);
} else if (GLOBAL_KEY) {
  console.log('[AI] ⚠️  僅有全域 Key，所有用戶共用（建議設定 GEMINI_KEY_1 ~ GEMINI_KEY_6）');
}

if (!GLOBAL_KEY && GEMINI_KEYS.length === 0) {
  console.error('[AI] ❌ 無任何 Gemini API Key！請在 .env 設定');
}

// ---- 模型快取（避免每次重建 client）----
const clientCache = new Map();  // cacheKey → { client, model }

const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';  // 2.5 限流時降級到 2.0
const FALLBACK_AFTER_RETRIES = 3;  // 重試 3 次後自動降級

function getGeminiClient(apiKey, modelName = PRIMARY_MODEL) {
  const cacheKey = `${apiKey}:${modelName}`;
  if (clientCache.has(cacheKey)) return clientCache.get(cacheKey);
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: modelName });
  const entry = { client, model, modelName };
  clientCache.set(cacheKey, entry);
  return entry;
}

/**
 * 根據 keyIndex 或 userId 取得對應的 API Key
 * 優先順序：
 *   1. keyIndex（從 JWT 直接取得，1:1 對應）
 *   2. userId hash（fallback）
 *   3. 全域 Key
 */
function resolveApiKey(keyIndex, userId) {
  if (GEMINI_KEYS.length === 0) {
    return { key: GLOBAL_KEY, label: 'global' };
  }

  // 優先使用 keyIndex（直接對應，最精確）
  if (keyIndex) {
    const entry = GEMINI_KEYS.find(k => k.index === keyIndex);
    if (entry) return { key: entry.key, label: `key-${entry.index}` };
  }

  // Fallback: userId hash
  if (userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % GEMINI_KEYS.length;
    return { key: GEMINI_KEYS[idx].key, label: `key-${GEMINI_KEYS[idx].index}` };
  }

  // 匿名 → 全域 Key
  return { key: GLOBAL_KEY || GEMINI_KEYS[0].key, label: 'global' };
}

// 模型配置
const MODELS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini 2.5 Flash',
    model: 'gemini-2.5-flash',
    layer: 1,
    speed: '極快',
    cost: '付費版',
    quality: '⭐⭐⭐⭐⭐',
    description: 'Gemini 2.5 Flash — 唯一指定模型，每用戶獨立 Key',
    available: !!(GLOBAL_KEY || GEMINI_KEYS.length > 0),
    capabilities: ['text', 'image_gen', 'image_edit'],
  },
};

// 使用量追蹤（per key）
const usage = {};
function getUsage(label) {
  if (!usage[label]) usage[label] = { calls: 0, tokens: 0, errors: 0, retries: 0 };
  return usage[label];
}

// ---- Per-Key 請求排隊（避免同一 Key 同時發多請求觸發 503）----
const keyQueues = new Map();  // keyLabel → Promise chain
const COOLDOWN_MS = 1500;     // 每次請求間隔 1.5 秒

function enqueue(keyLabel, fn) {
  const prev = keyQueues.get(keyLabel) || Promise.resolve();
  const next = prev.then(() => fn()).catch(e => { throw e; }).finally(() => {
    // 完成後加冷卻間隔
    return new Promise(r => setTimeout(r, COOLDOWN_MS));
  });
  keyQueues.set(keyLabel, next.catch(() => {}));  // 不讓隊列因錯誤斷鏈
  return next;
}

/**
 * 呼叫 AI — 自動排隊 + 重試
 * 外層：排隊（同 Key 不並行）
 * 內層：503 指數退避重試
 */
async function callAI(prompt, options = {}) {
  const { key: apiKey, label: keyLabel } = resolveApiKey(options.keyIndex, options.userId);
  if (!apiKey) {
    throw new Error('Gemini 未設定！請在 .env 設定 GOOGLE_API_KEY 或 GEMINI_KEY_1~6');
  }

  // 如果是重試中，不再排隊（已經在隊列裡了）
  if (options._retryAttempt) {
    return _callAI_inner(prompt, options, apiKey, keyLabel);
  }

  // 首次呼叫：排入該 Key 的隊列
  return enqueue(keyLabel, () => _callAI_inner(prompt, options, apiKey, keyLabel));
}

/**
 * 內部 AI 呼叫（含重試邏輯）
 */
async function _callAI_inner(prompt, options, apiKey, keyLabel) {
  const _retryAttempt = options._retryAttempt || 0;
  const MAX_RETRIES = 8;  // 放慢速率後可以多試幾次

  // 超過 FALLBACK_AFTER_RETRIES 次重試後自動降級到 2.0-flash
  const useModel = (_retryAttempt >= FALLBACK_AFTER_RETRIES && FALLBACK_MODEL !== PRIMARY_MODEL)
    ? FALLBACK_MODEL : PRIMARY_MODEL;
  const { model: geminiModel, modelName } = getGeminiClient(apiKey, useModel);
  if (_retryAttempt === FALLBACK_AFTER_RETRIES && useModel === FALLBACK_MODEL) {
    console.log(`[AI:${keyLabel}] 🔄 降級模型: ${PRIMARY_MODEL} → ${FALLBACK_MODEL}`);
  }
  const temperature = options.temperature || 0.3;
  const maxTokens = options.maxTokens || 8192;
  const stats = getUsage(keyLabel);

  try {
    const fullPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n${prompt}`
      : prompt;

    const timeoutMs = options.timeout || 180000;  // 3 分鐘

    // === 改用直接 REST API 呼叫（繞過 SDK 的網路層）===
    const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${apiKey}`;
    const restBody = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let fetchResp;
    try {
      fetchResp = await fetch(restUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: restBody,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!fetchResp.ok) {
      const errText = await fetchResp.text();
      console.error(`[AI:${keyLabel}] REST API error ${fetchResp.status}: ${errText.substring(0, 300)}`);
      const err = new Error(`Gemini API ${fetchResp.status}: ${errText.substring(0, 200)}`);
      err.status = fetchResp.status;
      throw err;
    }

    const resJson = await fetchResp.json();
    const candidate = resJson.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || '';
    const finishReason = candidate?.finishReason || 'unknown';

    const result = {
      content: text,
      model: 'gemini',
      modelName: useModel,
      tokens: text.length,
      finishReason,
      keyLabel,
    };

    // 截斷警告
    if (finishReason === 'MAX_TOKENS' || finishReason === 'SAFETY') {
      console.warn(`[AI:${keyLabel}] ⚠️ 回應被截斷! finishReason=${finishReason}, maxTokens=${maxTokens}`);
    }

    // 截斷自動重試
    const isTruncated = finishReason === 'MAX_TOKENS';
    if (isTruncated && _retryAttempt < 1) {
      const newMaxTokens = Math.min(maxTokens * 2, 131072);
      console.log(`[AI:${keyLabel}] 🔄 截斷重試: maxTokens ${maxTokens} → ${newMaxTokens}`);
      return _callAI_inner(prompt, { ...options, maxTokens: newMaxTokens, _retryAttempt: _retryAttempt + 1 }, apiKey, keyLabel);
    }

    // 空回應偵測
    if (!text || text.trim().length < 50) {
      console.warn(`[AI:${keyLabel}] ⚠️ 回應過短! 長度=${(text || '').length}`);
    }

    stats.calls++;
    stats.tokens += result.tokens;
    if (_retryAttempt > 0) {
      console.log(`[AI:${keyLabel}] ✅ OK — ${result.tokens} tokens (經過 ${_retryAttempt} 次重試)`);
    } else {
      console.log(`[AI:${keyLabel}] ✅ OK — ${result.tokens} tokens`);
    }
    return result;

  } catch (err) {
    stats.errors++;

    // 503 / 429 → 指數退避重試（放慢速率，一定要生成出來）
    const errMsg = err.message || '';
    const errStatus = err.status || 0;
    const isRetryable = errMsg.includes('429')
      || errMsg.includes('RESOURCE_EXHAUSTED')
      || errMsg.includes('rate')
      || errMsg.includes('503')
      || errMsg.includes('Service Unavailable')
      || errMsg.includes('high demand')
      || errMsg.includes('overloaded')
      || errMsg.includes('AbortError')
      || errMsg.includes('abort')
      || errStatus === 429
      || errStatus === 503
      || errStatus === 500;

    if (isRetryable && _retryAttempt < MAX_RETRIES) {
      stats.retries++;
      // 退避間隔：5s → 10s → 15s → 20s → 25s → 30s → 30s → 30s
      const waitSec = Math.min(5 + _retryAttempt * 5, 30);
      console.log(`[AI:${keyLabel}] ⏳ 重試 ${_retryAttempt + 1}/${MAX_RETRIES}，等待 ${waitSec} 秒... (${errMsg.substring(0, 100)})`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      return _callAI_inner(prompt, { ...options, _retryAttempt: _retryAttempt + 1 }, apiKey, keyLabel);
    }

    if (isRetryable) {
      console.error(`[AI:${keyLabel}] ❌ 重試 ${MAX_RETRIES} 次仍失敗`);
      throw new Error(`Gemini 暫時不可用（${keyLabel}，已等待超過 2 分鐘）。Google 伺服器繁忙，請稍後再試。`);
    }
    
    console.error(`[AI:${keyLabel}] ❌ Error:`, err.message);
    throw err;
  }
}

/**
 * 智慧路由
 */
function autoRoute(taskType) {
  if (GLOBAL_KEY || GEMINI_KEYS.length > 0) return 'gemini';
  return null;
}

/**
 * 取得可用模型列表
 */
function getAvailableModels() {
  return Object.values(MODELS).map(m => ({
    ...m,
    keyCount: GEMINI_KEYS.length || (GLOBAL_KEY ? 1 : 0),
  }));
}

/**
 * 取得使用量統計
 */
function getUsageStats() {
  const allStats = Object.entries(usage).map(([label, u]) => ({ label, ...u }));
  const totalCalls = allStats.reduce((s, u) => s + u.calls, 0);
  const totalTokens = allStats.reduce((s, u) => s + u.tokens, 0);
  const totalErrors = allStats.reduce((s, u) => s + u.errors, 0);
  const totalRetries = allStats.reduce((s, u) => s + u.retries, 0);

  return {
    models: allStats,
    totalCalls, totalTokens, totalErrors, totalRetries,
    keyCount: GEMINI_KEYS.length || (GLOBAL_KEY ? 1 : 0),
    activeProvider: 'Google Gemini 2.5 Flash',
  };
}

/**
 * 多輪對話 — 每用戶獨立 Key
 */
async function chat(systemPrompt, userMessage, history = [], userId = null, keyIndex = null) {
  const { key: apiKey, label: keyLabel } = resolveApiKey(keyIndex, userId);
  if (!apiKey) throw new Error('Gemini 未設定');

  // 排入該 Key 的隊列（避免並行觸發 503）
  return enqueue(keyLabel, () => _chat_inner(systemPrompt, userMessage, history, apiKey, keyLabel));
}

async function _chat_inner(systemPrompt, userMessage, history, apiKey, keyLabel) {
  const MAX_RETRIES = 8;
  const stats = getUsage(keyLabel);
  const { model: geminiModel } = getGeminiClient(apiKey, PRIMARY_MODEL);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const chatHistory = history.slice(-20).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      }));

      const chatSession = geminiModel.startChat({
        history: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\n請確認你已理解以上指令。' }] },
          { role: 'model', parts: [{ text: '已理解，我會按照指示回覆。' }] },
          ...chatHistory,
        ],
        generationConfig: { temperature: 0.5, maxOutputTokens: 1500 },
      });

      const res = await chatSession.sendMessage(userMessage);
      const text = res.response.text();
      stats.calls++;
      stats.tokens += text.length;
      console.log(`[AI:chat:${keyLabel}] ✅ OK${attempt > 0 ? ` (重試 ${attempt} 次)` : ''}`);
      return text;

    } catch (err) {
      const isRetryable = err.message?.includes('503') || err.message?.includes('429') || err.message?.includes('high demand') || err.message?.includes('RESOURCE_EXHAUSTED');
      if (isRetryable && attempt < MAX_RETRIES) {
        stats.retries++;
        const waitSec = Math.min(5 + attempt * 5, 30);
        console.log(`[AI:chat:${keyLabel}] ⏳ 重試 ${attempt + 1}/${MAX_RETRIES}，等待 ${waitSec} 秒...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      stats.errors++;
      console.error(`[AI:chat:${keyLabel}] ❌ Error:`, err.message);
      throw err;
    }
  }
}

/**
 * 取得圖片生成能力
 */
function getImageProvider() {
  if (GLOBAL_KEY || GEMINI_KEYS.length > 0) return 'gemini';
  return null;
}

/**
 * 取得 Gemini client（指定用戶）
 */
function getGeminiClientForUser(userId) {
  const { key } = resolveApiKey(userId);
  if (!key) return null;
  return getGeminiClient(key).client;
}

// 向後相容
function getGeminiClient_legacy() {
  const key = GLOBAL_KEY || (GEMINI_KEYS.length > 0 ? GEMINI_KEYS[0].key : null);
  if (!key) return null;
  return getGeminiClient(key).client;
}

module.exports = {
  callAI,
  chat,
  autoRoute,
  getAvailableModels,
  getUsageStats,
  getImageProvider,
  getGeminiClient: getGeminiClient_legacy,
  getGeminiClientForUser,
  MODELS,
};
