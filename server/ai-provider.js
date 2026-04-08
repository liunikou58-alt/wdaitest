/**
 * AI Provider — 相容性轉接層
 * 
 * 所有呼叫自動轉發到 ai-engine.js（Gemini 2.5 Flash 專用）
 * 支援 per-user API Key：
 *   1. 從 options.keyIndex 取得（顯式傳入）
 *   2. 從 AsyncLocalStorage 取得（由 index.js 中介層注入）
 */
const { callAI, autoRoute } = require('./services/ai-engine');
const { AsyncLocalStorage } = require('async_hooks');

// 全域 request context
const requestContext = new AsyncLocalStorage();

function runWithContext(ctx, fn) {
  return requestContext.run(ctx, fn);
}

/**
 * 統一呼叫介面（相容舊 API）
 */
async function chat(messages, options = {}) {
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsg = messages.find(m => m.role === 'user');
  
  if (!userMsg) throw new Error('No user message provided');

  const modelChannel = options.model || autoRoute(options.taskType || 'chat');
  const maxTokens = options.max_tokens || 8192;
  
  // keyIndex: options > AsyncLocalStorage
  const store = requestContext.getStore() || {};
  const keyIndex = options.keyIndex || store.keyIndex || null;
  const userId = options.userId || store.userId || null;
  
  const result = await callAI(userMsg.content, {
    model: modelChannel,
    systemPrompt: systemMsg?.content || '',
    temperature: options.temperature ?? 0.3,
    maxTokens,
    userId,
    keyIndex,
  });

  if (result.finishReason === 'MAX_TOKENS' || result.finishReason === 'length') {
    console.warn(`[AI-Provider] ⚠️ 回應被截斷! maxTokens=${maxTokens}, finishReason=${result.finishReason}`);
  }

  return {
    content: result.content,
    provider: result.model,
    model: result.model,
    usage: { total_tokens: result.tokens || 0 },
    finishReason: result.finishReason,
    truncated: result.finishReason === 'MAX_TOKENS' || result.finishReason === 'length',
  };
}

module.exports = { chat, runWithContext };
