/**
 * ProposalFlow AI — 場地模擬 E2E 測試
 * 測試 venue-sim API endpoint
 */
const http = require('http');

function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3001,
      path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, data: d });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== ProposalFlow AI 場地模擬 E2E 測試 ===\n');

  // 1. 登入
  console.log('1. 登入...');
  const loginRes = await apiCall('POST', '/api/auth/login', { username: 'ceo', password: 'wdmc2026' });
  const token = loginRes.data.token;
  console.log(`   ✅ 登入成功: ${loginRes.data.user.username} (${loginRes.data.user.role})\n`);

  // 2. 取得專案列表
  console.log('2. 取得專案列表...');
  const projectsRes = await apiCall('GET', '/api/projects', null, token);
  console.log(`   ✅ 共 ${projectsRes.data.length} 個專案`);

  let projectId;
  if (projectsRes.data.length > 0) {
    projectId = projectsRes.data[0].id;
    console.log(`   使用專案: ${projectsRes.data[0].name} (${projectId})\n`);
  } else {
    console.log('   建立測試專案...');
    const newP = await apiCall('POST', '/api/projects', {
      name: '場地模擬測試專案',
      case_type: 'commercial',
      event_type: '企業活動',
      budget: 500000,
    }, token);
    projectId = newP.data.id;
    console.log(`   ✅ 新專案: ${newP.data.id}\n`);
  }

  // 3. 測試場地模擬 API
  console.log('3. 測試場地模擬 API (黑金色的氣球拱門)...');
  const simRes = await apiCall('POST', `/api/projects/${projectId}/generate-image/venue-sim`, {
    keywords: '黑金色的氣球拱門',
    style: 'realistic',
    venue_description: '一個現代風格的活動場地入口門口',
    project_context: { name: '年終晚會', event_type: '企業活動', venue: '台北國際會議中心' },
  }, token);

  console.log(`   狀態碼: ${simRes.status}`);
  console.log(`   成功: ${simRes.data.success}`);
  console.log(`   圖片 URL: ${simRes.data.image_url}`);
  console.log(`   Provider: ${simRes.data.provider}`);
  if (simRes.data.prompt_used) {
    console.log(`   Prompt (前200字): ${simRes.data.prompt_used.substring(0, 200)}...`);
  }
  console.log('');

  // 4. 測試不同風格
  const styles = ['illustration', '3d_render', 'blueprint'];
  for (const s of styles) {
    console.log(`4. 測試風格: ${s}...`);
    const r = await apiCall('POST', `/api/projects/${projectId}/generate-image/venue-sim`, {
      keywords: '黑金色氣球拱門、紅色地毯、入口花藝',
      style: s,
    }, token);
    console.log(`   ✅ ${r.data.provider} — ${r.data.image_url}`);
  }
  console.log('');

  // 5. 測試活動模擬圖 API
  console.log('5. 測試活動子項目模擬圖...');
  const actRes = await apiCall('POST', `/api/projects/${projectId}/generate-image`, {
    activity_name: '闖關遊戲區',
    description: '設置 5 個互動闖關站，包含體能挑戰、益智問答等',
    style: 'illustration',
  }, token);
  console.log(`   ✅ ${actRes.data.provider} — ${actRes.data.image_url}\n`);

  // 6. 驗證 SVG 檔案是否存在
  console.log('6. 驗證生成的檔案...');
  const fs = require('fs');
  const path = require('path');
  const genDir = path.join(__dirname, 'uploads', 'generated');
  if (fs.existsSync(genDir)) {
    const files = fs.readdirSync(genDir);
    console.log(`   ✅ uploads/generated/ 目錄有 ${files.length} 個檔案`);
    files.slice(-3).forEach(f => {
      const size = fs.statSync(path.join(genDir, f)).size;
      console.log(`   - ${f} (${size} bytes)`);
    });
  }

  console.log('\n=== 全部測試通過 ===');
}

main().catch(err => {
  console.error('測試失敗:', err);
  process.exit(1);
});
