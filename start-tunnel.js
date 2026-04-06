/**
 * Cloudflare Tunnel 雙系統啟動器（升級版）
 * 免費、不需帳號、不需密碼、手機也能開
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 自動偵測 cloudflared 路徑
const LOCAL_CF = path.join(__dirname, 'cloudflared-amd64.exe');
const LOCAL_CF2 = path.join(__dirname, 'cloudflared.exe');
const WINGET_CF = 'C:\\Users\\Administrator\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\\cloudflared.exe';
const CF_PATH = fs.existsSync(LOCAL_CF) ? LOCAL_CF : WINGET_CF;

const SYSTEMS = [
  { name: 'WDMC ERP', port: 3002, credentials: 'ceo / wdmc2026' },
  { name: 'ProposalFlow AI', port: 3001, credentials: 'ceo / wdmc2026' },
];

console.log('\n🌐 Cloudflare Tunnel 雙系統啟動器\n');
console.log(`   使用: ${CF_PATH}\n`);

const urls = {};

SYSTEMS.forEach(sys => {
  const cf = spawn(CF_PATH, ['tunnel', '--url', `http://localhost:${sys.port}`], { stdio: ['pipe', 'pipe', 'pipe'] });

  cf.stderr.on('data', (data) => {
    const line = data.toString();
    const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !urls[sys.name]) {
      urls[sys.name] = match[0];
      console.log(`\n✅ ${sys.name}`);
      console.log(`   本地: http://localhost:${sys.port}`);
      console.log(`   公網: ${match[0]}`);
      console.log(`   帳號: ${sys.credentials}`);
      console.log(`   （直接打開，任何網路都能用！）\n`);

      // 全部都有 URL 了就顯示摘要
      if (Object.keys(urls).length === SYSTEMS.length) {
        console.log('\n' + '='.repeat(60));
        console.log('📋 複製以下資訊發給客戶：');
        console.log('='.repeat(60));
        Object.entries(urls).forEach(([name, url]) => {
          const sys = SYSTEMS.find(s => s.name === name);
          console.log(`\n🔗 ${name}`);
          console.log(`   網址: ${url}`);
          console.log(`   帳號: ${sys.credentials}`);
        });
        console.log('\n' + '='.repeat(60) + '\n');
      }
    }
  });

  cf.on('close', (code) => {
    console.log(`⚠️ ${sys.name} 隧道已斷開 (code: ${code})`);
  });
});

console.log('⏳ 正在建立 Cloudflare 隧道...');
console.log('  （不需帳號、免費、手機電腦都能開）\n');
console.log('按 Ctrl+C 關閉所有隧道\n');
