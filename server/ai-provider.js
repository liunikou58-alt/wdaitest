/**
 * AI Provider — 相容性轉接層
 * 
 * 所有呼叫自動轉發到 ai-engine.js（優先使用 Gemini 1M context）
 * 保留 .chat(messages, options) 介面，讓所有既有路由無需修改即可使用新引擎
 */
const { callAI, autoRoute } = require('./services/ai-engine');

/**
 * 統一呼叫介面（相容舊 API）
 * @param {Array} messages - [{role: 'user', content: '...'}]
 * @param {Object} options - { temperature, max_tokens, model, timeout }
 * @returns {Object} { content, provider, model }
 */
async function chat(messages, options = {}) {
  // 從 messages 陣列中提取 system 和 user 訊息
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsg = messages.find(m => m.role === 'user');
  
  if (!userMsg) {
    throw new Error('No user message provided');
  }

  const modelChannel = options.model || autoRoute(options.taskType || 'chat');
  
  // 正確透傳 caller 的 max_tokens（修正：之前硬編碼 8192 導致大量截斷）
  const maxTokens = options.max_tokens || 8192;
  
  const result = await callAI(userMsg.content, {
    model: modelChannel,
    systemPrompt: systemMsg?.content || '',
    temperature: options.temperature ?? 0.3,
    maxTokens,
  });

  // 回應品質警告
  if (result.finishReason === 'MAX_TOKENS' || result.finishReason === 'length') {
    console.warn(`[AI-Provider] ⚠️ 回應被截斷! 請求 maxTokens=${maxTokens}, finishReason=${result.finishReason}`);
  }

  // 回傳相容格式
  return {
    content: result.content,
    provider: result.model,  // 相容舊介面 (provider 欄位)
    model: result.model,
    usage: { total_tokens: result.tokens || 0 },
    finishReason: result.finishReason,
    truncated: result.finishReason === 'MAX_TOKENS' || result.finishReason === 'length',
  };
}

module.exports = { chat };
