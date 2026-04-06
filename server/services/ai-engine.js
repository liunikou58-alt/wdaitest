/**
 * AI 引擎管理器 — 三供應商架構
 * Provider 1: Google Gemini (推薦 — 文字+圖片+照片編輯，免費額度大)
 * Provider 2: Groq (Llama 4 Scout — 免費，速度極快)
 * Provider 3: OpenAI (GPT-4o — 付費，品質最高)
 * 
 * 系統自動偵測可用的 API Key，客戶填哪個就用哪個
 */

// ---- Provider 初始化 ----

// Google Gemini
let geminiModel, geminiClient;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    geminiClient = new GoogleGenerativeAI(apiKey);
    geminiModel = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('[AI] ✅ Google Gemini 已啟用');
  }
} catch { /* @google/generative-ai not installed */ }

// Groq
let Groq, groqClient;
try {
  Groq = require('groq-sdk');
  if (process.env.GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log('[AI] ✅ Groq 已啟用');
  }
} catch { /* Groq SDK not installed */ }

// OpenAI
let openaiClient;
try {
  const OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('[AI] ✅ OpenAI 已啟用');
  }
} catch { /* OpenAI SDK not installed */ }

// 模型配置
const MODELS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini 2.0 Flash',
    model: 'gemini-2.0-flash',
    layer: 1,
    speed: '極快',
    cost: '免費額度大',
    quality: '⭐⭐⭐⭐',
    description: '中文最佳，文字+圖片+照片編輯全支援',
    available: !!geminiModel,
    capabilities: ['text', 'image_gen', 'image_edit'],
  },
  groq: {
    id: 'groq',
    name: 'Groq Llama 4 Scout',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    layer: 1,
    speed: '極快',
    cost: '免費',
    quality: '⭐⭐⭐',
    description: '日常分析、快速問答',
    available: !!groqClient,
    capabilities: ['text'],
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    model: 'gpt-4o-mini',
    layer: 2,
    speed: '快',
    cost: '低 (~$0.15/100K)',
    quality: '⭐⭐⭐⭐',
    description: '深度分析、趨勢報告',
    available: !!openaiClient,
    capabilities: ['text'],
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    model: 'gpt-4o',
    layer: 3,
    speed: '中',
    cost: '中 (~$2.50/100K)',
    quality: '⭐⭐⭐⭐⭐',
    description: '企劃書生成、專業提案',
    available: !!openaiClient,
    capabilities: ['text'],
  },
};

// 使用量追蹤
const usage = {
  gemini: { calls: 0, tokens: 0, errors: 0 },
  groq: { calls: 0, tokens: 0, errors: 0 },
  'gpt-4o-mini': { calls: 0, tokens: 0, errors: 0 },
  'gpt-4o': { calls: 0, tokens: 0, errors: 0 },
};

/**
 * 呼叫 AI — 自動選擇可用的 provider
 * 新增：截斷自動重試、空回應偵測、品質評估
 */
async function callAI(prompt, options = {}) {
  const channel = options.model || autoRoute(options.taskType || 'chat');
  if (!channel) throw new Error('沒有可用的 AI 模型，請在 .env 設定 GOOGLE_API_KEY、GROQ_API_KEY 或 OPENAI_API_KEY');

  const config = MODELS[channel];
  if (!config) throw new Error(`Unknown model: ${channel}`);

  const temperature = options.temperature || 0.3;
  const maxTokens = options.maxTokens || 8192;
  const _retryAttempt = options._retryAttempt || 0;  // 內部重試計數

  try {
    let result;

    if (channel === 'gemini') {
      if (!geminiModel) throw new Error('Gemini not configured (set GOOGLE_API_KEY)');
      const fullPrompt = options.systemPrompt
        ? `${options.systemPrompt}\n\n${prompt}`
        : prompt;

      const res = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      });

      const text = res.response.text();
      const candidate = res.response.candidates?.[0];
      const finishReason = candidate?.finishReason || 'unknown';
      
      result = {
        content: text,
        model: channel,
        tokens: text.length, // Gemini doesn't always return token count
        finishReason,
      };
      
      // 截斷警告
      if (finishReason === 'MAX_TOKENS' || finishReason === 'SAFETY') {
        console.warn(`[AI:${channel}] ⚠️ 回應被截斷! finishReason=${finishReason}, maxTokens=${maxTokens}`);
      }

    } else if (channel === 'groq') {
      if (!groqClient) throw new Error('Groq not configured (set GROQ_API_KEY)');
      const messages = [];
      if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const res = await groqClient.chat.completions.create({
        model: config.model, messages, temperature, max_tokens: maxTokens,
      });
      const finishReason = res.choices[0]?.finish_reason || 'unknown';
      result = {
        content: res.choices[0]?.message?.content || '',
        model: channel,
        tokens: (res.usage?.total_tokens) || 0,
        finishReason,
      };
      
      if (finishReason === 'length') {
        console.warn(`[AI:${channel}] ⚠️ 回應被截斷! finishReason=length, maxTokens=${maxTokens}`);
      }

    } else {
      // OpenAI (gpt-4o-mini or gpt-4o)
      if (!openaiClient) throw new Error('OpenAI not configured (set OPENAI_API_KEY)');
      const messages = [];
      if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const res = await openaiClient.chat.completions.create({
        model: config.model, messages, temperature, max_tokens: maxTokens,
      });
      const finishReason = res.choices[0]?.finish_reason || 'unknown';
      result = {
        content: res.choices[0]?.message?.content || '',
        model: channel,
        tokens: (res.usage?.total_tokens) || 0,
        finishReason,
      };
      
      if (finishReason === 'length') {
        console.warn(`[AI:${channel}] ⚠️ 回應被截斷! finishReason=length, maxTokens=${maxTokens}`);
      }
    }

    // === 回應品質檢測 ===
    const isTruncated = result.finishReason === 'MAX_TOKENS' || result.finishReason === 'length';
    const isEmpty = !result.content || result.content.trim().length < 50;

    // 空回應偵測
    if (isEmpty) {
      console.warn(`[AI:${channel}] ⚠️ 回應過短或空白! 長度=${(result.content || '').length}`);
    }

    // 截斷自動重試（最多重試 1 次，加倍 maxTokens）
    if (isTruncated && _retryAttempt < 1) {
      const newMaxTokens = Math.min(maxTokens * 2, 131072);  // 上限 128K
      console.log(`[AI:${channel}] 🔄 截斷重試: maxTokens ${maxTokens} → ${newMaxTokens}`);
      return callAI(prompt, {
        ...options,
        maxTokens: newMaxTokens,
        _retryAttempt: _retryAttempt + 1,
      });
    }

    usage[channel].calls++;
    usage[channel].tokens += result.tokens;
    console.log(`[AI:${channel}] OK — ${result.tokens} tokens, finishReason=${result.finishReason}`);
    return result;

  } catch (err) {
    usage[channel].errors++;
    console.error(`[AI:${channel}] Error:`, err.message);

    // Gemini rate limit → 等待後重試一次（不直接降級到較弱模型）
    const isRateLimit = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('rate');
    if (channel === 'gemini' && isRateLimit && _retryAttempt < 1) {
      const waitSec = 30;
      console.log(`[AI:gemini] ⏳ Rate limit hit, waiting ${waitSec}s before retry...`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      return callAI(prompt, { ...options, model: 'gemini', _retryAttempt: 1 });
    }

    // 自動降級（修正：降級時限制 maxTokens 和 prompt 長度不超過目標模型上限）
    if (channel === 'gemini') {
      const truncatedPrompt = prompt.length > 28000 ? prompt.substring(0, 28000) + '\n\n...(文件過長已截斷)...' : prompt;
      const fallbackOpts = { ...options, maxTokens: Math.min(maxTokens, 8192) };
      if (groqClient) return callAI(truncatedPrompt, { ...fallbackOpts, model: 'groq' });
      if (openaiClient) return callAI(prompt, { ...options, model: 'gpt-4o-mini' });
    }
    if (channel === 'gpt-4o' && openaiClient) {
      return callAI(prompt, { ...options, model: 'gpt-4o-mini' });
    }
    if (channel === 'gpt-4o-mini') {
      const truncatedPrompt = prompt.length > 28000 ? prompt.substring(0, 28000) + '\n\n...(文件過長已截斷)...' : prompt;
      const fallbackOpts = { ...options, maxTokens: Math.min(maxTokens, 8192) };
      if (groqClient) return callAI(truncatedPrompt, { ...fallbackOpts, model: 'groq' });
      if (geminiModel) return callAI(prompt, { ...options, model: 'gemini' });
    }
    if (channel === 'groq') {
      if (geminiModel) return callAI(prompt, { ...options, model: 'gemini' });
      if (openaiClient) return callAI(prompt, { ...options, model: 'gpt-4o-mini' });
    }

    throw err;
  }
}

/**
 * 智慧路由 — 優先順序：Gemini > Groq > OpenAI
 */
function autoRoute(taskType) {
  // Gemini 優先（中文最好 + 免費額度大）
  if (geminiModel) return 'gemini';
  if (groqClient) return 'groq';
  if (openaiClient) return 'gpt-4o-mini';
  return null;
}

/**
 * 取得可用模型列表
 */
function getAvailableModels() {
  return Object.values(MODELS).map(m => ({
    ...m,
    usage: usage[m.id],
  }));
}

/**
 * 取得使用量統計
 */
function getUsageStats() {
  const totalCalls = Object.values(usage).reduce((s, u) => s + u.calls, 0);
  const totalTokens = Object.values(usage).reduce((s, u) => s + u.tokens, 0);
  const totalErrors = Object.values(usage).reduce((s, u) => s + u.errors, 0);

  return {
    models: Object.entries(usage).map(([id, u]) => ({
      id, name: MODELS[id]?.name, ...u,
    })),
    totalCalls, totalTokens, totalErrors,
    activeProvider: geminiModel ? 'Google Gemini' : groqClient ? 'Groq' : openaiClient ? 'OpenAI' : '無',
  };
}

/**
 * 多輪對話
 */
async function chat(systemPrompt, userMessage, history = []) {
  const channel = autoRoute('chat');
  if (!channel) throw new Error('沒有可用的 AI 模型');

  try {
    if (channel === 'gemini') {
      // Gemini 多輪對話
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
      usage.gemini.calls++;
      usage.gemini.tokens += text.length;
      console.log(`[AI:chat:gemini] OK`);
      return text;

    } else if (channel === 'groq') {
      const messages = [{ role: 'system', content: systemPrompt }];
      history.slice(-20).forEach(h => messages.push({ role: h.role, content: h.content }));
      messages.push({ role: 'user', content: userMessage });

      const res = await groqClient.chat.completions.create({
        model: MODELS.groq.model, messages, temperature: 0.5, max_tokens: 1500,
      });
      const text = res.choices[0]?.message?.content || '';
      usage.groq.calls++;
      usage.groq.tokens += (res.usage?.total_tokens) || 0;
      console.log(`[AI:chat:groq] OK`);
      return text;

    } else {
      const config = MODELS[channel];
      const messages = [{ role: 'system', content: systemPrompt }];
      history.slice(-20).forEach(h => messages.push({ role: h.role, content: h.content }));
      messages.push({ role: 'user', content: userMessage });

      const res = await openaiClient.chat.completions.create({
        model: config.model, messages, temperature: 0.5, max_tokens: 1500,
      });
      const text = res.choices[0]?.message?.content || '';
      usage[channel].calls++;
      usage[channel].tokens += (res.usage?.total_tokens) || 0;
      console.log(`[AI:chat:${channel}] OK`);
      return text;
    }
  } catch (err) {
    console.error(`[AI:chat:${channel}] Error:`, err.message);
    throw err;
  }
}

/**
 * 取得圖片生成能力
 */
function getImageProvider() {
  if (geminiModel) return 'gemini';
  if (openaiClient) return 'openai';
  return null;
}

/**
 * 取得 Gemini client（給 image-gen 用）
 */
function getGeminiClient() {
  return geminiClient;
}

module.exports = {
  callAI,
  chat,
  autoRoute,
  getAvailableModels,
  getUsageStats,
  getImageProvider,
  getGeminiClient,
  MODELS,
};
