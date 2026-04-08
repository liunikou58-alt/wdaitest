const http = require('http');

const projectId = '8d2cfbc9-3815-4098-b716-80a7372e6839';
const THEME_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost', port: 3001,
      path: `/api/projects/${projectId}${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Step 1: Extract sub-activities from theme report
  console.log('Step 1: Extracting sub-activities from themes...');
  const extracted = await apiCall('POST', '/themes/extract-activities', {});
  console.log('  Extracted activities:', extracted?.activities?.length || 0);

  if (!extracted?.activities?.length) {
    console.log('  No activities extracted! Exiting.');
    return;
  }

  // Show activities
  const grouped = {};
  extracted.activities.forEach(act => {
    const theme = act.theme || 'Unknown';
    if (!grouped[theme]) grouped[theme] = [];
    grouped[theme].push(act);
  });

  Object.entries(grouped).forEach(([theme, acts], gi) => {
    console.log(`\n  Theme ${gi+1}: ${theme}`);
    acts.forEach((a, i) => console.log(`    ${i+1}. ${a.name}: ${(a.description || '').substring(0, 50)}...`));
  });

  // Step 2: Select first 5 activities across themes
  const selectedSubs = [];
  let count = 0;
  Object.entries(grouped).forEach(([theme, acts], gi) => {
    acts.forEach((act) => {
      if (count < 6) {
        const key = `theme-${gi}::${act.name}`;
        selectedSubs.push({
          key,
          themeId: `theme-${gi}`,
          themeTitle: act.theme || `方案 ${gi + 1}`,
          name: act.name,
          description: act.description,
          effect: act.effect,
          color: THEME_COLORS[gi % THEME_COLORS.length]
        });
        count++;
      }
    });
  });

  console.log(`\nStep 2: Saving ${selectedSubs.length} selected sub-activities...`);
  const saveResult = await apiCall('POST', '/themes/selected-activities', { items: selectedSubs });
  console.log('  Save result:', JSON.stringify(saveResult).substring(0, 200));

  // Step 3: Verify
  console.log('\nStep 3: Verifying saved sub-activities...');
  const verify = await apiCall('GET', '/themes/selected-activities');
  console.log('  Saved items count:', verify?.items?.length || 0);

  console.log('\nDone! Sub-activities saved. Plan Summary page should now work.');
}

main().catch(console.error);
