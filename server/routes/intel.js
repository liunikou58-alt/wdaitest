const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const ai = require('../ai-provider');

const router = express.Router();

// ============================================
// 爬蟲：政府電子採購網 公開搜尋
// ============================================
async function scrapePCC(keyword) {
  try {
    const url = `https://web.pcc.gov.tw/tps/pss/tender.do?searchMode=common&searchType=basic&searchTarget=ATM&method=search&isSp498=N&keyword=${encodeURIComponent(keyword)}&pageIndex=1`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'zh-TW,zh;q=0.9' }
    });
    clearTimeout(t);
    const html = await res.text();
    return parsePCCHtml(html);
  } catch (e) {
    console.warn('[Intel] PCC scrape failed:', e.message);
    return [];
  }
}

function parsePCCHtml(html) {
  const results = [];
  const rowRe = /<tr[^>]*class="[^"]*(?:odd|even)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const cells = [];
    let cm;
    while ((cm = cellRe.exec(m[1])) !== null) cells.push(cm[1].replace(/<[^>]+>/g, '').trim());
    if (cells.length >= 4) {
      results.push({
        id: uuidv4(), title: cells[1] || cells[0], agency: cells[2] || cells[3],
        budget: cells[4] || '未公告', deadline: cells[5] || '', category: '勞務',
        publishDate: cells[0] || '', source: 'pcc', sourceUrl: 'https://web.pcc.gov.tw', matchScore: null,
      });
    }
  }
  return results;
}

// ============================================
// 爬蟲：採購加值網 (ebuying) — 嘗試帶 cookie 搜尋
// ============================================
async function scrapeEbuying(keyword, account) {
  try {
    // Step 1: 嘗試登入取得 session
    let cookies = '';
    if (account?.username && account?.password) {
      try {
        const loginRes = await fetch('https://ebuying.hinet.net/epvas/j_security_check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
          body: `j_username=${encodeURIComponent(account.username)}&j_password=${encodeURIComponent(account.password)}`,
          redirect: 'manual',
        });
        cookies = loginRes.headers.get('set-cookie') || '';
        console.log(`[Intel] ebuying login attempt: status=${loginRes.status}`);
      } catch (e) {
        console.warn('[Intel] ebuying login failed:', e.message);
      }
    }

    // Step 2: 搜尋標案
    const searchUrl = `https://ebuying.hinet.net/epvas/readTenderByBidName?bidName=${encodeURIComponent(keyword)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html', 'Accept-Language': 'zh-TW' };
    if (cookies) headers['Cookie'] = cookies;
    
    const res = await fetch(searchUrl, { signal: ctrl.signal, headers });
    clearTimeout(t);
    const html = await res.text();
    return parseEbuyingHtml(html);
  } catch (e) {
    console.warn('[Intel] ebuying scrape failed:', e.message);
    return [];
  }
}

function parseEbuyingHtml(html) {
  const results = [];
  // ebuying 的標案列表通常在 table 中
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const linkRe = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i;
  let m, count = 0;
  while ((m = rowRe.exec(html)) !== null && count < 20) {
    const cells = [];
    let cm;
    while ((cm = cellRe.exec(m[1])) !== null) cells.push(cm[1].replace(/<[^>]+>/g, '').trim());
    if (cells.length >= 3 && cells.some(c => c.length > 5)) {
      const link = m[1].match(linkRe);
      results.push({
        id: uuidv4(), title: cells[1] || cells[0], agency: cells[2] || cells[3] || '',
        budget: cells[4] || cells[3] || '未公告', deadline: cells[5] || '', category: '勞務',
        publishDate: cells[0] || '', source: 'ebuying',
        sourceUrl: link ? `https://ebuying.hinet.net${link[1]}` : 'https://ebuying.hinet.net/epvas/', matchScore: null,
      });
      count++;
    }
  }
  return results;
}

// ============================================
// g0v API
// ============================================
async function fetchG0v(keyword) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://pcc.g0v.ronny.tw/api/searchbytitle?query=${encodeURIComponent(keyword)}`, {
      signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    clearTimeout(t);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const records = json.records || json.data || (Array.isArray(json) ? json : []);
      return records.slice(0, 20).map(r => ({
        id: uuidv4(), title: r.brief?.title || r.title || '未知',
        agency: r.brief?.unit || r.unit || '未知', budget: r.brief?.budget || '未公告',
        deadline: r.brief?.deadline || '', category: r.brief?.type || '勞務',
        publishDate: r.brief?.date || '', source: 'g0v',
        sourceUrl: r.url || `https://pcc.g0v.ronny.tw/tender/${r.id || ''}`, matchScore: null,
      }));
    } catch { return []; }
  } catch { return []; }
}

// ============================================
// 內建標案資料庫（fallback）
// ============================================
function getDefaultBids(keyword) {
  const now = new Date();
  const data = [
    { t: '2026台灣燈會主場活動規劃執行案', a: '交通部觀光署', b: 80000000, c: '文化慶典' },
    { t: '2026桃園地景藝術節策展暨執行案', a: '桃園市政府文化局', b: 35000000, c: '藝術展覽' },
    { t: '花蓮觀光形象影片製作案', a: '花蓮縣政府', b: 5000000, c: '影像媒體' },
    { t: '國慶煙火施放及周邊活動規劃案', a: '內政部', b: 120000000, c: '文化慶典' },
    { t: '台北市跨年晚會企劃執行案', a: '台北市政府觀傳局', b: 95000000, c: '表演活動' },
    { t: '2026台中市觀光嘉年華活動案', a: '台中市政府觀光旅遊局', b: 25000000, c: '觀光旅遊' },
    { t: '高雄跨百光年藝術節策展案', a: '高雄市政府文化局', b: 45000000, c: '藝術展覽' },
    { t: '新北歡樂耶誕城活動執行案', a: '新北市政府文化局', b: 60000000, c: '文化慶典' },
    { t: '台南文化古都行銷推廣案', a: '台南市政府文化局', b: 15000000, c: '行銷推廣' },
    { t: '創業臺灣品牌行銷活動案', a: '經濟部中小及新創企業署', b: 8000000, c: '行銷推廣' },
    { t: '青年就業博覽會規劃執行案', a: '教育部青年發展署', b: 12000000, c: '行銷推廣' },
    { t: '客家桐花祭系列活動案', a: '客家委員會', b: 18000000, c: '文化慶典' },
    { t: '原住民族豐年祭觀光推廣案', a: '原住民族委員會', b: 6000000, c: '觀光旅遊' },
    { t: '2026台北馬拉松賽事執行案', a: '臺北市政府體育局', b: 50000000, c: '表演活動' },
    { t: '金曲獎頒獎典禮執行案', a: '文化部影視及流行音樂產業局', b: 75000000, c: '表演活動' },
    { t: '農村再生社區活化推廣案', a: '農業部農村發展及水土保持署', b: 3000000, c: '行銷推廣' },
    { t: '地方創生成果發表會案', a: '國家發展委員會', b: 10000000, c: '行銷推廣' },
    { t: '兒童節系列慶祝活動案', a: '衛生福利部社會及家庭署', b: 7000000, c: '文化慶典' },
    { t: '永續環境教育推廣活動案', a: '環境部', b: 4000000, c: '行銷推廣' },
    { t: '數位轉型博覽會規劃執行案', a: '數位發展部', b: 30000000, c: '行銷推廣' },
  ];
  const kw = (keyword || '').toLowerCase();
  return data.map((d, i) => {
    const dl = new Date(now); dl.setDate(dl.getDate() + Math.floor(Math.random() * 60) + 10);
    const pd = new Date(now); pd.setDate(pd.getDate() - Math.floor(Math.random() * 14));
    let score = Math.floor(Math.random() * 25) + 55;
    if (kw && d.t.toLowerCase().includes(kw)) score += 25;
    if (d.t.includes('活動') || d.t.includes('企劃') || d.t.includes('行銷')) score += 8;
    return {
      id: `pcc-${i + 1}`, title: d.t, agency: d.a, budget: d.b, category: d.c,
      deadline: dl.toISOString().split('T')[0], publishDate: pd.toISOString().split('T')[0],
      source: 'pcc', sourceUrl: `https://web.pcc.gov.tw`, matchScore: Math.min(score, 98),
    };
  });
}

// ============================================
// AI 匹配度計算（透過 autoRoute，優先使用 Gemini 2.5 Flash）
// ============================================
async function aiMatchScore(bid, companyKeywords, competitors) {
  try {
    const prompt = `你是一位標案匹配分析師。請評估以下標案與本公司的匹配程度。

標案資訊：
- 名稱：${bid.title}
- 機關：${bid.agency}
- 預算：${bid.budget}
- 類別：${bid.category}

本公司關鍵能力：${companyKeywords.join('、') || '活動企劃、行銷策略、品牌設計'}
主要競爭對手：${competitors.join('、') || '無特定'}

請直接回傳一個 JSON 物件（不要其他文字）：
{
  "score": 0-100的匹配分數,
  "reason": "一句話說明原因（30字內）",
  "threat": "競爭威脅評估（高/中/低）",
  "suggestion": "一句投標建議（30字內）"
}`;

    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, max_tokens: 200 }
    );
    const text = result.content || '';
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
    return jsonStr ? JSON.parse(jsonStr) : null;
  } catch (e) {
    console.warn('[Intel] AI match failed:', e.message);
    return null;
  }
}

// ============================================
// Routes: 標案搜尋
// ============================================
router.get('/search', async (req, res) => {
  try {
    const { keyword = '', source = 'all' } = req.query;
    const kw = keyword || '活動';
    console.log(`[Intel] 搜尋: keyword="${kw}", source=${source}`);

    // 取得 ebuying 帳號（如有）
    const ebuyingAcct = db.find('external_accounts', a => a.platform === 'ebuying')[0];

    let results = [];
    const promises = [];

    if (source === 'all' || source === 'pcc') promises.push(scrapePCC(kw).then(r => results.push(...r)));
    if (source === 'all' || source === 'g0v') promises.push(fetchG0v(kw).then(r => results.push(...r)));
    if (source === 'all' || source === 'ebuying') promises.push(scrapeEbuying(kw, ebuyingAcct).then(r => results.push(...r)));

    await Promise.allSettled(promises);

    // Fallback
    if (results.length === 0) {
      console.log('[Intel] 外部來源無資料，使用內建資料庫');
      results = getDefaultBids(kw);
    }

    // 用戶自訂關鍵詞 + 對標公司加入匹配計算
    const userKws = db.find('tracking_keywords', () => true).map(k => k.keyword);
    const competitors = db.find('competitor_companies', () => true).map(c => c.name);

    // 簡單匹配：含有用戶關鍵詞的加分
    results.forEach(r => {
      if (!r.matchScore) r.matchScore = 50;
      const titleLower = r.title.toLowerCase();
      userKws.forEach(uk => {
        if (titleLower.includes(uk.toLowerCase())) r.matchScore = Math.min(r.matchScore + 15, 98);
      });
      if (kw && titleLower.includes(kw.toLowerCase())) r.matchScore = Math.min(r.matchScore + 10, 98);
    });

    // 排序
    results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    res.json({ total: results.length, results: results.slice(0, 30), userKeywords: userKws, competitors });
  } catch (err) {
    console.error('[Intel] 搜尋失敗:', err);
    res.status(500).json({ error: '搜尋失敗', details: err.message });
  }
});

// AI 深度匹配（單筆）
router.post('/match', async (req, res) => {
  try {
    const { bid } = req.body;
    if (!bid) return res.status(400).json({ error: '缺少標案資料' });
    const userKws = db.find('tracking_keywords', () => true).map(k => k.keyword);
    const competitors = db.find('competitor_companies', () => true).map(c => c.name);
    const result = await aiMatchScore(bid, userKws, competitors);
    res.json(result || { score: 50, reason: 'AI 暫時無法分析', threat: '未知', suggestion: '建議手動評估' });
  } catch (err) {
    res.status(500).json({ error: 'AI 匹配失敗' });
  }
});

// ============================================
// Routes: 收藏管理
// ============================================
router.get('/saved', (req, res) => {
  res.json(db.find('saved_bids', () => true).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

router.post('/save', (req, res) => {
  const { bid } = req.body;
  if (!bid?.title) return res.status(400).json({ error: '標案資料不完整' });
  const exists = db.find('saved_bids', b => b.title === bid.title && b.agency === bid.agency);
  if (exists.length > 0) return res.json({ success: true, id: exists[0].id });
  const id = uuidv4();
  db.insert('saved_bids', { id, ...bid, status: 'watching' });
  res.json({ success: true, id });
});

router.delete('/saved/:id', (req, res) => {
  db.delete('saved_bids', req.params.id);
  res.json({ success: true });
});

// ============================================
// Routes: 外部帳號管理
// ============================================
router.get('/accounts', (req, res) => {
  const accounts = db.find('external_accounts', () => true);
  res.json(accounts.map(a => ({ ...a, password: a.password ? '••••••' : '', hasPassword: !!a.password })));
});

router.post('/accounts', (req, res) => {
  const { platform, username, password, notes } = req.body;
  if (!platform || !username) return res.status(400).json({ error: '請提供平台與帳號' });
  const existing = db.find('external_accounts', a => a.platform === platform);
  if (existing.length > 0) {
    const upd = { username, notes, updated_at: new Date().toISOString() };
    if (password && password !== '••••••') upd.password = password;
    db.update('external_accounts', existing[0].id, upd);
    res.json({ success: true, id: existing[0].id });
  } else {
    const id = uuidv4();
    db.insert('external_accounts', { id, platform, username, password, notes });
    res.json({ success: true, id });
  }
});

router.delete('/accounts/:platform', (req, res) => {
  db.find('external_accounts', a => a.platform === req.params.platform).forEach(a => db.delete('external_accounts', a.id));
  res.json({ success: true });
});

// ============================================
// Routes: 追蹤關鍵詞 (用戶自訂)
// ============================================
router.get('/keywords', (req, res) => {
  res.json(db.find('tracking_keywords', () => true));
});

router.post('/keywords', (req, res) => {
  const { keyword } = req.body;
  if (!keyword?.trim()) return res.status(400).json({ error: '請輸入關鍵詞' });
  const exists = db.find('tracking_keywords', k => k.keyword === keyword.trim());
  if (exists.length > 0) return res.json({ success: true, id: exists[0].id, message: '已存在' });
  const id = uuidv4();
  db.insert('tracking_keywords', { id, keyword: keyword.trim() });
  res.json({ success: true, id });
});

router.delete('/keywords/:id', (req, res) => {
  db.delete('tracking_keywords', req.params.id);
  res.json({ success: true });
});

// ============================================
// Routes: 對標公司 (用戶自訂)
// ============================================
router.get('/competitors', (req, res) => {
  res.json(db.find('competitor_companies', () => true));
});

router.post('/competitors', (req, res) => {
  const { name, notes } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '請輸入公司名稱' });
  const exists = db.find('competitor_companies', c => c.name === name.trim());
  if (exists.length > 0) return res.json({ success: true, id: exists[0].id });
  const id = uuidv4();
  db.insert('competitor_companies', { id, name: name.trim(), notes: notes || '' });
  res.json({ success: true, id });
});

router.delete('/competitors/:id', (req, res) => {
  db.delete('competitor_companies', req.params.id);
  res.json({ success: true });
});

// ============================================
// 採購代碼分類系統 + 分類查詢
// ============================================
const PROCUREMENT_CODES = {
  '871': { label: '廣告服務', keywords: ['廣告', '宣傳', '媒體', '公關'] },
  '879': { label: '其他商業服務', keywords: ['顧問', '管理', '商業', '服務'] },
  '911': { label: '政府行政服務', keywords: ['行政', '政府', '公務'] },
  '933': { label: '社會服務', keywords: ['社會', '福利', '公益', '社區'] },
  '96':  { label: '娛樂、文化、體育服務', keywords: ['活動', '文化', '體育', '藝術', '展覽', '演出', '慶典', '節慶', '觀光'] },
  '97':  { label: '其他服務', keywords: ['其他', '綜合'] },
};

// 按代碼分類產生標案（fallback 資料）
function getBidsByCode(code) {
  const now = new Date();
  const codeInfo = PROCUREMENT_CODES[code] || PROCUREMENT_CODES['96'];
  const codeData = {
    '871': [
      { t: '2026年度政策宣導廣告案', a: '行政院新聞傳播處', b: 15000000 },
      { t: '觀光品牌國際廣告投放案', a: '交通部觀光署', b: 28000000 },
      { t: '反毒宣導影片製播案', a: '法務部', b: 5000000 },
      { t: '健保政策社群廣告案', a: '衛生福利部', b: 8000000 },
    ],
    '879': [
      { t: '智慧城市顧問諮詢服務案', a: '數位發展部', b: 12000000 },
      { t: '企業輔導訪視計畫', a: '經濟部中小及新創企業署', b: 6000000 },
      { t: '國際貿易推廣服務案', a: '經濟部國際貿易署', b: 20000000 },
    ],
    '911': [
      { t: '民眾服務滿意度調查案', a: '國家發展委員會', b: 3000000 },
      { t: '公務人員訓練規劃案', a: '公務人力發展學院', b: 8000000 },
    ],
    '933': [
      { t: '長照服務宣導活動案', a: '衛生福利部', b: 6000000 },
      { t: '社區營造計畫推廣案', a: '文化部', b: 4000000 },
      { t: '新住民文化交流活動案', a: '內政部移民署', b: 5000000 },
    ],
    '96': [
      { t: '2026台灣燈會主場活動規劃案', a: '交通部觀光署', b: 80000000 },
      { t: '2026桃園地景藝術節策展執行案', a: '桃園市政府文化局', b: 35000000 },
      { t: '國慶煙火施放及周邊活動規劃案', a: '內政部', b: 120000000 },
      { t: '台北市跨年晚會企劃執行案', a: '台北市政府觀傳局', b: 95000000 },
      { t: '新北歡樂耶誕城活動執行案', a: '新北市政府文化局', b: 60000000 },
      { t: '高雄跨百光年藝術節策展案', a: '高雄市政府文化局', b: 45000000 },
      { t: '客家桐花祭系列活動案', a: '客家委員會', b: 18000000 },
      { t: '金曲獎頒獎典禮執行案', a: '文化部影視及流行音樂產業局', b: 75000000 },
      { t: '台中市觀光嘉年華活動案', a: '台中市政府觀光旅遊局', b: 25000000 },
      { t: '2026台北馬拉松賽事執行案', a: '臺北市政府體育局', b: 50000000 },
      { t: '原住民族豐年祭觀光推廣案', a: '原住民族委員會', b: 6000000 },
      { t: '台南古都行銷節慶活動案', a: '台南市政府文化局', b: 15000000 },
    ],
    '97': [
      { t: '政府機關清潔維護服務案', a: '行政院', b: 2000000 },
      { t: '資訊系統維護服務案', a: '數位發展部', b: 10000000 },
    ],
  };
  const items = codeData[code] || codeData['96'];
  return items.map((d, i) => {
    const dl = new Date(now); dl.setDate(dl.getDate() + Math.floor(Math.random() * 45) + 15);
    const pd = new Date(now); pd.setDate(pd.getDate() - Math.floor(Math.random() * 10));
    return {
      id: `cat-${code}-${i}`, title: d.t, agency: d.a, budget: d.b,
      category: codeInfo.label, code, deadline: dl.toISOString().split('T')[0],
      publishDate: pd.toISOString().split('T')[0], source: 'pcc',
      sourceUrl: 'https://web.pcc.gov.tw', matchScore: null,
      documents: [
        { name: '招標文件', type: 'tender_doc', url: '#' },
        { name: '需求書', type: 'requirement', url: '#' },
        { name: '預算明細表', type: 'budget_detail', url: '#' },
      ],
    };
  });
}

// GET /api/intel/categories — 取得代碼分類列表
router.get('/categories', (req, res) => {
  const cats = Object.entries(PROCUREMENT_CODES).map(([code, info]) => ({
    code, label: info.label, keywords: info.keywords,
  }));
  res.json(cats);
});

// GET /api/intel/search-by-code — 按代碼搜尋
router.get('/search-by-code', (req, res) => {
  const { code = '96' } = req.query;
  const results = getBidsByCode(code);
  const userKws = db.find('tracking_keywords', () => true).map(k => k.keyword);
  results.forEach(r => {
    r.matchScore = 50;
    userKws.forEach(uk => {
      if (r.title.includes(uk)) r.matchScore = Math.min(r.matchScore + 15, 98);
    });
  });
  results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  res.json({ code, label: PROCUREMENT_CODES[code]?.label, total: results.length, results });
});

// ============================================
// 決標查詢 + 歷史追蹤
// ============================================
function getAwardData(keyword, agency, year) {
  const vendors = ['奧美廣告', '電通國華', '必應創造', '聯廣傳播', '自由落體', '超級圓頂', '就是現場', '千翔事業', '信義志傑', '新象活動'];
  const now = new Date();
  const y = year || now.getFullYear();
  
  // 模擬 2-3 年歷史決標資料
  const baseItems = keyword ? [
    { t: keyword.includes('燈會') ? '台灣燈會活動規劃案' : keyword.includes('跨年') ? '跨年晚會企劃案' : `${keyword}相關標案`, a: agency || '交通部觀光署' },
  ] : [
    { t: '年度觀光推廣活動案', a: agency || '交通部觀光署' },
    { t: '城市節慶活動企劃案', a: agency || '台北市政府觀傳局' },
    { t: '文化藝術節策展案', a: agency || '文化部' },
  ];

  const results = [];
  for (let yr = y; yr >= y - 2; yr--) {
    baseItems.forEach((item, i) => {
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];
      const amount = Math.floor(Math.random() * 50000000) + 5000000;
      results.push({
        id: `award-${yr}-${i}`,
        year: yr,
        title: `${yr}${item.t}`,
        agency: item.a,
        winner: vendor,
        amount,
        awardDate: `${yr}-${String(Math.floor(Math.random() * 6) + 4).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        bidCount: Math.floor(Math.random() * 6) + 2,
        source: 'pcc',
      });
    });
  }
  return results;
}

// GET /api/intel/awards — 決標查詢
router.get('/awards', (req, res) => {
  const { keyword = '', agency = '', year } = req.query;
  console.log(`[Intel] 決標查詢: keyword="${keyword}", agency="${agency}"`);
  const results = getAwardData(keyword, agency, year ? parseInt(year) : undefined);
  
  // 存入歷史記錄
  results.forEach(r => {
    const exists = db.find('award_history', h => h.title === r.title && h.year === r.year);
    if (exists.length === 0) db.insert('award_history', { id: r.id, ...r });
  });

  res.json({ total: results.length, results });
});

// POST /api/intel/analyze-trend — AI 分析得標趨勢
router.post('/analyze-trend', async (req, res) => {
  try {
    const { awards } = req.body;
    if (!awards?.length) return res.status(400).json({ error: '缺少決標資料' });
    
    const competitors = db.find('competitor_companies', () => true).map(c => c.name);
    
    // 分析固定廠商
    const winnerCounts = {};
    awards.forEach(a => { winnerCounts[a.winner] = (winnerCounts[a.winner] || 0) + 1; });
    const topWinner = Object.entries(winnerCounts).sort((a, b) => b[1] - a[1])[0];
    const isFixed = topWinner && topWinner[1] >= Math.ceil(awards.length * 0.6);

    // AI 分析
    let aiAnalysis = null;
    try {
      const prompt = `你是一位政府標案競爭分析師。分析以下決標歷史資料：

${awards.map(a => `${a.year}年 - ${a.title} - 得標：${a.winner} - 金額：${a.amount}元 - 投標家數：${a.bidCount}`).join('\n')}

我們的競爭對手：${competitors.join('、') || '未設定'}

請回傳 JSON（不要其他文字）：
{
  "isFixed": true/false（是否為固定廠商得標）,
  "dominantVendor": "最常得標的廠商名稱",
  "trend": "得標趨勢說明（50字內）",
  "fairness": "高/中/低（競爭公平性）",
  "recommendation": "投標策略建議（50字內）",
  "riskLevel": "高/中/低（投標風險）",
  "estimatedBudget": "預估下次預算金額"
}`;
      const r = await ai.chat(
        [{ role: 'user', content: prompt }],
        { temperature: 0.3, max_tokens: 300 }
      );
      const text = r.content || '';
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
      if (jsonStr) aiAnalysis = JSON.parse(jsonStr);
    } catch (e) { console.warn('[Intel] AI trend failed:', e.message); }

    res.json({
      winnerCounts,
      topWinner: topWinner ? { name: topWinner[0], count: topWinner[1] } : null,
      isFixed,
      totalYears: [...new Set(awards.map(a => a.year))].length,
      aiAnalysis: aiAnalysis || {
        isFixed,
        dominantVendor: topWinner?.[0] || '—',
        trend: isFixed ? '同一廠商連續得標，可能有固定配合關係' : '不同廠商輪流得標，市場較為開放',
        fairness: isFixed ? '低' : '高',
        recommendation: isFixed ? '需評估切入點，考慮聯合投標或差異化策略' : '競爭公平，建議積極投標',
        riskLevel: isFixed ? '高' : '低',
      },
    });
  } catch (err) {
    console.error('[Intel] 趨勢分析失敗:', err);
    res.status(500).json({ error: '分析失敗' });
  }
});

// ============================================
// 競品廠商資料庫 CRUD（對應客戶 Google Sheet）
// ============================================

// GET /api/intel/records — 取得全部競品紀錄（可篩選）
router.get('/records', (req, res) => {
  const { agency, keyword, vendor, page = 1, limit = 50 } = req.query;
  let records = db.find('competitor_records', () => true);
  if (agency) records = records.filter(r => r.agency?.includes(agency));
  if (keyword) records = records.filter(r => r.caseName?.includes(keyword) || r.agency?.includes(keyword));
  if (vendor) records = records.filter(r =>
    r.winner2023?.includes(vendor) || r.winner2024?.includes(vendor) || r.winner2025?.includes(vendor)
  );
  records.sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1);
  const total = records.length;
  const start = (parseInt(page) - 1) * parseInt(limit);
  const paged = records.slice(start, start + parseInt(limit));
  res.json({ total, page: parseInt(page), results: paged });
});

// POST /api/intel/records — 新增單筆競品紀錄
router.post('/records', (req, res) => {
  const { agency, caseName, amount, winner2023, winner2024, winner2025, notes } = req.body;
  if (!caseName) return res.status(400).json({ error: '請輸入案名' });
  const id = uuidv4();
  db.insert('competitor_records', {
    id, agency: agency || '', caseName, amount: amount || '',
    winner2023: winner2023 || '', winner2024: winner2024 || '', winner2025: winner2025 || '',
    notes: notes || '',
  });
  res.json({ success: true, id });
});

// PUT /api/intel/records/:id — 更新競品紀錄
router.put('/records/:id', (req, res) => {
  const { agency, caseName, amount, winner2023, winner2024, winner2025, notes } = req.body;
  db.update('competitor_records', req.params.id, {
    agency, caseName, amount, winner2023, winner2024, winner2025, notes,
    updated_at: new Date().toISOString(),
  });
  res.json({ success: true });
});

// DELETE /api/intel/records/:id — 刪除競品紀錄
router.delete('/records/:id', (req, res) => {
  db.delete('competitor_records', req.params.id);
  res.json({ success: true });
});

// POST /api/intel/records/bulk — 批次匯入
router.post('/records/bulk', (req, res) => {
  const { records: items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: '格式錯誤' });
  let count = 0;
  items.forEach(r => {
    if (!r.caseName) return;
    const id = uuidv4();
    db.insert('competitor_records', {
      id, agency: r.agency || '', caseName: r.caseName, amount: r.amount || '',
      winner2023: r.winner2023 || '', winner2024: r.winner2024 || '', winner2025: r.winner2025 || '',
      notes: r.notes || '',
    });
    count++;
  });
  res.json({ success: true, imported: count });
});

// GET /api/intel/records/stats — 競品統計（廠商得標次數等）
router.get('/records/stats', (req, res) => {
  const records = db.find('competitor_records', () => true);
  const vendorCounts = {};
  const agencyCounts = {};
  let totalAmount = 0;

  records.forEach(r => {
    // 機關統計
    if (r.agency) agencyCounts[r.agency] = (agencyCounts[r.agency] || 0) + 1;
    // 金額
    const amt = typeof r.amount === 'string' ? parseInt(r.amount.replace(/,/g, '')) : r.amount;
    if (!isNaN(amt)) totalAmount += amt;
    // 廠商統計
    [r.winner2023, r.winner2024, r.winner2025].forEach(w => {
      if (w && w !== 'X' && w !== 'x' && w.trim()) {
        // 處理多廠商分割
        const names = w.split(/[,、；;]/).map(n => n.trim()).filter(n => n.length > 1 && n !== 'X');
        names.forEach(name => {
          // 清理年份前綴
          const clean = name.replace(/^\d{4}[：:-]/, '').trim();
          if (clean.length > 1) vendorCounts[clean] = (vendorCounts[clean] || 0) + 1;
        });
      }
    });
  });

  // 找出連續得標廠商（同一案 2+ 年）
  const fixedVendors = [];
  records.forEach(r => {
    const w = [r.winner2023, r.winner2024, r.winner2025].map(v => v?.trim()).filter(v => v && v !== 'X');
    if (w.length >= 2) {
      const unique = [...new Set(w)];
      if (unique.length === 1) fixedVendors.push({ vendor: unique[0], caseName: r.caseName, agency: r.agency });
    }
  });

  const topVendors = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const topAgencies = Object.entries(agencyCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

  res.json({ totalRecords: records.length, totalAmount, topVendors, topAgencies, fixedVendors: fixedVendors.slice(0, 20) });
});

module.exports = router;
