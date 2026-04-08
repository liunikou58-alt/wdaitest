/**
 * 全面系統測試腳本
 * 測試所有 API 端點、6 個帳號登入、AI 呼叫、資料庫操作
 */
const http = require('http');

const BASE = 'http://localhost:3001';
const results = [];
let totalPass = 0, totalFail = 0;

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  if (status === 'PASS') totalPass++;
  else if (status === 'FAIL') totalFail++;
  results.push({ test, status, detail });
  console.log(`${icon} ${test}${detail ? ' — ' + detail : ''}`);
}

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
      timeout: 30000,
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(b) });
        } catch {
          resolve({ status: res.statusCode, data: b });
        }
      });
    });
    req.on('error', e => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  WDAITEST 全面系統測試');
  console.log('  ' + new Date().toLocaleString('zh-TW'));
  console.log('='.repeat(60) + '\n');

  // ========================================
  // 1. 基礎健康檢查
  // ========================================
  console.log('\n--- 1. 基礎健康檢查 ---');
  try {
    const r = await request('GET', '/api/health');
    log('Health Check', r.status === 200 && r.data.status === 'ok' ? 'PASS' : 'FAIL', `status=${r.data.status}`);
  } catch (e) {
    log('Health Check', 'FAIL', e.message);
  }

  // ========================================
  // 2. 全部 6 帳號登入測試
  // ========================================
  console.log('\n--- 2. 帳號登入測試 ---');
  const accounts = [
    { username: 'mei', password: 'mei2026', expectedKey: 1 },
    { username: 'Conny', password: 'Conny2026', expectedKey: 2 },
    { username: 'Andrea', password: 'Andrea2026', expectedKey: 3 },
    { username: 'Alice', password: 'Alice226', expectedKey: 4 },
    { username: 'ceo', password: 'wdmcceo2026', expectedKey: 5 },
    { username: 'test', password: 'test2026', expectedKey: 6 },
  ];

  const tokens = {};
  for (const acc of accounts) {
    try {
      const r = await request('POST', '/api/auth/login', { username: acc.username, password: acc.password });
      if (r.status === 200 && r.data.token) {
        tokens[acc.username] = r.data.token;
        const payload = JSON.parse(Buffer.from(r.data.token.split('.')[1], 'base64').toString());
        const keyMatch = payload.gemini_key_index === acc.expectedKey;
        log(`Login: ${acc.username}`, keyMatch ? 'PASS' : 'WARN', 
          `role=${r.data.user.role}, keyIndex=${payload.gemini_key_index}${keyMatch ? '' : ' (expected ' + acc.expectedKey + ')'}`);
      } else {
        log(`Login: ${acc.username}`, 'FAIL', `status=${r.status}, error=${r.data.error || 'unknown'}`);
      }
    } catch (e) {
      log(`Login: ${acc.username}`, 'FAIL', e.message);
    }
  }

  // 錯誤密碼測試
  try {
    const r = await request('POST', '/api/auth/login', { username: 'ceo', password: 'wrongpassword' });
    log('Wrong Password Rejection', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
  } catch (e) {
    log('Wrong Password Rejection', 'FAIL', e.message);
  }

  // ========================================
  // 3. Auth API 測試
  // ========================================
  console.log('\n--- 3. Auth API ---');
  const ceoToken = tokens['ceo'];
  const testToken = tokens['test'];

  try {
    const r = await request('GET', '/api/auth/me', null, ceoToken);
    log('GET /api/auth/me', r.status === 200 && r.data.username === 'ceo' ? 'PASS' : 'FAIL', `user=${r.data.username}`);
  } catch (e) {
    log('GET /api/auth/me', 'FAIL', e.message);
  }

  try {
    const r = await request('GET', '/api/auth/roles', null, ceoToken);
    log('GET /api/auth/roles', r.status === 200 && Array.isArray(r.data) ? 'PASS' : 'FAIL', `${r.data?.length || 0} roles`);
  } catch (e) {
    log('GET /api/auth/roles', 'FAIL', e.message);
  }

  try {
    const r = await request('GET', '/api/auth/users', null, ceoToken);
    log('GET /api/auth/users', r.status === 200 ? 'PASS' : 'FAIL', `${Array.isArray(r.data) ? r.data.length : 0} users`);
  } catch (e) {
    log('GET /api/auth/users', 'FAIL', e.message);
  }

  try {
    const r = await request('GET', '/api/auth/departments', null, ceoToken);
    log('GET /api/auth/departments', r.status === 200 && Array.isArray(r.data) ? 'PASS' : 'FAIL', `${r.data?.length || 0} depts`);
  } catch (e) {
    log('GET /api/auth/departments', 'FAIL', e.message);
  }

  try {
    const r = await request('GET', '/api/auth/permissions', null, ceoToken);
    log('GET /api/auth/permissions', r.status === 200 ? 'PASS' : 'FAIL');
  } catch (e) {
    log('GET /api/auth/permissions', 'FAIL', e.message);
  }

  // 無 token 測試
  try {
    const r = await request('GET', '/api/auth/me');
    log('Unauthorized Rejection', r.status === 401 ? 'PASS' : 'FAIL', `status=${r.status}`);
  } catch (e) {
    log('Unauthorized Rejection', 'FAIL', e.message);
  }

  // ========================================
  // 4. AI 模型與使用量 API
  // ========================================
  console.log('\n--- 4. AI 模型 API ---');
  try {
    const r = await request('GET', '/api/ai/models');
    const gemini = Array.isArray(r.data) ? r.data.find(m => m.id === 'gemini') : null;
    log('GET /api/ai/models', gemini?.available ? 'PASS' : 'FAIL', 
      `available=${gemini?.available}, keyCount=${gemini?.keyCount}`);
  } catch (e) {
    log('GET /api/ai/models', 'FAIL', e.message);
  }

  try {
    const r = await request('GET', '/api/ai/usage', null, ceoToken);
    log('GET /api/ai/usage', r.status === 200 ? 'PASS' : 'FAIL', 
      `keyCount=${r.data.keyCount}, provider=${r.data.activeProvider}`);
  } catch (e) {
    log('GET /api/ai/usage', 'FAIL', e.message);
  }

  // ========================================
  // 5. AI 呼叫測試（用不同帳號測試 Key 分配）
  // ========================================
  console.log('\n--- 5. AI 呼叫測試（Gemini 2.5 Flash）---');
  
  // 用 mei 和 test 帳號各做一次 AI 呼叫
  for (const username of ['mei', 'test']) {
    try {
      const r = await request('POST', '/api/ai/chat', {
        message: '請用一句話介紹你自己（10字以內）',
        taskType: 'chat',
      }, tokens[username]);
      
      if (r.status === 200 && r.data.content) {
        log(`AI Chat (${username})`, 'PASS', 
          `model=${r.data.model}, tokens=${r.data.tokens}, content=${r.data.content.substring(0, 30)}...`);
      } else {
        log(`AI Chat (${username})`, 'FAIL', `status=${r.status}, error=${r.data.error || JSON.stringify(r.data).substring(0, 100)}`);
      }
    } catch (e) {
      log(`AI Chat (${username})`, 'FAIL', e.message);
    }
  }

  // ========================================
  // 6. 專案 CRUD API
  // ========================================
  console.log('\n--- 6. 專案 CRUD ---');
  let testProjectId = null;

  try {
    const r = await request('GET', '/api/projects', null, ceoToken);
    log('GET /api/projects', r.status === 200 ? 'PASS' : 'FAIL', 
      `${Array.isArray(r.data) ? r.data.length : (r.data?.data?.length || 0)} projects`);
  } catch (e) {
    log('GET /api/projects', 'FAIL', e.message);
  }

  try {
    const r = await request('POST', '/api/projects', {
      name: '系統測試專案',
      agency: '測試機關',
      event_type: '測試活動',
      case_type: 'government',
    }, ceoToken);
    if (r.status === 201 || r.status === 200) {
      testProjectId = r.data.id;
      log('POST /api/projects (Create)', 'PASS', `id=${testProjectId}`);
    } else {
      log('POST /api/projects (Create)', 'FAIL', `status=${r.status}, ${JSON.stringify(r.data).substring(0, 100)}`);
    }
  } catch (e) {
    log('POST /api/projects (Create)', 'FAIL', e.message);
  }

  if (testProjectId) {
    try {
      const r = await request('GET', `/api/projects/${testProjectId}`, null, ceoToken);
      log('GET /api/projects/:id', r.status === 200 && r.data.name === '系統測試專案' ? 'PASS' : 'FAIL');
    } catch (e) {
      log('GET /api/projects/:id', 'FAIL', e.message);
    }

    try {
      const r = await request('PUT', `/api/projects/${testProjectId}`, { name: '已更新專案' }, ceoToken);
      log('PUT /api/projects/:id', r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) {
      log('PUT /api/projects/:id', 'FAIL', e.message);
    }
  }

  // ========================================
  // 7. 文件上傳端點（不實際上傳，但測試路由存在）
  // ========================================
  console.log('\n--- 7. 文件路由 ---');
  if (testProjectId) {
    try {
      const r = await request('GET', `/api/projects/${testProjectId}/documents`, null, ceoToken);
      log('GET /api/projects/:id/documents', r.status === 200 ? 'PASS' : 'FAIL', `${Array.isArray(r.data) ? r.data.length : 0} docs`);
    } catch (e) {
      log('GET documents', 'FAIL', e.message);
    }
  }

  // ========================================
  // 8. 各功能模組 API 端點存在性測試
  // ========================================
  console.log('\n--- 8. 功能模組端點 ---');
  const endpoints = [
    { method: 'GET', path: '/api/ai/models', desc: 'AI Models' },
    { method: 'GET', path: '/api/ai/usage', desc: 'AI Usage', auth: true },
  ];

  if (testProjectId) {
    endpoints.push(
      { method: 'GET', path: `/api/projects/${testProjectId}/analysis`, desc: 'Analysis', auth: true, allow404: true },
      { method: 'GET', path: `/api/projects/${testProjectId}/theme-proposal`, desc: 'Theme Proposal', auth: true, allow404: true },
      { method: 'GET', path: `/api/projects/${testProjectId}/highlights`, desc: 'Highlights', auth: true, allow404: true },
      { method: 'GET', path: `/api/projects/${testProjectId}/cost-estimate`, desc: 'Cost Estimate', auth: true, allow404: true },
    );
  }

  for (const ep of endpoints) {
    try {
      const r = await request(ep.method, ep.path, null, ep.auth ? ceoToken : null);
      const ok = r.status === 200 || (ep.allow404 && r.status === 404);
      log(`${ep.method} ${ep.desc}`, ok ? 'PASS' : 'FAIL', `status=${r.status}`);
    } catch (e) {
      log(`${ep.method} ${ep.desc}`, 'FAIL', e.message);
    }
  }

  // ========================================
  // 9. 清理：刪除測試專案
  // ========================================
  console.log('\n--- 9. 清理 ---');
  if (testProjectId) {
    try {
      const r = await request('DELETE', `/api/projects/${testProjectId}`, null, ceoToken);
      log('DELETE test project', (r.status === 200 || r.status === 204) ? 'PASS' : 'FAIL', `status=${r.status}`);
    } catch (e) {
      log('DELETE test project', 'FAIL', e.message);
    }
  }

  // ========================================
  // 結果摘要
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log(`  測試結果: ${totalPass} PASS / ${totalFail} FAIL / ${results.filter(r=>r.status==='WARN').length} WARN`);
  console.log('='.repeat(60));

  if (totalFail > 0) {
    console.log('\n❌ 失敗項目:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.test}: ${r.detail}`));
  }
  if (results.some(r => r.status === 'WARN')) {
    console.log('\n⚠️ 警告項目:');
    results.filter(r => r.status === 'WARN').forEach(r => console.log(`  - ${r.test}: ${r.detail}`));
  }
}

runTests().catch(e => console.error('Test runner error:', e));
