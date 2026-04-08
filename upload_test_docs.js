const http = require('http');
const fs = require('fs');
const path = require('path');

const projectId = '8d2cfbc9-3815-4098-b716-80a7372e6839';
const files = [
  { path: 'C:/Users/user/Downloads/05-「2026 海客文化藝術季」需求說明書n.docx', category: 'requirement' },
  { path: 'C:/Users/user/Downloads/02-1勞務採購契約n.doc', category: 'contract' },
  { path: 'C:/Users/user/Downloads/04 - 投標廠商評選須知n.doc', category: 'evaluation' },
  { path: 'C:/Users/user/Downloads/01.招標文件清單n.doc', category: 'other' },
  { path: 'C:/Users/user/Downloads/03.投標須知n.doc', category: 'evaluation' }
];

function upload(fileInfo) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now();
    const filename = path.basename(fileInfo.path);
    const fileData = fs.readFileSync(fileInfo.path);
    
    const parts = [];
    // category field
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\n${fileInfo.category}\r\n`);
    // file field
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
    
    const header = Buffer.from(parts.join(''));
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileData, footer]);
    
    const req = http.request({
      hostname: 'localhost', port: 3001,
      path: `/api/projects/${projectId}/documents`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(`[${res.statusCode}] ${filename}`);
        if (res.statusCode === 201) {
          const parsed = JSON.parse(d);
          console.log(`  -> ID: ${parsed[0]?.id}, Category: ${parsed[0]?.category}`);
        } else {
          console.log(`  -> Error: ${d}`);
        }
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log('Uploading 5 documents to project:', projectId);
  console.log('---');
  for (const f of files) {
    console.log(`Uploading: ${path.basename(f.path)} (${f.category})`);
    await upload(f);
  }
  console.log('---');
  console.log('All uploads complete!');
})();
