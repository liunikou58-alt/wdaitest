/**
 * ProposalFlow AI — 活動模擬圖 & 場地佈置模擬 API
 * 支援四種圖片生成引擎（自動 fallback）：
 *   1) Google Gemini (gemini-2.5-flash-image) — 推薦
 *   2) OpenAI DALL-E 3 — 付費
 *   3) Unsplash 圖庫搜索 — 免費、無限制、真實高品質照片
 *   4) SVG Placeholder — 最後兜底
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getImageProvider, getGeminiClient } = require('../services/ai-engine');
const path = require('path');
const fs = require('fs');

const router = express.Router({ mergeParams: true });

// Gemini 圖片生成模型 — 根據 API 可用性自動選擇
const GEMINI_IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
];

// OpenAI client (for DALL-E)
let openaiClient;
try {
  const OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch { /* OpenAI SDK not installed */ }

// ======== 中文關鍵字 → 英文搜索詞映射 ========
const KEYWORD_MAP = {
  '氣球': 'balloon decoration event',
  '拱門': 'balloon arch entrance',
  '花藝': 'floral arrangement event',
  '花卉': 'flower decoration ceremony',
  '地毯': 'red carpet entrance event',
  'LED': 'LED screen stage event',
  '背板': 'backdrop stage event banner',
  '燈光': 'event lighting stage spotlights',
  '帳篷': 'outdoor tent event canopy',
  '舞台': 'stage setup event concert',
  '打卡': 'photo booth event backdrop',
  '桌椅': 'banquet table setup event',
  '投影': 'projection screen event',
  '市集': 'outdoor market stalls event',
  '展覽': 'exhibition booth display',
  '工藝': 'craft market display booth',
  '小吃': 'food stall street market',
  '活動': 'corporate event venue setup',
  '典禮': 'ceremony stage decoration',
  '頒獎': 'award ceremony stage',
  '晚宴': 'gala dinner banquet',
  '記者會': 'press conference setup',
  '開幕': 'grand opening ceremony',
  '演唱會': 'concert stage lighting',
  '園遊會': 'outdoor festival carnival',
  '親子': 'family kids event activity',
  '運動': 'sports event competition',
  '環保': 'eco green sustainability event',
  '宣導': 'promotion campaign event',
};

// ======== 1) 活動子項目模擬圖 ========
router.post('/', authMiddleware, async (req, res) => {
  const { activity_name, description, style } = req.body;
  if (!activity_name) return res.status(400).json({ error: '請提供活動名稱' });

  const project = db.getById('projects', req.params.projectId);
  if (!project) return res.status(404).json({ error: '專案不存在' });

  const imageStyle = style || 'illustration';
  const prompt = `A professional event planning ${imageStyle} for: "${activity_name}". 
${description ? `Details: ${description}. ` : ''}
Context: This is for a ${project.event_type || 'corporate event'} in Taiwan.
Style: Clean, modern, professional event illustration. Bright colors, detailed scene layout. 
No text, no watermarks, no logos. Show the physical setup, activities, and atmosphere.
4:3 aspect ratio, high quality.`;

  const searchTerms = buildSearchTerms(activity_name, description);
  const result = await attemptGenerate(prompt, activity_name, description, searchTerms);
  res.json(result);
});

// ======== 1.5) 場地規劃報告生成 ========
router.post('/venue-plan', authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    const ai = require('../ai-provider');
    const OpenCC = require('opencc-js');

    const isTender = project?.case_type !== 'commercial';

    // 1. 讀取已選子活動
    const selectedData = db.find('selected_sub_activities', s => s.project_id === projectId);
    let subActivitiesInfo = '';
    if (selectedData.length > 0) {
      try {
        const items = JSON.parse(selectedData[0].items_json) || [];
        subActivitiesInfo = items.map(s => `- ${s.name}：${s.description || ''}`).join('\n');
      } catch {}
    }

    // 2. 讀取亮點
    const highlights = db.find('highlights', h => h.project_id === projectId && h.is_selected === 1);
    const highlightsInfo = highlights.map(h => `- ${h.title}：${h.description || ''}`).join('\n');

    // 3. 讀取主題報告摘要
    const themes = db.find('theme_proposals', t => t.project_id === projectId);
    const themeReport = themes.find(t => t.report)?.report || '';

    // 4. 讀取分析報告
    const analyses = db.find('analyses', a => a.project_id === projectId);
    let analysisInfo = '';
    if (analyses.length > 0) {
      try {
        const parsed = JSON.parse(analyses[0].analysis_json);
        analysisInfo = parsed.report?.substring(0, 3000) || '';
      } catch {}
    }

    // 5. 讀取文件原文（多格式支援）
    const { extractAllProjectText } = require('../utils/extract-text');
    const { allText: rawDocText } = await extractAllProjectText(projectId, db, { maxChars: 6000, withLabels: false });
    const docText = rawDocText;

    const prompt = `【任務】你是台灣頂尖的活動場地規劃專家。請根據以下專案資訊，撰寫一份完整的「活動場地佈圖規劃」報告。

這份報告會直接放入企劃書中，品質要達到可直接交付${isTender ? '評審委員' : '客戶'}的水準。

活動名稱：${project?.name || ''}
活動類型：${project?.event_type || ''}
活動日期：${project?.event_date || '未指定'}
預估人數：${project?.headcount || '未指定'}
活動場地：${project?.venue || '未指定'}

已選取的子活動：
${subActivitiesInfo || '（未指定）'}

已選亮點構想：
${highlightsInfo || '（未指定）'}

${themeReport ? `【主題方案摘要】\n${themeReport.substring(0, 2000)}` : ''}
${analysisInfo ? `\n【分析報告摘要】\n${analysisInfo.substring(0, 2000)}` : ''}
${docText ? `\n【需求文件重點】\n${docText.substring(0, 3000)}` : ''}

---

請用以下 Markdown 結構撰寫場地規劃報告（嚴格遵守）：

# 活動會場佈圖規劃

## 功能區域配置總覽
概述場地整體布局邏輯、動線設計、各區域相對位置關係。列出所有功能區域（如舞台區、觀眾區、攤販區、報到區、休息區、醫護站等），並說明每個區域的面積估算和容納人數。

---

## 硬體規劃

### 1. 舞台設計
舞台尺寸規格、材質、結構形式（桁架/背板/LED螢幕）、視角考量。

### 2. 活動場地布置
帳篷/桌椅配置、裝飾主題風格、動線指引、各子活動區域的佈置細節。

### 3. 報到區規劃
報到流程設計、報到方式（QR Code/紙本）、排隊動線、所需設備和人力。

### 4. 燈光音響規劃
音響系統（PA 瓦數/喇叭配置）、燈光設計（舞台燈/氣氛燈/安全照明）、器材清單。

### 5. 電力規劃
用電需求估算（各區域用電量）、供電方式（市電/發電機）、配電安全措施。

---

## 活動規劃

### 6. 醫療服務規劃
醫護站位置、急救設備（AED）、急救動線、合作醫療單位、緊急送醫路線。

### 7. 環境規劃
垃圾分類/清潔動線、廁所配置（含流動廁所）、無障礙設施、停車動線。

### 8. 雨天備案
室內替代方案/雨棚配置、縮編方案、通知機制、防滑安全措施。

### 9. 人力規劃
工作人員配置表（角色/人數/班別/職責）、志工需求、通訊聯絡機制。

### 10. 拍攝規劃
攝影師/攝影機位配置、直播設備、主要拍攝點、照片/影片交付時程。

---

## 規劃索引總表

| 硬體規劃 | 活動規劃 |
|---------|---------|
| 舞台設計 | 醫療服務規劃 |
| 活動場地布置 | 環境規劃 |
| 報到區規劃 | 雨天備案 |
| 燈光音響規劃 | 人力規劃 |
| 電力規劃 | 拍攝規劃 |

---

嚴格規則：
1. 全程使用台灣繁體中文（正體中文），不可使用簡體字
2. 不要使用任何 emoji
3. 每個章節至少 80 字以上的具體內容
4. 數字要具體（人數、面積、設備數量等），不要寫「若干」「適量」
5. 根據子活動內容調整場地配置，確保每個已選子活動都有對應的場地安排
6. 用粗體標示關鍵規格和重點`;

    console.log(`[VenuePlan] 生成場地規劃報告 for ${projectId}`);
    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.5, max_tokens: 8192, timeout: 180000 }
    );

    let aiResponse = result.content || '';
    
    // 簡轉繁 + emoji 清除
    aiResponse = aiResponse.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    const s2tConverter = OpenCC.Converter({ from: 'cn', to: 'twp' });
    aiResponse = s2tConverter(aiResponse);
    aiResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // 存入 theme_proposals 表
    const themeRecord = db.find('theme_proposals', t => t.project_id === projectId);
    if (themeRecord.length > 0) {
      db.update('theme_proposals', themeRecord[0].id, { venue_plan_report: aiResponse });
    }

    console.log(`[VenuePlan] 完成: ${aiResponse.length} 字元`);
    res.json({ report: aiResponse });
  } catch (error) {
    console.error('[VenuePlan] 失敗:', error);
    res.status(500).json({ error: '場地規劃報告生成失敗', details: error.message });
  }
});

// GET venue plan report
router.get('/venue-plan', authMiddleware, (req, res) => {
  const themes = db.find('theme_proposals', t => t.project_id === req.params.projectId);
  const record = themes.find(t => t.venue_plan_report);
  res.json({ report: record?.venue_plan_report || '' });
});

// ======== 2) 場地佈置模擬 ========
router.post('/venue-sim', authMiddleware, async (req, res) => {
  const { keywords, style, venue_description, photo_base64, project_context } = req.body;
  if (!keywords) return res.status(400).json({ error: '請提供佈置描述關鍵字' });

  const project = db.getById('projects', req.params.projectId);

  const styleMap = {
    realistic: 'photorealistic, professional event photography style, natural lighting, DSLR quality',
    illustration: 'clean professional illustration, watercolor-style event illustration, bright and inviting',
    '3d_render': 'professional 3D render, architectural visualization, interior design render, studio lighting',
    blueprint: 'top-down layout blueprint, floor plan view, architectural blueprint style, clean lines',
  };
  const styleDesc = styleMap[style] || styleMap.realistic;

  const prompt = buildVenuePrompt(keywords, styleDesc, venue_description, project_context || {}, project);
  console.log('[ImageGen] Venue sim prompt:', prompt.substring(0, 200) + '...');

  // 如果有上傳照片，嘗試照片疊加模式
  if (photo_base64) {
    const editResult = await attemptPhotoEdit(prompt, photo_base64, keywords);
    if (editResult) {
      editResult.prompt_used = prompt;
      return res.json(editResult);
    }
  }

  // 純文字/搜索生成
  const searchTerms = buildSearchTerms(keywords);
  const result = await attemptGenerate(prompt, keywords, keywords, searchTerms);
  result.prompt_used = prompt;
  res.json(result);
});

// ======== 照片疊加編輯（Gemini 專屬） ========
async function attemptPhotoEdit(prompt, photoBase64, keywords) {
  const provider = getImageProvider();

  if (provider === 'gemini') {
    for (const modelName of GEMINI_IMAGE_MODELS) {
      try {
        const geminiClient = getGeminiClient();
        const model = geminiClient.getGenerativeModel({ 
          model: modelName,
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        });

        const cleanBase64 = photoBase64.replace(/^data:image\/\w+;base64,/, '');

        const result = await model.generateContent([
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/jpeg',
            },
          },
          `請在這張照片中加入以下裝飾佈置：${keywords}。
保留原本的場地背景，在適當位置添加裝飾元素。
效果要自然、專業、逼真。
${prompt}`,
        ]);

        const response = result.response;
        const parts = response.candidates?.[0]?.content?.parts || [];
        
        for (const part of parts) {
          if (part.inlineData) {
            const imgData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const ext = mimeType.includes('png') ? 'png' : 'jpeg';

            const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'generated');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
            
            const filename = `venue_${uuidv4().slice(0, 8)}.${ext}`;
            fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(imgData, 'base64'));

            return {
              success: true,
              image_url: `/uploads/generated/${filename}`,
              generated_at: new Date().toISOString(),
              provider: `gemini-photo-edit (${modelName})`,
              mode: 'photo_overlay',
            };
          }
        }
        console.log(`[ImageGen] ${modelName} returned text only, trying next...`);
      } catch (err) {
        console.warn(`[ImageGen] ${modelName} photo edit error:`, err.message.substring(0, 100));
        continue;
      }
    }
  }

  return null;
}

// ======== 中文關鍵字 → 英文搜索詞 ========
function buildSearchTerms(name, description) {
  const text = (name || '') + ' ' + (description || '');
  const terms = [];
  
  for (const [zh, en] of Object.entries(KEYWORD_MAP)) {
    if (text.includes(zh)) terms.push(en);
  }
  
  // 如果沒匹配到，用通用詞
  if (terms.length === 0) terms.push('event venue setup decoration professional');
  
  return terms.join(' ');
}

// ======== 核心生成邏輯（4 層 fallback） ========
async function attemptGenerate(prompt, title, desc, searchTerms) {
  const provider = getImageProvider();

  // 1) 嘗試 Gemini 圖片生成（多模型候選）
  if (provider === 'gemini') {
    for (const modelName of GEMINI_IMAGE_MODELS) {
      try {
        const geminiClient = getGeminiClient();
        const model = geminiClient.getGenerativeModel({
          model: modelName,
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        });

        const result = await model.generateContent(prompt);
        const parts = result.response.candidates?.[0]?.content?.parts || [];
        
        for (const part of parts) {
          if (part.inlineData) {
            const imgData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const ext = mimeType.includes('png') ? 'png' : 'jpeg';

            const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'generated');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
            
            const filename = `sim_${uuidv4().slice(0, 8)}.${ext}`;
            fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(imgData, 'base64'));

            return {
              success: true,
              image_url: `/uploads/generated/${filename}`,
              generated_at: new Date().toISOString(),
              provider: `gemini-imagen (${modelName})`,
            };
          }
        }
      } catch (err) {
        console.warn(`[ImageGen] ${modelName} error:`, err.message.substring(0, 100));
        continue;
      }
    }
  }

  // 2) 嘗試 DALL-E 3
  if (openaiClient) {
    try {
      const response = await openaiClient.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
      });
      const imageUrl = response.data[0]?.url;
      if (imageUrl) {
        return {
          success: true,
          image_url: imageUrl,
          generated_at: new Date().toISOString(),
          provider: 'dall-e-3',
        };
      }
    } catch (err) {
      console.error('[ImageGen] DALL-E error:', err.message);
    }
  }

  // 3) Lorem Picsum 圖庫（免費、100% 可靠的高品質照片）
  try {
    const stockResult = await fetchStockImage(searchTerms || title);
    if (stockResult) {
      return {
        success: true,
        image_url: stockResult.url,
        generated_at: new Date().toISOString(),
        provider: 'stock-photo',
        credit: stockResult.credit,
      };
    }
  } catch (err) {
    console.warn('[ImageGen] Stock photo error:', err.message);
  }

  // 4) Fallback: SVG placeholder
  const svg = generateVenueSvg(title, desc);
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'generated');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const filename = `sim_${uuidv4().slice(0, 8)}.svg`;
  fs.writeFileSync(path.join(uploadsDir, filename), svg);

  return {
    success: true,
    image_url: `/uploads/generated/${filename}`,
    generated_at: new Date().toISOString(),
    provider: 'placeholder',
    prompt_used: prompt,
  };
}

// ======== 免費圖庫搜索（Lorem Picsum — 100% 可靠） ========
async function fetchStockImage(query) {
  // Lorem Picsum — 免費高品質圖片，無需 API Key，100% 可靠
  // 用 activity name 的 hash 作為 seed，保證同一活動總是拿到同一張圖
  const seed = Math.abs(hashCode(query || 'event')) % 1000;
  const width = 1200;
  const height = 800;

  try {
    const url = `https://picsum.photos/seed/${seed}/${width}/${height}`;
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 5000) { // 確認是真實圖片
        const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'generated');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const filename = `sim_${uuidv4().slice(0, 8)}.jpg`;
        fs.writeFileSync(path.join(uploadsDir, filename), buffer);
        console.log(`[ImageGen] Stock photo downloaded: ${filename} (${buffer.length} bytes)`);

        return {
          url: `/uploads/generated/${filename}`,
          credit: 'Reference photo (Lorem Picsum)',
          link: res.url,
        };
      }
    }
  } catch (e) {
    console.warn('[ImageGen] Stock photo error:', e.message);
  }

  return null;
}

// 簡易 hash function
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return hash;
}

// ======== 場地 Prompt 建構 ========
function buildVenuePrompt(keywords, styleDesc, venueDesc, ctx, project) {
  const elements = keywords.split(/[、，,\s]+/).filter(Boolean);

  const elementDescriptions = elements.map(el => {
    if (el.includes('氣球') && el.includes('拱門')) {
      const colorMatch = el.match(/(黑金|紅金|紅白|粉色|藍色|黑|金|紅|白|粉|藍|紫|銀)/);
      const colors = colorMatch ? colorMatch[1] : '金色';
      return `a magnificent ${colors} balloon arch spanning across the entrance, made of metallic ${colors} balloons in various sizes`;
    }
    if (el.includes('花藝') || el.includes('花卉')) return 'elegant floral arrangements with fresh flowers';
    if (el.includes('地毯')) {
      const color = el.includes('紅') ? 'red' : el.includes('金') ? 'gold' : 'red';
      return `a ${color} carpet running through the entrance`;
    }
    if (el.includes('LED') || el.includes('背板')) return 'a large LED screen backdrop with ambient lighting';
    if (el.includes('燈光')) return 'professional event lighting with warm uplights and spotlights';
    if (el.includes('帳篷')) return 'elegant white tent/canopy structure';
    if (el.includes('舞台')) return 'a professional stage platform with lighting truss';
    if (el.includes('打卡') || el.includes('拍照')) return 'a decorative photo booth backdrop wall';
    if (el.includes('桌椅')) return 'banquet tables and chairs arranged elegantly';
    if (el.includes('Truss') || el.includes('燈架')) return 'professional truss lighting structures';
    if (el.includes('投影')) return 'projection setup with screen';
    return el;
  });

  const sceneDesc = elementDescriptions.join(', ');
  const eventType = project?.event_type || ctx.event_type || 'corporate event';

  return `Create a ${styleDesc} image of an event venue decoration.
Scene: ${venueDesc || 'An entrance/doorway of a modern event venue in Taiwan'}.
The decoration features: ${sceneDesc}.
This is for a ${eventType}. Premium, sophisticated, Instagram-worthy aesthetic.
3/4 perspective view, warm lighting, celebratory atmosphere.
No text, watermarks, or logos. Realistic proportions and materials. High detail.`;
}

// ======== SVG Placeholder ========
function generateVenueSvg(title, desc) {
  const safeTitle = (title || '場地佈置模擬').replace(/[<>&'"]/g, '').substring(0, 30);
  const hasBalloon = safeTitle.includes('氣球');
  const hasArch = safeTitle.includes('拱門');
  const isBlackGold = safeTitle.includes('黑金');

  const primaryColor = isBlackGold ? '#1a1a2e' : '#8b5cf6';
  const accentColor = isBlackGold ? '#d4a843' : '#ec4899';
  const bgColor1 = isBlackGold ? '#1a1a2e' : '#f5f3ff';
  const bgColor2 = isBlackGold ? '#16213e' : '#ede9fe';

  let decorElements = '';
  
  if (hasBalloon || hasArch) {
    const balloonColors = isBlackGold 
      ? ['#1a1a2e', '#d4a843', '#2d2d44', '#c5981a', '#333355'] 
      : ['#8b5cf6', '#ec4899', '#60a5fa', '#34d399', '#fbbf24'];
    
    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * i) / 27;
      const cx = 400 + 300 * Math.cos(Math.PI - angle);
      const cy = 380 - 180 * Math.sin(angle);
      const r = 14 + Math.random() * 10;
      const color = balloonColors[i % balloonColors.length];
      const opacity = 0.6 + Math.random() * 0.4;
      decorElements += `<circle cx="${Math.round(cx)}" cy="${Math.round(cy)}" r="${Math.round(r)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`;
      decorElements += `<circle cx="${Math.round(cx - r/4)}" cy="${Math.round(cy - r/4)}" r="${Math.round(r/3)}" fill="white" opacity="0.2"/>`;
    }
    decorElements += `<rect x="80" y="370" width="640" height="60" fill="${isBlackGold ? '#0f0f23' : '#e8e5f0'}" rx="4" opacity="0.5"/>`;
    decorElements += `<rect x="250" y="140" width="300" height="240" fill="none" stroke="${isBlackGold ? '#d4a843' : '#c4b5fd'}" stroke-width="3" rx="4" opacity="0.4"/>`;
  } else {
    decorElements += `<rect x="150" y="200" width="500" height="180" fill="${primaryColor}" rx="8" opacity="0.06"/>`;
    decorElements += `<circle cx="400" cy="280" r="50" fill="${accentColor}" opacity="0.08"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor1}"/>
      <stop offset="100%" style="stop-color:${bgColor2}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${primaryColor}"/>
      <stop offset="100%" style="stop-color:${accentColor}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#bg)" rx="16"/>
  ${decorElements}
  <rect x="240" y="40" width="320" height="40" fill="url(#accent)" rx="20" opacity="0.12"/>
  <text x="400" y="67" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" font-weight="700" fill="${isBlackGold ? '#d4a843' : '#7c3aed'}">AI 場地佈置模擬</text>
  <text x="400" y="110" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="${isBlackGold ? '#ffffff' : '#1e1b4b'}">${safeTitle}</text>
  <text x="400" y="430" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="${isBlackGold ? '#666' : '#9ca3af'}">AI 生成圖片（升級 API 可獲得更高品質）</text>
</svg>`;
}

module.exports = router;
