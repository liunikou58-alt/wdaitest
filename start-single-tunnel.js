const { spawn } = require('child_process');
const path = require('path');

const CF_PATH = path.join(__dirname, 'cloudflared-amd64.exe');
const PORT = 3001;

console.log('Starting Cloudflare tunnel for ProposalFlow AI (port ' + PORT + ')...\n');

const cf = spawn(CF_PATH, ['tunnel', '--url', 'http://localhost:' + PORT]);
let found = false;

cf.stderr.on('data', (data) => {
  const line = data.toString();
  const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match && !found) {
    found = true;
    console.log('============================================');
    console.log('  ProposalFlow AI - Tunnel Ready!');
    console.log('============================================');
    console.log('  Local:  http://localhost:' + PORT);
    console.log('  Public: ' + match[0]);
    console.log('  Login:  ceo / wdmc2026');
    console.log('============================================\n');
    console.log('Press Ctrl+C to close tunnel\n');
  }
});

cf.on('close', (code) => {
  console.log('Tunnel closed (code: ' + code + ')');
});
